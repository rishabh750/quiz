import os


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
