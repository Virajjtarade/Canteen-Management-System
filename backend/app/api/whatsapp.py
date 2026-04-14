from flask import Blueprint, request
from twilio.twiml.messaging_response import MessagingResponse
from ..extensions import db
from ..models import Canteen, MenuItem, Order, OrderItem, PaymentMode, PaymentStatus
from ..api.orders import _serialize_order

bp = Blueprint("whatsapp", __name__, url_prefix="/whatsapp")

# Simple in-memory cache to track user conversation state
# Usually, this should be in Redis, but memory is fine for the prototype.
SESSION_STORE = {}

@bp.route("/webhook", methods=["POST"])
def webhook():
    # Twilio sends form-encoded data
    incoming_msg = request.values.get("Body", "").strip().lower()
    sender = request.values.get("From", "")
    profile_name = request.values.get("ProfileName", "WhatsApp Guest")
    
    resp = MessagingResponse()
    msg = resp.message()
    
    # Default to the first canteen if none specific
    canteen = Canteen.query.first()
    if not canteen:
        msg.body("Sorry, the canteen is currently offline.")
        return str(resp)

    # 1. User says hi or wants the menu
    if incoming_msg in ("hi", "hello", "menu"):
        menu = MenuItem.query.filter_by(canteen_id=canteen.id, available=True).all()
        if not menu:
            msg.body("Sorry, the menu is currently empty.")
            return str(resp)
        
        reply = f"Welcome to *{canteen.name}*!\n\n*Menu:*\n"
        menu_map = {}
        for idx, item in enumerate(menu, 1):
            reply += f"{idx}. {item.name} - ₹{float(item.price)}\n"
            menu_map[str(idx)] = item.id
        
        reply += "\nTo order, just reply with the exact item numbers separated by commas (e.g., '1, 2, 1')."
        
        SESSION_STORE[sender] = {"canteen_id": canteen.id, "menu_map": menu_map}
        msg.body(reply)
        return str(resp)
        
    # 2. Check if user is in an active ordering session
    session = SESSION_STORE.get(sender)
    if not session:
        msg.body(f"Welcome to Canteen OS Bots! Reply with the word *MENU* to see what's cooking.")
        return str(resp)
        
    # 3. User is ordering items (parsing "1, 2")
    parts = [p.strip() for p in incoming_msg.replace("+", ",").replace("and", ",").split(",")]
    
    order_items = {}
    for part in parts:
        if part in session["menu_map"]:
            mid = session["menu_map"][part]
            order_items[mid] = order_items.get(mid, 0) + 1
            
    if not order_items:
        msg.body("I didn't understand that. Please reply with the menu item numbers like '1, 2' or type MENU to restart.")
        return str(resp)
        
    # 4. Generate the official Order Ticket natively
    from ..models import next_order_token
    token_number = next_order_token(canteen.id)
    
    new_order = Order(
        canteen_id=canteen.id,
        token_number=token_number,
        guest_label=profile_name,
        payment_mode=PaymentMode.cash,
        payment_status=PaymentStatus.pending,
        total=0,
    )
    db.session.add(new_order)
    db.session.flush()

    total_amount = 0
    for mid, qty in order_items.items():
        menu_item = MenuItem.query.get(mid)
        total_amount += float(menu_item.price) * qty
        oi = OrderItem(order_id=new_order.id, menu_item_id=mid, quantity=qty, unit_price=menu_item.price)
        db.session.add(oi)

    new_order.total = total_amount
    db.session.commit()
    
    # 5. Broadcast ticket dynamically to the Kitchen iPads
    serialized = _serialize_order(new_order)
    from flask import current_app
    socketio = current_app.extensions.get("socketio")
    if socketio:
        socketio.emit("new_order", serialized, to=f"canteen_{canteen.id}")
        
    # Clean up session
    del SESSION_STORE[sender]
    
    # 6. Send the Official Ticket to WhatsApp!
    reply = f"✅ *Order Confirmed!*\n\n"
    reply += f"Token: *#{token_number}*\n"
    reply += f"Total: ₹{total_amount:.2f}\n"
    reply += f"Payment Method: Counter Cash\n\n"
    reply += f"Please show Token #{token_number} at the counter to collect your order!"
    
    msg.body(reply)
    return str(resp)
