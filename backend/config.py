"""Environment-driven settings. Everything is optional — the app runs with zero
config (in-memory store; stable built-in defaults for the JWT secret and RSA
transport keypair, overridable via env)."""
import os


def _env(name: str, default: str = "") -> str:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


class Settings:
    def __init__(self) -> None:
        # Auth / crypto. Unset -> stable built-in defaults (see security.py /
        # crypto.py). Override in production.
        self.jwt_secret = _env("JWT_SECRET")
        self.jwt_expire_minutes = int(_env("JWT_EXPIRE_MINUTES", "10080"))
        self.rsa_private_key_pem = _env("RSA_PRIVATE_KEY")  # PEM, optional

        self.cors_origins = _env("CORS_ORIGINS", "*")


settings = Settings()
