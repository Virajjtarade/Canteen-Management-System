
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from ..extensions import db
from ..models import User, UserRole, Canteen
from ..utils import slugify as _slugify

bp = Blueprint("auth", __name__, url_prefix="/auth")


@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()
    role_str = (data.get("role") or "customer").lower()
    canteen_name = (data.get("canteen_name") or "").strip()

    if not email or not password or not name:
        return jsonify({"error": "email, password, and name are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    try:
        role = UserRole(role_str)
    except ValueError:
        role = UserRole.customer

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(email=email, name=name, role=role)
    user.set_password(password)

    if role in (UserRole.cook, UserRole.server):
        cid = data.get("canteen_id")
        if not cid:
            return jsonify({"error": "canteen_id required for staff"}), 400
        if not Canteen.query.get(int(cid)):
            return jsonify({"error": "Invalid canteen"}), 400
        user.canteen_id = int(cid)

    db.session.add(user)
    db.session.flush()

    if role == UserRole.owner:
        if not canteen_name:
            canteen_name = f"{name}'s Canteen"
        base = _slugify(canteen_name)
        slug = base
        n = 1
        while Canteen.query.filter_by(slug=slug).first():
            slug = f"{base}-{n}"
            n += 1
        c = Canteen(name=canteen_name, slug=slug, owner_id=user.id)
        db.session.add(c)
        db.session.flush()
        user.canteen_id = c.id

    db.session.commit()

    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role.value})
    return jsonify(
        {
            "access_token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role.value,
                "canteen_id": user.canteen_id,
            },
        }
    ), 201


@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role.value})
    return jsonify(
        {
            "access_token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role.value,
                "canteen_id": user.canteen_id,
            },
        }
    )


@bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    uid = get_jwt_identity()
    user = User.query.get(int(uid))
    if not user:
        return jsonify({"error": "Not found"}), 404
    return jsonify(
        {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role.value,
            "canteen_id": user.canteen_id,
        }
    )
