from decimal import Decimal
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request

from ..extensions import db, socketio
from ..models import (
    Order,
    OrderItem,
    MenuItem,
    Canteen,
    User,
    UserRole,
    OrderStatus,
    PaymentMode,
    PaymentStatus,
    next_order_token,
)

bp = Blueprint("orders", __name__, url_prefix="/orders")


@bp.route("/mine", methods=["GET"])
@jwt_required()
def my_orders_all():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or user.role != UserRole.customer:
        return jsonify({"error": "Forbidden"}), 403
    orders = (
        Order.query.filter_by(customer_id=user.id)
        .order_by(Order.created_at.desc())
        .limit(100)
        .all()
    )
    return jsonify([_serialize_order(o) for o in orders])


def _serialize_order(o: Order):
    return {
        "id": o.id,
        "canteen_id": o.canteen_id,
        "token_number": o.token_number,
        "customer_id": o.customer_id,
        "guest_label": o.guest_label or "",
        "status": o.status.value,
        "payment_mode": o.payment_mode.value,
        "payment_status": o.payment_status.value,
        "total": float(o.total),
        "created_at": o.created_at.isoformat() + "Z",
        "items": [
            {
                "menu_item_id": li.menu_item_id,
                "name": li.menu_item.name if li.menu_item else "",
                "quantity": li.quantity,
                "unit_price": float(li.unit_price),
            }
            for li in o.items
        ],
    }


def _emit_order(canteen_id: int, event: str, payload: dict):
    socketio.emit(event, payload, room=f"canteen_{canteen_id}")


@bp.route("/canteen/<int:canteen_id>", methods=["GET"])
@jwt_required()
def list_orders(canteen_id):
    """Staff/owner see all; customer sees own."""
    status = request.args.get("status")
    query = Order.query.filter_by(canteen_id=canteen_id)
    if status:
        try:
            query = query.filter_by(status=OrderStatus(status))
        except ValueError:
            pass

    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if user.role == UserRole.customer:
        query = query.filter(Order.customer_id == user.id)
    elif user.role in (UserRole.cook, UserRole.server):
        if user.canteen_id != canteen_id:
            return jsonify({"error": "Forbidden"}), 403
    elif user.role == UserRole.owner:
        c = Canteen.query.get(canteen_id)
        if not c or c.owner_id != user.id:
            return jsonify({"error": "Forbidden"}), 403
    elif user.role == UserRole.super_admin:
        pass
    else:
        return jsonify({"error": "Forbidden"}), 403

    orders = query.order_by(Order.created_at.desc()).limit(200).all()
    return jsonify([_serialize_order(o) for o in orders])


@bp.route("/canteen/<int:canteen_id>", methods=["POST"])
def create_order(canteen_id):
    """Authenticated customer or guest (no JWT)."""
    data = request.get_json(silent=True) or {}
    items_in = data.get("items") or []
    payment_mode_str = (data.get("payment_mode") or "cash").lower()
    guest_label = (data.get("guest_label") or "").strip()[:80]

    try:
        pmode = PaymentMode(payment_mode_str)
    except ValueError:
        pmode = PaymentMode.cash

    c = Canteen.query.get(canteen_id)
    if not c:
        return jsonify({"error": "Canteen not found"}), 404

    if not items_in:
        return jsonify({"error": "items required"}), 400

    customer_id = None
    verify_jwt_in_request(optional=True)
    from flask_jwt_extended import get_jwt_identity

    uid = get_jwt_identity()
    if uid:
        u = User.query.get(int(uid))
        if u and u.role == UserRole.customer:
            customer_id = u.id

    total = Decimal("0")
    line_specs = []
    for row in items_in:
        mid = row.get("menu_item_id")
        qty = int(row.get("quantity") or 1)
        if qty < 1:
            continue
        mi = MenuItem.query.filter_by(id=mid, canteen_id=canteen_id).first()
        if not mi or not mi.available:
            return jsonify({"error": f"Invalid or unavailable item {mid}"}), 400
        unit = Decimal(str(mi.price))
        total += unit * qty
        line_specs.append((mi, qty, unit))

    if total <= 0:
        return jsonify({"error": "No valid lines"}), 400

    token = next_order_token(canteen_id)

    if pmode in (PaymentMode.upi, PaymentMode.online):
        pay_status = PaymentStatus.paid
        ostatus = OrderStatus.accepted
    else:
        pay_status = PaymentStatus.pending
        ostatus = OrderStatus.pending_payment

    order = Order(
        canteen_id=canteen_id,
        token_number=token,
        customer_id=customer_id,
        guest_label=guest_label,
        status=ostatus,
        payment_mode=pmode,
        payment_status=pay_status,
        total=total,
    )
    db.session.add(order)
    db.session.flush()

    for mi, qty, unit in line_specs:
        db.session.add(
            OrderItem(order_id=order.id, menu_item_id=mi.id, quantity=qty, unit_price=unit)
        )

    db.session.commit()
    payload = _serialize_order(order)
    _emit_order(canteen_id, "order_new", payload)
    return jsonify(payload), 201


