from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import PROVIDERS, AccountUpdateIn, MeOut

router = APIRouter(tags=["account"])


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return MeOut(email=user.email, provider=user.provider, has_api_key=bool(user.api_key))


@router.patch("/account", response_model=MeOut)
def update_account(
    body: AccountUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.provider is not None and body.provider in PROVIDERS:
        user.provider = body.provider
    if body.api_key is not None:
        user.api_key = body.api_key or None
    db.add(user)
    db.commit()
    db.refresh(user)
    return MeOut(email=user.email, provider=user.provider, has_api_key=bool(user.api_key))
