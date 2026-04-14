from collections import defaultdict
from datetime import datetime, timedelta, timezone
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models import Canteen, Order, MenuItem, User, UserRole

bp = Blueprint("recommendations", __name__, url_prefix="/recommendations")


def _pairs_for_canteen(canteen_id: int):
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    orders = (
        Order.query.filter(
            Order.canteen_id == canteen_id,
            Order.created_at >= cutoff,
        )
        .order_by(Order.created_at.desc())
        .limit(500)
        .all()
    )
    pair_counts = defaultdict(int)
    item_totals = defaultdict(int)

    for o in orders:
        mids = sorted({li.menu_item_id for li in o.items})
        for i in mids:
            item_totals[i] += 1
        for a in range(len(mids)):
            for b in range(a + 1, len(mids)):
                pair = (mids[a], mids[b])
                pair_counts[pair] += 1

    return pair_counts, item_totals


@bp.route("/canteen/<int:canteen_id>", methods=["GET"])
@jwt_required()
def recommend(canteen_id):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "Forbidden"}), 403
    c = Canteen.query.get(canteen_id)
    if not c:
        return jsonify({"error": "Not found"}), 404
    if user.role == UserRole.customer:
        pass
    elif user.role == UserRole.super_admin:
        pass
    elif user.role == UserRole.owner and c.owner_id == user.id:
        pass
    else:
        return jsonify({"error": "Forbidden"}), 403

    seed = request.args.get("menu_item_id", type=int)
    pair_counts, item_totals = _pairs_for_canteen(canteen_id)

    names = {m.id: m.name for m in MenuItem.query.filter_by(canteen_id=canteen_id).all()}

    if seed:
        related = []
        for (a, b), cnt in pair_counts.items():
            if a == seed:
                related.append((b, cnt))
            elif b == seed:
                related.append((a, cnt))
        related.sort(key=lambda x: -x[1])
        return jsonify(
            {
                "based_on_menu_item_id": seed,
                "also_ordered": [
                    {"menu_item_id": mid, "name": names.get(mid, ""), "score": c}
                    for mid, c in related[:10]
                ],
            }
        )

    top_pairs = sorted(pair_counts.items(), key=lambda x: -x[1])[:15]
    return jsonify(
        {
            "popular_pairs": [
                {
                    "a": names.get(a, ""),
                    "b": names.get(b, ""),
                    "count": cnt,
                }
                for (a, b), cnt in top_pairs
            ]
        }
    )
