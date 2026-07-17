# InterviewPrep API (FastAPI / Python)

FastAPI app at the repo root, deployed on Vercel as a Python serverless function
([api/index.py](../api/index.py)) and runnable locally with uvicorn. **In-memory**
store — a POC that is **not persisted** across restarts and is **per instance**.
Per-user data (courses, questions, notes, answers) is isolated by JWT.

Encryption:
- **In transit** — every `/api` request/response body is end-to-end encrypted so
  payloads are ciphertext even in the browser network tab. The server publishes an
  RSA public key; each request carries a fresh AES-256 key (RSA-OAEP-SHA256-wrapped
  in the `X-Enc-Key` header) and an AES-GCM body `{iv, d}`; the response is AES-GCM
  with the same key and marked `X-Enc: 1`. Implemented as an ASGI middleware,
  [PayloadCipherMiddleware](../server/crypto.py). Falls back to plaintext when the
  browser has no Web Crypto (non-secure context).
- **At rest** — none; data lives only in process memory.

Sessions use **JWT** (HS256); passwords are **BCrypt**-hashed.

## Package layout (`server/`)

| Module | Responsibility |
|--------|----------------|
| `app.py` | build the app, middleware order (cipher inner, CORS outer), seed default user |
| `config.py` | env-driven settings |
| `store.py` | in-memory dataclasses + store (users → courses → questions/answers) |
| `security.py` | BCrypt hashing, JWT create/verify, `current_user` dependency |
| `crypto.py` | RSA/AES primitives + payload-encryption middleware |
| `llm.py` | streaming proxy to Gemini / OpenAI / Anthropic (httpx) |
| `quiz.py` | `$$$`/CSV quiz parser |
| `routers/` | `system`, `auth`, `account`, `courses`, `answers`, `generate` |

## Run

```bash
pip install -r requirements.txt
uvicorn server.app:app --reload --port 8000        # :8000, seeds default account
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
| `JWT_SECRET` | HS256 secret; random per process if unset (set it for multi-instance / restart stability) |
| `JWT_EXPIRE_MINUTES` | token lifetime (default 10080 = 7 days) |
| `RSA_PRIVATE_KEY` | PEM; set to share the transport keypair across instances (else generated per process) |
| `CORS_ORIGINS` | allowed origins when the UI is a separate origin (default `*`) |
| `DEFAULT_USER_EMAIL` / `_PASSWORD` / `_PROVIDER` / `_API_KEY` | seeded account |

> The RSA transport keypair and JWT secret are per process unless pinned via env.
> With multiple Vercel instances, set `JWT_SECRET` and `RSA_PRIVATE_KEY` (the UI
> also re-fetches the public key when a decrypt fails).
