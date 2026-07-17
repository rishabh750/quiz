"""Environment-driven settings. Everything is optional — the app runs with zero
config (in-memory store, generated secrets, a seeded default account)."""
import os


def _env(name: str, default: str = "") -> str:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


class Settings:
    def __init__(self) -> None:
        # Auth / crypto. When unset these are generated per process (fine for a
        # single instance; set them in the environment for multi-instance stability).
        self.jwt_secret = _env("JWT_SECRET")
        self.jwt_expire_minutes = int(_env("JWT_EXPIRE_MINUTES", "10080"))
        self.rsa_private_key_pem = _env("RSA_PRIVATE_KEY")  # PEM, optional

        self.cors_origins = _env("CORS_ORIGINS", "*")

        # Seeded default account (created on startup in every instance).
        self.default_user_email = _env("DEFAULT_USER_EMAIL", "admin@interviewprep.app")
        self.default_user_password = _env("DEFAULT_USER_PASSWORD", "interviewprep")
        self.default_user_provider = _env("DEFAULT_USER_PROVIDER", "gemini")
        self.default_user_api_key = _env("DEFAULT_USER_API_KEY", "")


settings = Settings()
