# InterviewPrep

A study/quiz app: MCQ **and** open-ended quizzes + markdown notes, generated on
demand via **Gemini, Claude, or ChatGPT**. React UI, Python **FastAPI** API.

> **POC:** data is kept **in-memory** — it is **not persisted** across restarts,
> and each serverless instance has its own copy (see [Deploy](#deploy-to-vercel)).

## Structure

```
/                 FastAPI backend (Python)              ← repo root
  server/         app package: config, store, security, crypto, llm, quiz, routers/
  api/index.py    Vercel serverless entrypoint (exports the ASGI app)
  requirements.txt
  vercel.json
ui/               React + Vite frontend
  src/  index.html  package.json  vite.config.js
docs/             architecture + backend notes
```

The frontend is a **static** build served by Vercel's CDN; the backend runs as a
**Python serverless function**. They ship from the same repo but deploy as two
separate outputs — no container, no server to keep running.

## Run locally

**API** — in-memory store, seeds a default account, serves on :8000:

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn server.app:app --reload --port 8000
```

**UI** (dev, hot reload) — point it at the API:

```bash
cd ui
npm install
VITE_API_BASE=http://localhost:8000 npm run dev     # http://localhost:5173
```

Log in with the seeded account **`admin@interviewprep.app` / `interviewprep`**,
then set your provider API key under **Profile** (👤).

## Deploy to Vercel

Import the repo as a Vercel project — no extra setup. Vercel reads
[vercel.json](vercel.json): it builds the UI to `ui/dist` (served as static) and
deploys [api/index.py](api/index.py) as a Python function. The UI calls `/api/*`
on the **same origin**, so there's no CORS and no `VITE_API_BASE` in production.

Optional env (all have defaults — see [.env.example](.env.example)):
`JWT_SECRET`, `RSA_PRIVATE_KEY`, `DEFAULT_USER_*`.

Caveats (inherent to in-memory + serverless):
- **No persistence** — a redeploy or cold start wipes all data; only the default
  account re-seeds. Fine for a POC.
- **Per-instance state** — registered accounts and courses live only on the
  instance that created them. Low-traffic Vercel usually keeps one warm instance,
  so it works, but it is not multi-instance safe. Set **`JWT_SECRET`** (and ideally
  **`RSA_PRIVATE_KEY`**) so sessions and the transport keypair are stable across
  instances/restarts.
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
