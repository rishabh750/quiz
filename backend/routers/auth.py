from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from security import create_token, hash_password, verify_password
from store import normalize_provider, store

router = APIRouter(prefix="/api/auth")


class RegisterIn(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None


class LoginIn(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None


def _token_response(subject: str) -> dict:
    return {"access_token": create_token(subject), "token_type": "bearer"}


@router.post("/register")
def register(body: RegisterIn):
    if not body.email or not body.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")
    if not body.password or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    email = body.email.strip().lower()
    if store.exists_email(email):
        raise HTTPException(status_code=409, detail="Email already registered")
    api_key = body.api_key.strip() if body.api_key and body.api_key.strip() else None
    user = store.create_user(email, hash_password(body.password),
                             normalize_provider(body.provider), api_key)
    return _token_response(user.id)


@router.post("/login")
def login(body: LoginIn):
    email = (body.email or "").strip().lower()
    user = store.get_by_email(email)
    if user is None or not verify_password(body.password or "", user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _token_response(user.id)
