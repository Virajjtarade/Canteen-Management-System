from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from .models import User, UserRole


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            uid = get_jwt_identity()
            user = User.query.get(int(uid))
            if not user or user.role not in roles:
                return jsonify({"error": "Forbidden"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def get_current_user():
    uid = get_jwt_identity()
    if not uid:
        return None
    return User.query.get(int(uid))


def staff_canteen_match(canteen_id: int) -> bool:
    user = get_current_user()
    if not user:
        return False
    if user.role == UserRole.super_admin:
        return True
    if user.role == UserRole.owner:
        from .models import Canteen

        return Canteen.query.filter_by(id=canteen_id, owner_id=user.id).first() is not None
    if user.role in (UserRole.cook, UserRole.server):
        return user.canteen_id == canteen_id
    return False
