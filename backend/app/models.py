from datetime import datetime, date, timezone
from enum import Enum as PyEnum

from werkzeug.security import generate_password_hash, check_password_hash

from .extensions import db


class UserRole(str, PyEnum):
    customer = "customer"
    owner = "owner"
    cook = "cook"
    server = "server"
    super_admin = "super_admin"


class OrderStatus(str, PyEnum):
    pending_payment = "pending_payment"
    accepted = "accepted"
    preparing = "preparing"
    ready = "ready"
    served = "served"
    cancelled = "cancelled"


class PaymentMode(str, PyEnum):
    cash = "cash"
    upi = "upi"
    online = "online"


class PaymentStatus(str, PyEnum):
    pending = "pending"
    paid = "paid"


def _utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.customer)
    canteen_id = db.Column(db.Integer, db.ForeignKey("canteens.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow)

    canteen = db.relationship("Canteen", back_populates="staff_users", foreign_keys=[canteen_id])

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class Canteen(db.Model):
    __tablename__ = "canteens"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(120), unique=True, nullable=False, index=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    upi_id = db.Column(db.String(120), default="")
    whatsapp_number = db.Column(db.String(20), default="")
    created_at = db.Column(db.DateTime, default=_utcnow)

    owner = db.relationship("User", foreign_keys=[owner_id])
    staff_users = db.relationship("User", back_populates="canteen", foreign_keys="User.canteen_id")
    menu_items = db.relationship("MenuItem", back_populates="canteen", lazy="dynamic")
    orders = db.relationship("Order", back_populates="canteen", lazy="dynamic")


class MenuItem(db.Model):
    __tablename__ = "menu_items"

    id = db.Column(db.Integer, primary_key=True)
    canteen_id = db.Column(db.Integer, db.ForeignKey("canteens.id"), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    image_url = db.Column(db.String(500), default="")
    available = db.Column(db.Boolean, default=True)

    canteen = db.relationship("Canteen", back_populates="menu_items")


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    canteen_id = db.Column(db.Integer, db.ForeignKey("canteens.id"), nullable=False)
    token_number = db.Column(db.Integer, nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    guest_label = db.Column(db.String(80), default="")
    status = db.Column(db.Enum(OrderStatus), nullable=False, default=OrderStatus.pending_payment)
    payment_mode = db.Column(db.Enum(PaymentMode), nullable=False)
    payment_status = db.Column(db.Enum(PaymentStatus), nullable=False, default=PaymentStatus.pending)
    total = db.Column(db.Numeric(12, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=_utcnow, index=True)

    canteen = db.relationship("Canteen", back_populates="orders")
    customer = db.relationship("User", foreign_keys=[customer_id])
    items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    menu_item_id = db.Column(db.Integer, db.ForeignKey("menu_items.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)

    order = db.relationship("Order", back_populates="items")
    menu_item = db.relationship("MenuItem")


class CalendarEvent(db.Model):
    __tablename__ = "calendar_events"

    id = db.Column(db.Integer, primary_key=True)
    canteen_id = db.Column(db.Integer, db.ForeignKey("canteens.id"), nullable=True)
    event_date = db.Column(db.Date, nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    demand_multiplier = db.Column(db.Float, default=1.0)


def next_order_token(canteen_id: int) -> int:
    """Daily token sequence per canteen — uses row-level locking to prevent duplicates."""
    from sqlalchemy import func

    today_start = datetime.combine(date.today(), datetime.min.time())
    q = (
        db.session.query(func.coalesce(func.max(Order.token_number), 0))
        .filter(Order.canteen_id == canteen_id, Order.created_at >= today_start)
        .with_for_update()
        .scalar()
    )
    return int(q or 0) + 1
