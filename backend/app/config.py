import base64
import hashlib
import os

from cryptography.fernet import Fernet
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://") :]
    return url


def _gen_fernet_key() -> str:
    return Fernet.generate_key().decode()


def _derive_key(secret: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()).decode()


def _persisted_secret(directory: str, name: str, generate) -> str:
    path = os.path.join(directory, name)
    try:
        if os.path.exists(path):
            with open(path) as f:
                value = f.read().strip()
                if value:
                    return value
        os.makedirs(directory, exist_ok=True)
        value = generate()
        with open(path, "w") as f:
            f.write(value)
        return value
    except OSError:
        return generate()


class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql+psycopg2://interviewprep:interviewprep@localhost:5432/interviewprep",
        validation_alias=AliasChoices("DATABASE_URL", "POSTGRES_URL"),
    )
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    app_encryption_key: str = ""
    secret_dir: str = "/data"
    cors_origins: str = "*"
    static_dir: str = "static"

    default_user_email: str = "admin@interviewprep.app"
    default_user_password: str = "interviewprep"
    default_user_provider: str = "gemini"
    default_user_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def model_post_init(self, __context) -> None:
        self.database_url = _normalize_db_url(self.database_url)
        if not self.app_encryption_key:
            self.app_encryption_key = _persisted_secret(
                self.secret_dir, "encryption.key", _gen_fernet_key
            )
        if not self.jwt_secret:
            self.jwt_secret = _derive_key(self.app_encryption_key)

    @property
    def cors_origin_list(self):
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
