from fastapi import APIRouter

from ..crypto import public_key_b64

router = APIRouter()


@router.get("/api/crypto/public-key")
def public_key():
    return {"publicKey": public_key_b64()}


@router.get("/api/health")
def health():
    return {"status": "ok"}
