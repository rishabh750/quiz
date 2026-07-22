# InterviewPrep

A study/quiz app: MCQ **and** open-ended quizzes + markdown notes, generated on
demand via **Gemini, Claude, or ChatGPT**. React UI, Python **FastAPI** API.

> Data is stored in **MongoDB** — `MONGODB_URI` is **required** (no in-memory
> fallback), see [Deploy](#deploy-to-vercel). Credentials come from the private
> [`secrets`](#credentials-the-secrets-submodule) submodule.

## Structure

```
quiz/
├── backend/          FastAPI backend service (entrypoint main:app)
│   ├── main.py       builds the ASGI app + middleware
│   ├── config.py store.py security.py llm.py quiz.py
│   ├── routers/      system · auth · account · courses · answers · generate
│   ├── secrets/      PRIVATE submodule: dev.env + production.env credentials
│   └── requirements.txt
├── frontend/         React + Vite frontend (static build)
│   └── src/  index.html  package.json  vite.config.js
├── docs/             architecture + backend notes
└── vercel.json       two Vercel services: frontend + backend
```

Deployed as **two Vercel services** ([vercel.json](vercel.json)): a static
`frontend/` and a Python `backend/` (ASGI `main:app`). The gateway routes
`/svc/api/*` to the backend and everything else to the frontend — no container.

## Run locally

**Backend** — serves on :8000. Credentials come from the `secrets` submodule
(fetch it first, see below):

```bash
git submodule update --init --recursive          # pull backend/secrets/*.env
python3 -m venv .venv && . .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && uvicorn main:app --reload --port 8000    # loads secrets/dev.env
```

**Frontend** (dev, hot reload) — point it at the backend:

```bash
cd frontend
npm install
VITE_API_BASE=http://localhost:8000 npm run dev     # http://localhost:5173
```

**Register** an account on first launch, then set your provider API key under
**Profile** (👤).

> The backend serves routes under `/api/*` and also accepts the gateway's
> `/svc/api/*` (a middleware strips the `/svc` prefix), so both the deployed
> gateway and direct local calls work.

## Deploy to Vercel

Import the repo — Vercel reads [vercel.json](vercel.json) and builds the two
services. In production the frontend calls `/svc/api/*` (the default API base), the
gateway forwards it to the backend, so there's no CORS.

**Persistence:** **`MONGODB_URI`** is **required** — the backend won't start without
it (no in-memory fallback). Accounts, courses, and answers live in the shared
database, so every serverless instance sees the same data.

Other backend env (all optional, have defaults — see [.env.example](.env.example)):
`JWT_SECRET`, `CORS_ORIGINS`.

> **Vercel + submodule:** Vercel checks out submodules during the build if the
> deploying account can access the private `secrets` repo (same GitHub owner works;
> otherwise add a deploy key). If the submodule can't be fetched, `production.env`
> is absent and the backend falls back to Vercel env vars — so you can also set
> `MONGODB_URI` / `JWT_SECRET` directly in the Vercel dashboard as a backup.

### Credentials: the `secrets` submodule

All credentials — **both** local/dev and production — live in a **private**
submodule at `backend/secrets/`, never in this public repo:

| File | Used when |
|------|-----------|
| `backend/secrets/dev.env`        | `APP_ENV` unset or `dev` (local) |
| `backend/secrets/production.env` | `APP_ENV=production` or Vercel's `VERCEL_ENV=production` |

[config.py](backend/config.py) loads the file for the current environment and its
values **override** the process environment. Fetch it after cloning:

```bash
git submodule update --init --recursive
```

Notes:
- The JWT secret and user IDs use stable built-in defaults, so auth works across
  instances out of the box. **Override `JWT_SECRET`** with your own value in
  production.
- There is **no seeded account** — register one on first launch.
- **Generation timeout** — `/api/generate` streams from the LLM; `vercel.json`
  sets `maxDuration` to 60s. Long generations may need a higher limit (plan-gated).

## Security model

- **In transit:** confidentiality is provided by **HTTPS/TLS**. Vercel serves both
  services over TLS by default, so every `/api` request/response — including
  register and provider keys — is encrypted on the wire.
- **Sessions:** JWT (HS256). **Passwords:** BCrypt.
- Persistence is MongoDB; the app does no app-level at-rest encryption — rely on
  your database's access controls and encryption at rest.
- Provider API keys stay **server-side**; generation is proxied so the key never
  reaches the browser.

## Providers

Set your key in **Profile** (👤). Keys are stored server-side per account.

| Provider | Key page |
|----------|----------|
| Gemini  | aistudio.google.com/apikey |
| Claude  | console.anthropic.com/settings/keys |
| ChatGPT | platform.openai.com/api-keys |

## Quiz file format

Fields separated by `$$$` (commas/quotes need no escaping); first row is the header,
`section` optional. MCQ has option columns; non-MCQ has an `answer` column.

```
section$$$question number$$$question$$$option 1$$$option 2$$$option 3$$$option 4$$$correct option number
section$$$question number$$$question$$$answer
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/BACKEND.md](docs/BACKEND.md).
