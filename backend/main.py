from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from crypto import PayloadCipherMiddleware
from routers import account, answers, auth, courses, generate, system

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


app = FastAPI(title="InterviewPrep API")

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

app.add_middleware(GatewayPrefixMiddleware)

for module in (system, auth, account, courses, answers, generate):
    app.include_router(module.router)


@app.exception_handler(Exception)
async def on_unhandled(_request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc) or "Internal error"})
