"""Password hashing (BCrypt) and JWT sessions (HS256).

The JWT secret comes from JWT_SECRET when set, otherwise a per-process random
secret is used. Tokens are only ever verified by this same process, so any
consistent secret works; set JWT_SECRET in the environment if you run more than
one instance (or want tokens to survive a restart)."""
from __future__ import annotations

import secrets
import time

import bcrypt
import jwt
from fastapi import HTTPException, Request

from .config import settings
from .store import User, store

_jwt_secret = settings.jwt_secret or secrets.token_urlsafe(48)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_token(subject: str) -> str:
    now = int(time.time())
    payload = {"sub": subject, "iat": now, "exp": now + settings.jwt_expire_minutes * 60}
    return jwt.encode(payload, _jwt_secret, algorithm="HS256")


def parse_subject(token: str):
    try:
        claims = jwt.decode(token, _jwt_secret, algorithms=["HS256"])
        return claims.get("sub")
    except Exception:
        return None


def current_user(request: Request) -> User:
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    subject = parse_subject(header[7:].strip())
    user = store.get_by_id(subject)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user
