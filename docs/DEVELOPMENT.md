# Development

How to run InterviewPrep locally and work on the code. The app is a React + Vite
frontend that runs in **two modes**, and this doc covers developing against both:

- **Web / hosted mode** — talks to the Spring Boot + PostgreSQL backend ([backend/](../backend/)).
- **Desktop mode** — single-user, everything in the browser's `localStorage`, no backend.

The same React components serve both; the frontend picks a backend automatically
(`window.IS_DESKTOP`, set by the Electron preload). See [api.js](../src/api.js) →
[backends/local.js](../src/backends/local.js) / [backends/remote.js](../src/backends/remote.js).

## Prerequisites

- **Node.js 18+** (Node 22 recommended) and npm.
- For backend work: **Azul Zulu JDK 21** and a reachable **PostgreSQL** (local
  install or the Docker one — see [DOCKER.md](DOCKER.md)). Maven is not required —
  use the bundled `./mvnw` wrapper.

```bash
npm install
```

## Frontend-only dev (localStorage backend)

The fastest loop. No backend needed — the app stores everything in `localStorage`
and calls the LLM provider straight from the browser.

```bash
npm run dev
```

Open the printed URL (default http://localhost:5173). Set an API key via the 🔑
button (Gemini / Claude / ChatGPT), then generate or import courses.

This is exactly what the **desktop** apps run, so use it to iterate on UI, the
quiz parser, prompts, and the notes view.

## Full-stack dev (against the FastAPI backend)

Run the backend and point the dev server at it with `VITE_API_BASE`.

**1. Start Postgres.** Either a local server, or just the DB from Docker:

```bash
docker compose up -d db      # Postgres only, internal to the compose network
```

If you use the compose DB, run the backend inside compose too, or expose a port
locally — simplest is a standalone local Postgres with a matching `DATABASE_URL`.

**2. Start the backend:**

```bash
cd backend
export DATABASE_URL=postgresql://interviewprep:interviewprep@localhost:5432/interviewprep
export APP_ENCRYPTION_KEY=dev-key-change-me
export SECRET_DIR=.secrets
./mvnw spring-boot:run
```

Tables auto-create on startup and a default account is seeded
(`admin@interviewprep.app` / `interviewprep`). Details: [backend/README.md](../backend/README.md).

**3. Start the frontend against it:**

```bash
VITE_API_BASE=http://localhost:8000 npm run dev
```

Because `window.IS_DESKTOP` is unset in the browser, the app runs in **web mode**:
it shows the login/register landing, stores data per-account in Postgres
(encrypted at rest), and proxies generation through `POST /api/generate`.

> Keep `APP_ENCRYPTION_KEY` **stable** across restarts — rotating it makes
> already-encrypted rows undecryptable.

## Project layout

```
src/                    React app
  api.js                backend facade: local (desktop) vs remote (web)
  backends/local.js     localStorage implementation
  backends/remote.js    REST + JWT implementation
  auth.js               token storage + apiFetch (encrypts requests) (web)
  crypto.js             WebCrypto payload encryption (RSA-OAEP + AES-GCM) (web)
  session.js            unified provider/key state (desktop vs web)
  mode.js               IS_DESKTOP + API_BASE
  gemini.js             LLM streaming (direct on desktop, proxied on web)
  prompt.js             prompt builders (quiz + section notes)
  lib/quizFormat.js     quiz parser ($$-delimited, MCQ vs non-MCQ)
  components/           UI (AuthModal, Header, Notes, ...)

backend/                Spring Boot + PostgreSQL (web mode) — see backend/README.md
  src/main/java/com/interviewprep/
    web/                controllers + DTOs
    model/ repo/        JPA entities + repositories
    security/           JWT filter, argument resolver
    crypto/             payload cipher filter, AES/RSA, at-rest converter
    service/            LLM proxy, quiz parser, seeding
    config/             datasource, secrets, filters, CORS/static

electron/               desktop shell (main.cjs, preload.cjs)
server/api.cjs          Node filesystem/LLM API used by the desktop shell
scripts/build.mjs       desktop packaging script
```

## Common tasks

**Build the frontend** (static output to `dist/`):

```bash
npm run build
```

**Run the desktop shell in dev** (builds then launches Electron):

```bash
npm run electron
```

On sandboxed shells you may need:
`env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron .`

**Compile-check the backend:**

```bash
cd backend && ./mvnw -q -DskipTests package
```

## Coding conventions

- **No comments** in committed code — keep it clean and self-explanatory.
- Match the surrounding style (naming, idioms, comment density).
- Shared UI components must work in **both** modes; branch on `IS_DESKTOP` only in
  the backend facade / session helpers, not in view components.

## Quiz file format

Fields separated by `$$$` (commas/quotes in text need no escaping); older
comma-separated files still parse. First row is the header; the `section` column
is optional (defaults to `main`).

**MCQ:**
```
section$$$question number$$$question$$$option 1$$$option 2$$$option 3$$$option 4$$$correct option number
Basics$$$1$$$Which keyword defines a class in Java?$$$class$$$struct$$$define$$$object$$$1
```

**Non-MCQ / open-ended:**
```
section$$$question number$$$question$$$answer
Core$$$1$$$Explain the virtual DOM.$$$A lightweight in-memory tree React diffs to compute minimal real-DOM updates.
```

## Related docs

- [DESKTOP.md](DESKTOP.md) — build macOS / Windows executables.
- [DOCKER.md](DOCKER.md) — host the web app (backend + Postgres + UI) in one container.
- [backend/README.md](../backend/README.md) — API endpoints, config, schema.
