import os
from flask import Flask, send_from_directory

from config import Config
from .extensions import db, jwt, cors, migrate, socketio
from .api import register_api


def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    allowed = app.config.get("CORS_ORIGINS", "*")
    cors.init_app(app, resources={r"/api/*": {"origins": allowed}, r"/socket.io/*": {"origins": allowed}})
    socketio.init_app(app, cors_allowed_origins=allowed)

    register_api(app)

    from . import models  # noqa: F401
    from . import sockets  # noqa: F401

    with app.app_context():
        os.makedirs(
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance"),
            exist_ok=True,
        )

    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend", "dist")
    frontend_dist = os.path.abspath(frontend_dist)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path and os.path.isfile(os.path.join(frontend_dist, path)):
            return send_from_directory(frontend_dist, path)
        index = os.path.join(frontend_dist, "index.html")
        if os.path.isfile(index):
            return send_from_directory(frontend_dist, "index.html")
        return {"message": "Build frontend (npm run build) or run Vite dev server on :5173"}, 503

    @app.cli.command("init-db")
    def init_db():
        os.makedirs(os.path.join(os.path.dirname(__file__), "..", "instance"), exist_ok=True)
        db.create_all()
        print("Database tables created.")

    return app
