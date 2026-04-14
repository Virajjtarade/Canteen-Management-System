from datetime import date, timedelta
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models import Canteen, Order, OrderItem, MenuItem, User, UserRole, CalendarEvent

bp = Blueprint("forecast", __name__, url_prefix="/forecast")


def _can_view(canteen_id: int, user: User) -> bool:
    if user.role == UserRole.super_admin:
        return True
    c = Canteen.query.get(canteen_id)
    return bool(c and user.role == UserRole.owner and c.owner_id == user.id)


@bp.route("/canteen/<int:canteen_id>", methods=["GET"])
@jwt_required()
def demand_forecast(canteen_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or not _can_view(canteen_id, user):
        return jsonify({"error": "Forbidden"}), 403

    target = request.args.get("date")
    try:
        target_day = date.fromisoformat(target) if target else date.today() + timedelta(days=1)
    except ValueError:
        target_day = date.today() + timedelta(days=1)

    dow = target_day.weekday()

    from ..extensions import db
    from sqlalchemy import func

    # Historical same weekday last 8 weeks
    start_hist = date.today() - timedelta(weeks=8)
    # Count how many weeks of matching weekday data we have
    week_count_q = (
        db.session.query(func.count(func.distinct(func.date(Order.created_at))))
        .filter(
            Order.canteen_id == canteen_id,
            func.date(Order.created_at) >= start_hist,
            func.extract("dow", Order.created_at) == dow,
        )
        .scalar()
    )
    num_weeks = max(week_count_q or 1, 1)

    rows = (
        db.session.query(MenuItem.name, func.sum(OrderItem.quantity).label("qty"))
        .join(OrderItem, OrderItem.menu_item_id == MenuItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(
            Order.canteen_id == canteen_id,
            func.date(Order.created_at) >= start_hist,
            func.extract("dow", Order.created_at) == dow,
        )
        .group_by(MenuItem.id, MenuItem.name)
        .all()
    )

    if not rows:
        return jsonify(
            {
                "target_date": target_day.isoformat(),
                "day_of_week": dow,
                "suggestions": [],
                "note": "Not enough history for this day of week; add more orders.",
            }
        )

    # Average per week instead of raw sums
    total_qty = sum(int(q or 0) for _, q in rows) or 1
    ranked = sorted(((n, round(int(q or 0) / num_weeks)) for n, q in rows), key=lambda x: -x[1])[:15]

    mult = 1.0
    ev = CalendarEvent.query.filter_by(canteen_id=canteen_id, event_date=target_day).first()
    if ev:
        mult = float(ev.demand_multiplier or 1.0)

    suggestions = [
        {
            "item": name,
            "estimated_portions": max(1, round(q * mult * (1 + (dow % 3) * 0.05))),
            "reason": "Based on historical totals and calendar multiplier",
        }
        for name, q in ranked[:8]
    ]

    return jsonify(
        {
            "target_date": target_day.isoformat(),
            "day_of_week": dow,
            "calendar_multiplier": mult,
            "suggestions": suggestions,
        }
    )
