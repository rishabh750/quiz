from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ..deps import get_current_user
from ..llm import GenerationError, stream_generate
from ..models import User
from ..schemas import GenerateIn

router = APIRouter(tags=["generate"])


@router.post("/generate")
async def generate(body: GenerateIn, user: User = Depends(get_current_user)):
    if not user.api_key:
        raise HTTPException(status_code=400, detail="No API key on your account")
    provider = body.provider or user.provider

    async def streamer():
        try:
            async for chunk in stream_generate(provider, user.api_key, body.prompt):
                yield chunk
        except GenerationError as e:
            yield "[ERROR] " + e.message

    return StreamingResponse(streamer(), media_type="text/plain; charset=utf-8")
