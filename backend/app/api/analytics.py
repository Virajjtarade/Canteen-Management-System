from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, extract

from ..extensions import db
from ..models import Canteen, Order, OrderItem, MenuItem, User, UserRole

bp = Blueprint("analytics", __name__, url_prefix="/analytics")


def _parse_range():
    preset = (request.args.get("range") or "week").lower()
    end = datetime.utcnow()
    if preset == "day":
        start = end - timedelta(days=1)
    elif preset == "week":
        start = end - timedelta(days=7)
    elif preset == "fortnight":
        start = end - timedelta(days=14)
    elif preset == "month":
        start = end - timedelta(days=30)
    elif preset == "year":
        start = end - timedelta(days=365)
    elif preset == "custom":
        try:
            start = datetime.fromisoformat(request.args.get("start", "").replace("Z", "+00:00"))
            end = datetime.fromisoformat(request.args.get("end", "").replace("Z", "+00:00"))
        except Exception:
            start = end - timedelta(days=7)
    else:
        start = end - timedelta(days=7)
    return start, end


def _can_view(canteen_id: int, user: User) -> bool:
    if user.role == UserRole.super_admin:
        return True
    c = Canteen.query.get(canteen_id)
    if not c:
        return False
    if user.role == UserRole.owner and c.owner_id == user.id:
        return True
    return False


@bp.route("/canteen/<int:canteen_id>/summary", methods=["GET"])
@jwt_required()
def summary(canteen_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or not _can_view(canteen_id, user):
        return jsonify({"error": "Forbidden"}), 403

    start, end = _parse_range()

    revenue = (
        db.session.query(func.coalesce(func.sum(Order.total), 0))
        .filter(
            Order.canteen_id == canteen_id,
            Order.created_at >= start,
            Order.created_at <= end,
        )
        .scalar()
    )

    order_count = (
        Order.query.filter(
            Order.canteen_id == canteen_id,
            Order.created_at >= start,
            Order.created_at <= end,
        ).count()
    )

    top_items = (
        db.session.query(MenuItem.name, func.sum(OrderItem.quantity).label("qty"))
        .join(OrderItem, OrderItem.menu_item_id == MenuItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(
            Order.canteen_id == canteen_id,
            Order.created_at >= start,
            Order.created_at <= end,
        )
        .group_by(MenuItem.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(10)
        .all()
    )

    hourly = (
        db.session.query(extract("hour", Order.created_at), func.count(Order.id))
        .filter(
            Order.canteen_id == canteen_id,
            Order.created_at >= start,
            Order.created_at <= end,
        )
        .group_by(extract("hour", Order.created_at))
        .all()
    )

    return jsonify(
        {
            "range": {"start": start.isoformat() + "Z", "end": end.isoformat() + "Z"},
            "revenue": float(revenue or 0),
            "order_count": order_count,
            "top_items": [{"name": n, "quantity": int(q or 0)} for n, q in top_items],
            "peak_hours": [{"hour": int(h or 0), "orders": c} for h, c in hourly],
        }
    )


@bp.route("/canteen/<int:canteen_id>/export.csv", methods=["GET"])
@jwt_required()
def export_csv(canteen_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or not _can_view(canteen_id, user):
        return jsonify({"error": "Forbidden"}), 403

    start, end = _parse_range()
    orders = (
        Order.query.filter(
            Order.canteen_id == canteen_id,
            Order.created_at >= start,
            Order.created_at <= end,
        )
        .order_by(Order.created_at)
        .all()
    )

    lines = ["id,token,status,total,created_at,payment_mode"]
    for o in orders:
        lines.append(
            f"{o.id},{o.token_number},{o.status.value},{float(o.total)},{o.created_at.isoformat()},{o.payment_mode.value}"
        )
    from flask import Response

    return Response(
        "\n".join(lines),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=orders_{canteen_id}.csv"},
    )
