# InterviewPrep API (FastAPI / Python)

FastAPI app in [backend/](../backend), deployed on Vercel as its own **service**
(ASGI entrypoint `main:app`, routed via `/svc/api/*` in `vercel.json`) and runnable
locally with uvicorn. Data is stored in **MongoDB** when `MONGODB_URI` is set (shared
across all instances). `MONGODB_URI` is required (no in-memory fallback). Per-user data
(courses, questions, notes, answers) is isolated by JWT.

The gateway sends `/svc/api/*` to this service; `GatewayPrefixMiddleware` strips the
`/svc` prefix so all routes below stay canonical under `/api` (direct/local calls to
`/api/*` also work).

Encryption:
- **In transit** — every `/api` request/response body is end-to-end encrypted so
  payloads are ciphertext even in the browser network tab. The server publishes an
  RSA public key; each request carries a fresh AES-256 key (RSA-OAEP-SHA256-wrapped
  in the `X-Enc-Key` header) and an AES-GCM body `{iv, d}`; the response is AES-GCM
  with the same key and marked `X-Enc: 1`. Implemented as an ASGI middleware,
  [PayloadCipherMiddleware](../backend/crypto.py). Falls back to plaintext when the
  browser has no Web Crypto (non-secure context).
- **At rest** — none; data lives only in process memory.

Sessions use **JWT** (HS256); passwords are **BCrypt**-hashed.

## Package layout (`backend/`)

| Module | Responsibility |
|--------|----------------|
| `main.py` | build the app (entrypoint `main:app`), middleware order (gateway-strip → CORS → cipher) |
| `config.py` | env-driven settings |
| `store.py` | data model + `MongoStore` (one document per user → embedded courses/questions/answers) |
| `security.py` | BCrypt hashing, JWT create/verify, `current_user` dependency |
| `crypto.py` | RSA/AES primitives + payload-encryption middleware |
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
| GET  | `/crypto/public-key` | RSA public key for payload encryption (unencrypted) |
| GET  | `/health` | liveness (unencrypted) |
| POST | `/auth/register` / `/auth/login` | → JWT |
| GET  | `/me` · PATCH `/account` | account (provider, api key) |
| GET  | `/courses` / `/archive` | list names |
| POST | `/courses` | upsert `{filename, content}` (.txt → questions, .md → notes) |
| GET  | `/courses/{name}/questions` / `/notes` | fetch |
| POST | `/archive/{name}` / `/archive/{name}/revive` · DELETE `/archive/{name}` | archive / restore / purge |
| GET/POST/DELETE | `/answers/{name}` | list / save / reset |
| POST | `/generate` | stream a prompt to the account's provider (encrypted per-chunk) |

## Config (env vars — all optional)

| Var | Meaning |
|-----|---------|
| `MONGODB_URI` | MongoDB connection string; **required** — the app won't start without it |
| `JWT_SECRET` | HS256 secret; **overrides** the built-in stable default (set your own in prod) |
| `JWT_EXPIRE_MINUTES` | token lifetime (default 10080 = 7 days) |
| `RSA_PRIVATE_KEY` | PEM; **overrides** the built-in transport keypair (set your own in prod) |
| `CORS_ORIGINS` | allowed origins when the UI is a separate origin (default `*`) |

> The JWT secret, RSA transport keypair, and user IDs use **stable built-in
> defaults**, so tokens and encryption work across serverless instances with zero
> config. There is **no seeded account** — register one. With `MONGODB_URI` set, the
> account and its data are shared across all instances (routers mutate the `User`
> object and call `store.save(user)`). Override `JWT_SECRET` / `RSA_PRIVATE_KEY` in
> production.
