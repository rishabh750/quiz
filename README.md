# InterviewPrep

A study/quiz app: MCQ **and** open-ended quizzes + markdown notes, generated on
demand via **Gemini, Claude, or ChatGPT**. React UI, Python **FastAPI** API.

> **POC:** data is kept **in-memory** — it is **not persisted** across restarts,
> and each serverless instance has its own copy (see [Deploy](#deploy-to-vercel)).

## Structure

```
quiz/
├── backend/          FastAPI backend service (entrypoint main:app)
│   ├── main.py       builds the ASGI app + middleware
│   ├── config.py store.py security.py crypto.py llm.py quiz.py
│   ├── routers/      system · auth · account · courses · answers · generate
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

**Backend** — in-memory store, serves on :8000:

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && uvicorn main:app --reload --port 8000
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

Optional backend env (all have defaults — see [.env.example](.env.example)):
`JWT_SECRET`, `RSA_PRIVATE_KEY`, `CORS_ORIGINS`.

Caveats (inherent to in-memory + serverless):
- **No persistence** — a redeploy or cold start wipes all data. There is no seeded
  account; register again after a restart. Fine for a POC.
- **Accounts are per-instance** — each serverless process has its own memory. Auth
  and encryption work across instances out of the box (the JWT secret, RSA keypair,
  and user IDs use stable built-in defaults), but the account *record* you register
  — with its courses and the API key set in Profile — lives only on the instance
  that created it, so it's reliable only while one warm instance serves you. A
  persistent store (DB/KV) is the real fix. Override the built-in `JWT_SECRET` /
  `RSA_PRIVATE_KEY` with your own values in production.
- **Generation timeout** — `/api/generate` streams from the LLM; `vercel.json`
  sets `maxDuration` to 60s. Long generations may need a higher limit (plan-gated).

## Security model

- **In transit:** every `/api` request/response body is encrypted end-to-end (the
  server publishes an RSA public key; the client wraps a per-request AES-256 key
  with RSA-OAEP-SHA256 and encrypts the body with AES-GCM), so payloads —
  including register — are ciphertext in the browser network tab. Needs a **secure
  context** (HTTPS or `http://localhost`); over plain remote HTTP the client
  transparently falls back to plaintext.
- **Sessions:** JWT (HS256). **Passwords:** BCrypt.
- Data is in-memory only, so there's no at-rest storage to encrypt.
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
