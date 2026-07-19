# InterviewPrep API (FastAPI / Python)

FastAPI app in [backend/](../backend), deployed on Vercel as its own **service**
(ASGI entrypoint `main:app`, routed via `/svc/api/*` in `vercel.json`) and runnable
locally with uvicorn. Data is stored in **MongoDB** when `MONGODB_URI` is set (shared
across all instances). `MONGODB_URI` is required (no in-memory fallback). Per-user data
(courses, questions, notes, answers) is isolated by JWT.

The gateway sends `/svc/api/*` to this service; `GatewayPrefixMiddleware` strips the
`/svc` prefix so all routes below stay canonical under `/api` (direct/local calls to
`/api/*` also work).

Confidentiality:
- **In transit** — plain JSON over **HTTPS/TLS**. Vercel terminates TLS for both
  services, so request/response bodies are encrypted on the wire by the transport;
  the app adds no payload-level encryption.
- **At rest** — none at the app level; rely on MongoDB's access controls and
  encryption at rest.

Sessions use **JWT** (HS256); passwords are **BCrypt**-hashed.

## Package layout (`backend/`)

| Module | Responsibility |
|--------|----------------|
| `main.py` | build the app (entrypoint `main:app`), middleware order (gateway-strip → CORS) |
| `config.py` | env-driven settings |
| `store.py` | data model + `MongoStore` (one document per user → embedded courses/questions/answers) |
| `security.py` | BCrypt hashing, JWT create/verify, `current_user` dependency |
| `llm.py` | streaming proxy to Gemini / OpenAI / Anthropic (httpx) |
| `quiz.py` | `$$$`/CSV quiz parser |
| `routers/` | `system`, `auth`, `account`, `courses`, `answers`, `generate` |

## Run

```bash
pip install -r backend/requirements.txt
cd backend && uvicorn main:app --reload --port 8000   # :8000 (register an account)
```

## Endpoints (all under `/api`)

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/health` | liveness |
| POST | `/auth/register` / `/auth/login` | → JWT |
| GET  | `/me` · PATCH `/account` | account (provider, api key) |
| GET  | `/courses` / `/archive` | list names |
| POST | `/courses` | upsert `{filename, content}` (.txt → questions, .md → notes) |
| GET  | `/courses/{name}/questions` / `/notes` | fetch |
| POST | `/archive/{name}` / `/archive/{name}/revive` · DELETE `/archive/{name}` | archive / restore / purge |
| GET/POST/DELETE | `/answers/{name}` | list / save / reset |
| POST | `/generate` | stream a prompt to the account's provider (text/plain chunks) |

## Config (env vars — all optional)

| Var | Meaning |
|-----|---------|
| `MONGODB_URI` | MongoDB connection string; **required** — the app won't start without it |
| `JWT_SECRET` | HS256 secret; **overrides** the built-in stable default (set your own in prod) |
| `JWT_EXPIRE_MINUTES` | token lifetime (default 10080 = 7 days) |
| `CORS_ORIGINS` | allowed origins when the UI is a separate origin (default `*`) |

> The JWT secret and user IDs use **stable built-in defaults**, so tokens work
> across serverless instances with zero config. There is **no seeded account** —
> register one. With `MONGODB_URI` set, the account and its data are shared across
> all instances (routers mutate the `User` object and call `store.save(user)`).
> Override `JWT_SECRET` in production.
