"""Optional demo seeding.

Creates (if needed) menu items and generates realistic historical orders so:
- Analytics graphs show data
- Forecast pages return suggestions

Run from backend/ (venv active):
  cd backend
  python -c "from seed_demo import run; run()"
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Dict, List

from sqlalchemy import func

from app import create_app
from app.extensions import db
from app.models import (
    Canteen,
    MenuItem,
    Order,
    OrderItem,
    OrderStatus,
    PaymentMode,
    PaymentStatus,
)


@dataclass
class MenuPick:
    item: MenuItem
    qty: int


def _token_for_day(canteen_id: int, day: date) -> int:
    start = datetime.combine(day, datetime.min.time())
    end = start + timedelta(days=1)
    q = (
        db.session.query(func.coalesce(func.max(Order.token_number), 0))
        .filter(Order.canteen_id == canteen_id, Order.created_at >= start, Order.created_at < end)
        .scalar()
    )
    return int(q or 0) + 1


def run():
    random.seed(7)
    app = create_app()

    with app.app_context():
        c = Canteen.query.first()
        if not c:
            print("No canteen found — register an owner in the UI first.")
            return

        # Ensure a few menu items exist
        if MenuItem.query.filter_by(canteen_id=c.id).count() == 0:
            items = [
                ("Samosa", "12"),
                ("Tea", "15"),
                ("Thali", "80"),
                ("Burger", "55"),
                ("Veg Sandwich", "50"),
                ("Coffee", "25"),
            ]
            for name, price in items:
                db.session.add(MenuItem(canteen_id=c.id, name=name, price=Decimal(price), available=True))
            db.session.commit()
            print("Demo menu added for", c.name)

        menu = MenuItem.query.filter_by(canteen_id=c.id, available=True).all()
        if not menu:
            print("No menu items available.")
            return

        # If we already have a lot of orders, don't keep duplicating.
        existing = Order.query.filter_by(canteen_id=c.id).count()
        if existing > 250:
            print("Demo orders already exist (count:", existing, "); skipping.")
            return

        today = date.today()
        days_back = 30

        statuses = [OrderStatus.accepted, OrderStatus.preparing, OrderStatus.ready, OrderStatus.served]
        # Heavier tail for recent days so cook/server queues have content.
        # We'll skew based on age below.

        for dd in range(days_back):
            day = today - timedelta(days=dd)
            day_start = datetime.combine(day, datetime.min.time())
            day_seconds_start = int(day_start.timestamp())

            # Simulate day-level demand variation
            dow = day.weekday()
            base_orders = 6 + (dow in (4, 5) * 3) + (dow == 0) * 1  # Fri/Sat a bit higher
            day_orders = base_orders + random.randint(-2, 6)
            day_orders = max(3, day_orders)

            for _ in range(day_orders):
                # Spread orders through the day
                created_at = datetime.fromtimestamp(
                    day_seconds_start + random.randint(9 * 3600, 19 * 3600)
                )

                # Choose basket size
                basket_size = random.randint(1, min(4, len(menu)))
                picks = random.sample(menu, basket_size)
                line_picks: List[MenuPick] = [MenuPick(item=it, qty=random.randint(1, 3)) for it in picks]

                # Determine status/payment based on recency
                days_ago = (today - day).days
                online_probability = 0.65 + max(0, 10 - days_ago) * 0.01
                is_online = random.random() < min(0.8, online_probability)

                if is_online:
                    # Older orders tend to be served; recent orders more likely in queue.
                    if days_ago >= 10:
                        st = random.choices(
                            [OrderStatus.ready, OrderStatus.served],
                            weights=[0.25, 0.75],
                            k=1,
                        )[0]
                    elif days_ago >= 4:
                        st = random.choices(
                            [OrderStatus.accepted, OrderStatus.preparing, OrderStatus.ready, OrderStatus.served],
                            weights=[0.15, 0.35, 0.35, 0.15],
                            k=1,
                        )[0]
                    else:
                        st = random.choices(
                            [OrderStatus.accepted, OrderStatus.preparing, OrderStatus.ready],
                            weights=[0.35, 0.40, 0.25],
                            k=1,
                        )[0]
                    payment_mode = PaymentMode.upi
                    payment_status = PaymentStatus.paid
                else:
                    # Cash is often pending right away; later it becomes accepted/served.
                    if days_ago >= 8:
                        st = random.choices(
                            [OrderStatus.ready, OrderStatus.served],
                            weights=[0.3, 0.7],
                            k=1,
                        )[0]
                        payment_mode = PaymentMode.cash
                        payment_status = PaymentStatus.paid
                    else:
                        st = random.choices(
                            [OrderStatus.pending_payment, OrderStatus.accepted],
                            weights=[0.7, 0.3],
                            k=1,
                        )[0]
                        payment_mode = PaymentMode.cash
                        payment_status = PaymentStatus.pending if st == OrderStatus.pending_payment else PaymentStatus.paid

                token = _token_for_day(c.id, day)
                total = sum((p.item.price * p.qty) for p in line_picks)

                order = Order(
                    canteen_id=c.id,
                    token_number=token,
                    customer_id=None,
                    guest_label="Demo",
                    status=st,
                    payment_mode=payment_mode,
                    payment_status=payment_status,
                    total=total,
                    created_at=created_at,
                )
                db.session.add(order)
                db.session.flush()

                for p in line_picks:
                    db.session.add(
                        OrderItem(
                            order_id=order.id,
                            menu_item_id=p.item.id,
                            quantity=p.qty,
                            unit_price=p.item.price,
                        )
                    )

        db.session.commit()
        print("Demo orders generated for", c.name)


if __name__ == "__main__":
    run()
