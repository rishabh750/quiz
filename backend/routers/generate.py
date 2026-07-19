from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from llm import GenerationError, stream_generation
from security import current_user
from store import User

router = APIRouter(prefix="/api")


class GenerateIn(BaseModel):
    prompt: str = ""
    provider: Optional[str] = None


@router.post("/generate")
def generate(body: GenerateIn, user: User = Depends(current_user)):
    if not user.api_key:
        raise HTTPException(status_code=400, detail="No API key on your account")
    provider = body.provider or user.provider
    api_key = user.api_key
    prompt = body.prompt

    async def body_stream():
        try:
            async for chunk in stream_generation(provider, api_key, prompt):
                yield chunk.encode("utf-8")
        except GenerationError as exc:
            yield ("[ERROR] " + str(exc)).encode("utf-8")

    return StreamingResponse(body_stream(), media_type="text/plain; charset=utf-8")
