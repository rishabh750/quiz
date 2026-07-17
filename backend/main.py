"""FastAPI application (Vercel backend service, entrypoint `main:app`): assembles
routers, the gateway-prefix + payload-encryption middleware, CORS, and seeds the
default account. Run locally with `uvicorn main:app` from the backend/ directory."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from crypto import PayloadCipherMiddleware
from routers import account, answers, auth, courses, generate, system
from security import hash_password
from store import normalize_provider, store

# vercel.json routes /svc/api/* to this service. Strip that gateway prefix so the
# routes below stay canonical under /api and direct/local calls keep working.
GATEWAY_PREFIX = "/svc"


class GatewayPrefixMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path == GATEWAY_PREFIX or path.startswith(GATEWAY_PREFIX + "/"):
                scope = dict(scope)
                stripped = path[len(GATEWAY_PREFIX):] or "/"
                scope["path"] = stripped
                if scope.get("raw_path"):
                    scope["raw_path"] = stripped.encode("latin-1")
        return await self.app(scope, receive, send)


def _seed_default_user() -> None:
    email = (settings.default_user_email or "").strip().lower()
    if not email or store.exists_email(email):
        return
    api_key = settings.default_user_api_key or None
    store.create_user(email, hash_password(settings.default_user_password),
                      normalize_provider(settings.default_user_provider), api_key)


app = FastAPI(title="InterviewPrep API")

# Inner: decrypt requests / encrypt responses. Added first so it sits inside CORS.
app.add_middleware(PayloadCipherMiddleware)

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Enc"],
)

# Outermost: runs first, strips the /svc gateway prefix before anything else.
app.add_middleware(GatewayPrefixMiddleware)

for module in (system, auth, account, courses, answers, generate):
    app.include_router(module.router)


@app.exception_handler(Exception)
async def on_unhandled(_request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc) or "Internal error"})


_seed_default_user()
