from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import Canteen, User, UserRole
from ..utils import slugify as _slugify

bp = Blueprint("canteens", __name__, url_prefix="/canteens")





def _owner_canteens(user_id: int):
    return Canteen.query.filter_by(owner_id=user_id).all()


@bp.route("", methods=["GET"])
def list_canteens():
    q = (request.args.get("q") or "").strip().lower()
    query = Canteen.query
    if q:
        safe_q = q.replace("%", r"\%").replace("_", r"\_")
        query = query.filter(Canteen.name.ilike(f"%{safe_q}%"))
    rows = query.order_by(Canteen.name).all()
    return jsonify(
        [
            {
                "id": c.id,
                "name": c.name,
                "slug": c.slug,
                "upi_id": c.upi_id,
                "whatsapp_number": c.whatsapp_number,
            }
            for c in rows
        ]
    )


@bp.route("/mine", methods=["GET"])
@jwt_required()
def my_canteens():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "Forbidden"}), 403
    if user.role == UserRole.super_admin:
        rows = Canteen.query.all()
    elif user.role == UserRole.owner:
        rows = _owner_canteens(uid)
    else:
        return jsonify({"error": "Forbidden"}), 403
    return jsonify(
        [
            {
                "id": c.id,
                "name": c.name,
                "slug": c.slug,
                "upi_id": c.upi_id,
                "whatsapp_number": c.whatsapp_number,
            }
            for c in rows
        ]
    )


@bp.route("", methods=["POST"])
@jwt_required()
def create_canteen():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or user.role not in (UserRole.owner, UserRole.super_admin):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400

    owner_id = data.get("owner_id") or uid
    if user.role != UserRole.super_admin:
        owner_id = uid

    base = _slugify(name)
    slug = base
    n = 1
    while Canteen.query.filter_by(slug=slug).first():
        slug = f"{base}-{n}"
        n += 1

    c = Canteen(name=name, slug=slug, owner_id=int(owner_id), upi_id=(data.get("upi_id") or ""), whatsapp_number=(data.get("whatsapp_number") or ""))
    db.session.add(c)
    db.session.commit()
    return jsonify({"id": c.id, "name": c.name, "slug": c.slug, "upi_id": c.upi_id, "whatsapp_number": c.whatsapp_number}), 201


@bp.route("/<int:canteen_id>", methods=["PATCH"])
@jwt_required()
def update_canteen(canteen_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    c = Canteen.query.get(canteen_id)
    if not c:
        return jsonify({"error": "Not found"}), 404
    if user.role != UserRole.super_admin and c.owner_id != uid:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    if "name" in data and data["name"]:
        c.name = data["name"].strip()
    if "upi_id" in data:
        c.upi_id = data["upi_id"] or ""
    if "whatsapp_number" in data:
        c.whatsapp_number = data["whatsapp_number"] or ""
    db.session.commit()
    return jsonify({"id": c.id, "name": c.name, "slug": c.slug, "upi_id": c.upi_id, "whatsapp_number": c.whatsapp_number})


@bp.route("/<int:canteen_id>/staff", methods=["GET", "POST"])
@jwt_required()
def staff(canteen_id):
    uid = int(get_jwt_identity())
    owner = User.query.get(uid)
    c = Canteen.query.get(canteen_id)
    if not c:
        return jsonify({"error": "Not found"}), 404
    if not owner or owner.role not in (UserRole.owner, UserRole.super_admin):
        return jsonify({"error": "Forbidden"}), 403
    if owner.role == UserRole.owner and c.owner_id != owner.id:
        return jsonify({"error": "Forbidden"}), 403

    if request.method == "GET":
        staff_users = (
            User.query.filter(
                User.canteen_id == canteen_id, User.role.in_([UserRole.cook, UserRole.server])
            )
            .order_by(User.created_at.desc())
            .all()
        )
        return jsonify(
            [
                {
                    "id": u.id,
                    "email": u.email,
                    "name": u.name,
                    "role": u.role.value,
                    "created_at": u.created_at.isoformat() + "Z",
                }
                for u in staff_users
            ]
        )

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()
    role_str = (data.get("role") or "cook").lower()
    if not email or not password or not name:
        return jsonify({"error": "email, password, name required"}), 400
    try:
        role = UserRole(role_str)
    except ValueError:
        return jsonify({"error": "role must be cook or server"}), 400
    if role not in (UserRole.cook, UserRole.server):
        return jsonify({"error": "role must be cook or server"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email taken"}), 409

    u = User(email=email, name=name, role=role, canteen_id=canteen_id)
    u.set_password(password)
    db.session.add(u)
    db.session.commit()
    return jsonify(
        {"id": u.id, "email": u.email, "name": u.name, "role": u.role.value, "created_at": u.created_at.isoformat() + "Z"}
    ), 201


@bp.route("/<int:canteen_id>/staff/<int:user_id>", methods=["PATCH"])
@jwt_required()
def update_staff_role(canteen_id, user_id):
    uid = int(get_jwt_identity())
    owner = User.query.get(uid)
    c = Canteen.query.get(canteen_id)
    if not c:
        return jsonify({"error": "Not found"}), 404
    if not owner or owner.role not in (UserRole.owner, UserRole.super_admin):
        return jsonify({"error": "Forbidden"}), 403
    if owner.role == UserRole.owner and c.owner_id != owner.id:
        return jsonify({"error": "Forbidden"}), 403

    staff_user = User.query.get(user_id)
    if not staff_user or staff_user.canteen_id != canteen_id:
        return jsonify({"error": "Not found"}), 404

    data = request.get_json(silent=True) or {}
    role_str = (data.get("role") or "").lower()
    try:
        role = UserRole(role_str)
    except ValueError:
        return jsonify({"error": "role must be cook or server"}), 400
    if role not in (UserRole.cook, UserRole.server):
        return jsonify({"error": "role must be cook or server"}), 400

    staff_user.role = role
    db.session.commit()
    return jsonify(
        {
            "id": staff_user.id,
            "email": staff_user.email,
            "name": staff_user.name,
            "role": staff_user.role.value,
            "created_at": staff_user.created_at.isoformat() + "Z",
        }
    )


@bp.route("/<int:canteen_id>/qr", methods=["GET"])
def qr_url(canteen_id):
    c = Canteen.query.get(canteen_id)
    if not c:
        return jsonify({"error": "Not found"}), 404
    base = request.host_url.rstrip("/")
    url = f"{base}/menu/{c.slug}"
    return jsonify({"url": url, "slug": c.slug, "canteen_id": c.id})
