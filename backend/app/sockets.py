from flask_socketio import join_room, leave_room, disconnect
from flask_jwt_extended import decode_token

from .extensions import socketio


@socketio.on("connect")
def on_connect(auth):
    pass


@socketio.on("join_canteen")
def on_join(data):
    token = (data or {}).get("token")
    room = (data or {}).get("canteen_id")
    if not room:
        disconnect()
        return
    if token:
        try:
            decode_token(token)
        except Exception:
            disconnect()
            return
    join_room(f"canteen_{room}")


@socketio.on("leave_canteen")
def on_leave(data):
    room = (data or {}).get("canteen_id")
    if room:
        leave_room(f"canteen_{room}")
