# InterviewPrep

A study/quiz app: MCQ **and** open-ended quizzes + markdown notes, generated on
demand via **Gemini, Claude, or ChatGPT**. React UI, Spring Boot (Java 21) API.

> **POC:** data is stored in-memory (H2) — it is **not persisted** across restarts.

## Structure

```
/                 Spring Boot API (Java 21) + Dockerfile   ← repo root
  pom.xml, mvnw, .mvn/
  src/main/java/com/interviewprep/   controllers, security, crypto, services, model
  src/main/resources/application.yml
  Dockerfile
ui/               React + Vite frontend
  src/  index.html  package.json  vite.config.js
docs/             architecture notes
```

## Run locally

**API** (root) — serves on :8000, seeds a default account, in-memory DB:

```bash
./mvnw spring-boot:run
```

**UI** (dev, hot reload) — point it at the API:

```bash
cd ui
npm install
VITE_API_BASE=http://localhost:8000 npm run dev     # http://localhost:5173
```

Or build the UI and let the API serve it from one origin:

```bash
cd ui && npm run build && cd ..
STATIC_DIR=ui/dist ./mvnw spring-boot:run            # UI + API on :8000
```

Log in with the seeded account **`admin@interviewprep.app` / `interviewprep`**,
then set your provider API key under **Profile** (👤).

## Run with Docker (one container: UI + API)

```bash
docker build -t interviewprep .
docker run -p 8000:8000 interviewprep
```

Open http://localhost:8000. The image builds the UI, packages the API, and serves
both on port 8000 — no database, no external services.

## Deploy to Vercel (single container)

Deploy the repo as a **container** project — Vercel builds the `Dockerfile` and runs
it; Spring Boot serves the UI at `/` and the API at `/api` (same origin, so no CORS
or `VITE_API_BASE` needed). Optional env: `JWT_SECRET`, `DEFAULT_USER_*` (see
[.env.example](.env.example)).

Caveats:
- **No persistence** — every redeploy/restart wipes all data; only the default
  account re-seeds. Fine for a POC.
- **In-memory is per-instance** — if Vercel runs more than one instance, data won't
  be shared. Keep it single-instance.
- **Startup timeout** — Vercel gives the container 15s to bind `$PORT`. The
  `Dockerfile` launches the JVM with `-Djava.security.egd=file:/dev/./urandom`
  (so RSA/JWT key generation can't block on `/dev/random`) plus
  `-XX:TieredStopAtLevel=1 -XX:+UseSerialGC` to trim cold start — it binds in ~5s.

## Security model

- **In transit:** every `/api` request/response body is encrypted end-to-end (server
  RSA public key wraps a per-request AES-256 key; bodies are AES-GCM), so payloads —
  including register — are ciphertext in the network tab. Needs a **secure context**
  (HTTPS or `http://localhost`); over plain remote HTTP it transparently falls back
  to plaintext.
- **Sessions:** JWT (HS256). **Passwords:** BCrypt.
- Data is in-memory only, so there's no at-rest storage to encrypt.

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
