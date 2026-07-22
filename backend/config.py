import os
from pathlib import Path


def _current_env() -> str:
    explicit = os.environ.get("APP_ENV")
    if explicit:
        return explicit.strip().lower()
    if os.environ.get("VERCEL_ENV") == "production":
        return "production"
    return "dev"


def _load_secret_env() -> None:
    path = Path(__file__).resolve().parent / "secrets" / f"{_current_env()}.env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ[key.strip()] = value.strip().strip('"').strip("'")


_load_secret_env()


def _env(name: str, default: str = "") -> str:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


class Settings:
    def __init__(self) -> None:
        self.jwt_secret = _env("JWT_SECRET")
        self.jwt_expire_minutes = int(_env("JWT_EXPIRE_MINUTES", "10080"))

        self.cors_origins = _env("CORS_ORIGINS", "*")

        self.mongodb_uri = _env("MONGODB_URI")


settings = Settings()
