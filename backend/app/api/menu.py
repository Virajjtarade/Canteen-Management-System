from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from decimal import Decimal

from ..extensions import db
from ..models import MenuItem, Canteen, User, UserRole

bp = Blueprint("menu", __name__, url_prefix="/menu")


def _can_manage_canteen(user: User, canteen_id: int) -> bool:
    if user.role == UserRole.super_admin:
        return True
    if user.role == UserRole.owner:
        return Canteen.query.filter_by(id=canteen_id, owner_id=user.id).first() is not None
    return False


@bp.route("/canteen/<int:canteen_id>", methods=["GET"])
def get_menu(canteen_id):
    c = Canteen.query.get(canteen_id)
    if not c:
        return jsonify({"error": "Not found"}), 404
    items = MenuItem.query.filter_by(canteen_id=canteen_id).order_by(MenuItem.name).all()
    return jsonify(
        [
            {
                "id": i.id,
                "name": i.name,
                "price": float(i.price),
                "image_url": i.image_url or "",
                "available": i.available,
            }
            for i in items
        ]
    )


@bp.route("/canteen/<int:canteen_id>", methods=["POST"])
@jwt_required()
def add_item(canteen_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or not _can_manage_canteen(user, canteen_id):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    price = data.get("price")
    if not name or price is None:
        return jsonify({"error": "name and price required"}), 400

    item = MenuItem(
        canteen_id=canteen_id,
        name=name,
        price=Decimal(str(price)),
        image_url=(data.get("image_url") or "")[:500],
        available=bool(data.get("available", True)),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(
        {
            "id": item.id,
            "name": item.name,
            "price": float(item.price),
            "image_url": item.image_url,
            "available": item.available,
        }
    ), 201


@bp.route("/item/<int:item_id>", methods=["PATCH", "DELETE"])
@jwt_required()
def item_ops(item_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    item = MenuItem.query.get(item_id)
    if not item:
        return jsonify({"error": "Not found"}), 404

    is_owner_or_admin = _can_manage_canteen(user, item.canteen_id)
    is_cook = (user.role == UserRole.cook and user.canteen_id == item.canteen_id)

    if not is_owner_or_admin and not is_cook:
        return jsonify({"error": "Forbidden"}), 403

    if request.method == "DELETE":
        if not is_owner_or_admin:
            return jsonify({"error": "Forbidden"}), 403
        db.session.delete(item)
        db.session.commit()
        return "", 204

    data = request.get_json(silent=True) or {}
    
    if is_cook and not is_owner_or_admin:
        if set(data.keys()) - {"available"}:
            return jsonify({"error": "Forbidden: Can only manage availability"}), 403
        if "available" in data:
            item.available = bool(data["available"])
    else:
        if "name" in data and data["name"]:
            item.name = data["name"].strip()
        if "price" in data and data["price"] is not None:
            item.price = Decimal(str(data["price"]))
        if "image_url" in data:
            item.image_url = (data["image_url"] or "")[:500]
        if "available" in data:
            item.available = bool(data["available"])

    db.session.commit()
    return jsonify(
        {
            "id": item.id,
            "name": item.name,
            "price": float(item.price),
            "image_url": item.image_url,
            "available": item.available,
        }
    )