@bp.route("/<int:order_id>/status", methods=["PATCH"])
@jwt_required()
def patch_status(order_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if not new_status:
        return jsonify({"error": "status required"}), 400

    try:
        st = OrderStatus(new_status)
    except ValueError:
        return jsonify({"error": "invalid status"}), 400

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Not found"}), 404

    cid = order.canteen_id
    if user.role == UserRole.cook:
        if user.canteen_id != cid:
            return jsonify({"error": "Forbidden"}), 403
        if st not in (OrderStatus.preparing, OrderStatus.ready):
            return jsonify({"error": "Cook can only set preparing or ready"}), 403
    elif user.role == UserRole.server:
        if user.canteen_id != cid:
            return jsonify({"error": "Forbidden"}), 403
        if st != OrderStatus.served:
            return jsonify({"error": "Server can only mark served"}), 403
    elif user.role == UserRole.owner:
        c = Canteen.query.get(cid)
        if not c or c.owner_id != user.id:
            return jsonify({"error": "Forbidden"}), 403
    elif user.role == UserRole.super_admin:
        pass
    else:
        return jsonify({"error": "Forbidden"}), 403

    order.status = st
    db.session.commit()
    payload = _serialize_order(order)
    _emit_order(cid, "order_update", payload)
    return jsonify(payload)


@bp.route("/<int:order_id>/payment", methods=["PATCH"])
@jwt_required()
def patch_payment(order_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Not found"}), 404

    c = Canteen.query.get(order.canteen_id)
    if not c or user.role not in (UserRole.owner, UserRole.super_admin) or (
        user.role == UserRole.owner and c.owner_id != user.id
    ):
        if user.role != UserRole.super_admin:
            return jsonify({"error": "Forbidden"}), 403

    # Payment updates are only relevant for cash orders.
    # UPI/online orders are created as already paid and move directly to kitchen.
    data = request.get_json(silent=True) or {}
    if data.get("payment_status") == "paid":
        order.payment_status = PaymentStatus.paid
        if order.status == OrderStatus.pending_payment:
            order.status = OrderStatus.accepted
    db.session.commit()
    payload = _serialize_order(order)
    _emit_order(order.canteen_id, "order_update", payload)
    return jsonify(payload)


@bp.route("/counter/<int:canteen_id>", methods=["POST"])
@jwt_required()
def counter_order(canteen_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    c = Canteen.query.get(canteen_id)
    if not c or user.role not in (UserRole.owner, UserRole.super_admin) or (
        user.role == UserRole.owner and c.owner_id != user.id
    ):
        if user.role != UserRole.super_admin:
            return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    items_in = data.get("items") or []
    payment_mode_str = (data.get("payment_mode") or "cash").lower()
    try:
        pmode = PaymentMode(payment_mode_str)
    except ValueError:
        pmode = PaymentMode.cash

    total = Decimal("0")
    line_specs = []
    for row in items_in:
        mid = row.get("menu_item_id")
        qty = int(row.get("quantity") or 1)
        mi = MenuItem.query.filter_by(id=mid, canteen_id=canteen_id).first()
        if not mi or not mi.available:
            continue
        unit = Decimal(str(mi.price))
        total += unit * qty
        line_specs.append((mi, qty, unit))

    if not line_specs:
        return jsonify({"error": "No items"}), 400

    token = next_order_token(canteen_id)
    pay_status = PaymentStatus.paid if pmode != PaymentMode.cash else PaymentStatus.pending
    ostatus = OrderStatus.accepted if pay_status == PaymentStatus.paid else OrderStatus.pending_payment

    order = Order(
        canteen_id=canteen_id,
        token_number=token,
        customer_id=None,
        guest_label="Counter",
        status=ostatus,
        payment_mode=pmode,
        payment_status=pay_status,
        total=total,
    )
    db.session.add(order)
    db.session.flush()
    for mi, qty, unit in line_specs:
        db.session.add(
            OrderItem(order_id=order.id, menu_item_id=mi.id, quantity=qty, unit_price=unit)
        )
    db.session.commit()
    payload = _serialize_order(order)
    _emit_order(canteen_id, "order_new", payload)
    return jsonify(payload), 201
