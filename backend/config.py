import os
import warnings
from datetime import timedelta

_BASE = os.path.abspath(os.path.dirname(__file__))
_INSTANCE = os.path.join(_BASE, "instance")
os.makedirs(_INSTANCE, exist_ok=True)
_DEFAULT_SQLITE = "sqlite:///" + os.path.join(_INSTANCE, "canteen.db")

_DEV_SECRET = os.urandom(32).hex()


def _get_secret(env_key: str) -> str:
    val = os.environ.get(env_key)
    if not val:
        warnings.warn(
            f"⚠️  {env_key} is not set! Using a random dev key. "
            "Set this environment variable in production.",
            stacklevel=2,
        )
        return _DEV_SECRET
    return val


class Config:
    SECRET_KEY = _get_secret("SECRET_KEY")
    JWT_SECRET_KEY = _get_secret("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.environ.get("JWT_ACCESS_HOURS", "24")))
    db_url = os.environ.get("DATABASE_URL", _DEFAULT_SQLITE)
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
