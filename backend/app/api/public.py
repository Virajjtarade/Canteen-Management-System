from flask import Blueprint, jsonify, request
from sqlalchemy import func

from ..extensions import db
from ..models import Canteen, MenuItem, Order, OrderItem

bp = Blueprint("public", __name__, url_prefix="/public")


@bp.route("/canteen/<slug>", methods=["GET"])
def canteen_by_slug(slug):
    c = Canteen.query.filter_by(slug=slug).first()
    if not c:
        return jsonify({"error": "Not found"}), 404
    return jsonify(
        {
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "upi_id": c.upi_id,
        }
    )


@bp.route("/canteen/<slug>/menu", methods=["GET"])
def menu_by_slug(slug):
    c = Canteen.query.filter_by(slug=slug).first()
    if not c:
        return jsonify({"error": "Not found"}), 404

    # Join with order_items to get total quantity ordered per item
    order_count = func.coalesce(func.sum(OrderItem.quantity), 0).label("order_count")
    rows = (
        db.session.query(MenuItem, order_count)
        .outerjoin(OrderItem, OrderItem.menu_item_id == MenuItem.id)
        .filter(MenuItem.canteen_id == c.id)
        .group_by(MenuItem.id)
        .order_by(order_count.desc(), MenuItem.name)
        .all()
    )

    return jsonify(
        {
            "canteen": {"id": c.id, "name": c.name, "slug": c.slug, "upi_id": c.upi_id},
            "items": [
                {
                    "id": i.id,
                    "name": i.name,
                    "price": float(i.price),
                    "image_url": i.image_url or "",
                    "order_count": int(cnt),
                    "available": i.available,
                }
                for i, cnt in rows
            ],
        }
    )


@bp.route("/track", methods=["GET"])
def track_order():
    canteen_id = request.args.get("canteen_id", type=int)
    token = request.args.get("token", type=int)
    if not canteen_id or not token:
        return jsonify({"error": "canteen_id and token required"}), 400

    order = (
        Order.query.filter_by(canteen_id=canteen_id, token_number=token)
        .order_by(Order.created_at.desc())
        .first()
    )
    if not order:
        return jsonify({"error": "Not found"}), 404

    from .orders import _serialize_order

    return jsonify(_serialize_order(order))
