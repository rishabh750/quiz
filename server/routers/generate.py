from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..crypto import encrypt_chunk
from ..llm import GenerationError, stream_generation
from ..security import current_user
from ..store import User

router = APIRouter(prefix="/api")


class GenerateIn(BaseModel):
    prompt: str = ""
    provider: Optional[str] = None


@router.post("/generate")
def generate(body: GenerateIn, request: Request, user: User = Depends(current_user)):
    if not user.api_key:
        raise HTTPException(status_code=400, detail="No API key on your account")
    provider = body.provider or user.provider
    api_key = user.api_key
    prompt = body.prompt
    aes_key = request.scope.get("aes_key")

    def frame(text: str) -> bytes:
        return encrypt_chunk(aes_key, text) if aes_key else text.encode("utf-8")

    async def body_stream():
        try:
            async for chunk in stream_generation(provider, api_key, prompt):
                yield frame(chunk)
        except GenerationError as exc:
            yield frame("[ERROR] " + str(exc))

    headers = {"X-Enc": "1"} if aes_key else {}
    return StreamingResponse(body_stream(), media_type="text/plain; charset=utf-8", headers=headers)
