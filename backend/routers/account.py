from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from security import current_user
from store import PROVIDERS, User, store

router = APIRouter(prefix="/api")


class AccountUpdateIn(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None


def _me(user: User) -> dict:
    return {"email": user.email, "provider": user.provider, "has_api_key": user.api_key is not None}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return _me(user)


@router.patch("/account")
def update_account(body: AccountUpdateIn, user: User = Depends(current_user)):
    if body.provider is not None and body.provider in PROVIDERS:
        user.provider = body.provider
    if body.api_key is not None:
        user.api_key = body.api_key.strip() or None
    store.save(user)
    return _me(user)
