from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import CalendarEvent, Canteen, User, UserRole

bp = Blueprint("calendar", __name__, url_prefix="/calendar")


def _owner_ok(canteen_id: int, user: User) -> bool:
    if user.role == UserRole.super_admin:
        return True
    c = Canteen.query.get(canteen_id)
    return bool(c and user.role == UserRole.owner and c.owner_id == user.id)


@bp.route("/canteen/<int:canteen_id>", methods=["GET"])
@jwt_required()
def list_events(canteen_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or not _owner_ok(canteen_id, user):
        return jsonify({"error": "Forbidden"}), 403

    rows = CalendarEvent.query.filter_by(canteen_id=canteen_id).order_by(CalendarEvent.event_date).all()
    return jsonify(
        [
            {
                "id": e.id,
                "event_date": e.event_date.isoformat(),
                "title": e.title,
                "demand_multiplier": e.demand_multiplier,
            }
            for e in rows
        ]
    )


@bp.route("/canteen/<int:canteen_id>", methods=["POST"])
@jwt_required()
def add_event(canteen_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or not _owner_ok(canteen_id, user):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    try:
        d = datetime.fromisoformat(data.get("event_date", "").replace("Z", "")).date()
    except Exception:
        return jsonify({"error": "event_date (ISO) required"}), 400

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400

    mult = float(data.get("demand_multiplier") or 1.0)
    e = CalendarEvent(canteen_id=canteen_id, event_date=d, title=title, demand_multiplier=mult)
    db.session.add(e)
    db.session.commit()
    return jsonify({"id": e.id, "event_date": e.event_date.isoformat(), "title": e.title}), 201
