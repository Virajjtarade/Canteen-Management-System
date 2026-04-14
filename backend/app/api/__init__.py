from flask import Blueprint

api_bp = Blueprint("api", __name__, url_prefix="/api")


def register_api(app):
    from . import auth, canteens, menu, orders, analytics, forecast, recommendations, calendar, public, whatsapp

    api_bp.register_blueprint(auth.bp)
    api_bp.register_blueprint(canteens.bp)
    api_bp.register_blueprint(menu.bp)
    api_bp.register_blueprint(orders.bp)
    api_bp.register_blueprint(analytics.bp)
    api_bp.register_blueprint(forecast.bp)
    api_bp.register_blueprint(recommendations.bp)
    api_bp.register_blueprint(calendar.bp)
    api_bp.register_blueprint(public.bp)
    api_bp.register_blueprint(whatsapp.bp)
    app.register_blueprint(api_bp)
