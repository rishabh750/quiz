import os

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, engine
from .routers import account, answers, auth, courses, generate
from .seed import seed_default_user

app = FastAPI(title="InterviewPrep API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_initialized = False


def ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return
    Base.metadata.create_all(bind=engine)
    seed_default_user()
    _initialized = True


api_router = APIRouter(prefix="/api")


@api_router.get("/health")
def health():
    return {"status": "ok"}


api_router.include_router(auth.router)
api_router.include_router(account.router)
api_router.include_router(courses.router)
api_router.include_router(answers.router)
api_router.include_router(generate.router)
app.include_router(api_router)


@app.middleware("http")
async def _init_middleware(request, call_next):
    try:
        ensure_initialized()
    except Exception:
        pass
    return await call_next(request)


if os.path.isdir(settings.static_dir):
    app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="static")
