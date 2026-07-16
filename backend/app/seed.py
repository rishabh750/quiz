from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .config import settings
from .database import SessionLocal
from .models import User
from .security import hash_password


def seed_default_user() -> None:
    email = (settings.default_user_email or "").strip().lower()
    if not email:
        return
    db = SessionLocal()
    try:
        existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if existing:
            return
        db.add(
            User(
                email=email,
                password_hash=hash_password(settings.default_user_password),
                provider=settings.default_user_provider,
                api_key=(settings.default_user_api_key or None),
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
    finally:
        db.close()
