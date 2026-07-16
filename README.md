# InterviewPrep

A minimalistic, responsive React + Vite study app with light/dark mode,
section-based quizzes (MCQ **and** open-ended / non-MCQ), markdown notes, and
one-click quiz/notes generation via your choice of **Gemini, Claude, or ChatGPT**.

**One UI, two modes.** The same React app runs as a **hosted multi-user web app**
(accounts, a **Java Spring Boot + PostgreSQL** backend, data encrypted at rest and
end-to-end encrypted in transit) or as **single-user desktop apps** (everything in
the app's own `localStorage`, no backend). It picks the backend automatically from
`window.IS_DESKTOP`.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — high-level FE / BE / Docker architecture (UML diagrams).
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — run and develop locally (both modes).
- [docs/DESKTOP.md](docs/DESKTOP.md) — build the macOS / Windows desktop apps.
- [docs/DOCKER.md](docs/DOCKER.md) — host the multi-user web app (backend + Postgres + UI).
- [docs/VERCEL.md](docs/VERCEL.md) — host the UI on Vercel with the API as a container.

## Prerequisites

- **Node.js 18+** (Node 22 recommended) and npm.
- Building desktop executables also needs the Electron toolchain (installed by
  `npm install`).

```bash
npm install
```

## Run in development

```bash
npm run dev
```

Open the printed URL (default http://localhost:5173).

## Two deployment modes

- **Hosted web app (multi-user):** a **Spring Boot (Java 21 / Zulu) + PostgreSQL**
  backend ([backend/](backend/)) with accounts. Each user's API key and their
  questions/notes are **AES-GCM encrypted at rest**; answers are per-user; sessions
  use **JWT**. Every `/api` payload is **end-to-end encrypted** (RSA-wrapped AES-GCM)
  so request/response bodies are ciphertext even in the browser network tab. The
  frontend shows a login/register landing (register picks the AI model + key). Ship
  it all with Docker Compose.
- **Desktop apps (macOS/Windows):** unchanged — single-user, everything in the
  app's own `localStorage`, no accounts. The same React UI runs in both; it picks
  the backend automatically (`window.IS_DESKTOP` set by the Electron preload).

## Host it with Docker (one container: Postgres + backend + UI)

One command runs **everything inside a single container** — PostgreSQL, the API,
and the UI — with auto-generated secrets and a seeded default account:

```bash
docker compose up --build -d
# or:  docker build -t interviewprep . && \
#      docker run -d -p 8000:8000 -v ip_pgdata:/var/lib/postgresql/data -v ip_appdata:/data interviewprep
```

Open http://localhost:8000 and log in with **`admin@interviewprep.app` /
`interviewprep`**, then set your API key under **Profile** (top-left 👤). No `.env`,
external database, or secret generation needed — everything is created on first run
and persisted to volumes. Access via **HTTPS or `http://localhost`** to keep payload
encryption on (browser WebCrypto needs a secure context; over plain remote HTTP the
app still works but sends plaintext — put TLS in front). Full details, overrides, and
production notes: [docs/DOCKER.md](docs/DOCKER.md).

## Deploy to Vercel

Vercel can host the **static UI**; the Java API runs as a **container** elsewhere
(Railway / Render / Fly / Cloud Run — build with [Dockerfile.vercel](Dockerfile.vercel)).
Point the UI at it with `VITE_API_BASE`. See [docs/VERCEL.md](docs/VERCEL.md).

Backend details and running it standalone: [backend/](backend/) — see
[backend/.env.example](backend/.env.example) for local config. For local dev
against the backend, run the API (`./mvnw spring-boot:run` from `backend/`) and
`VITE_API_BASE=http://localhost:8000 npm run dev`.

### Security model (hosted web app)

- **In transit:** every `/api` request/response body is encrypted end-to-end
  (server RSA public key wraps a per-request AES-256 key; bodies are AES-GCM). So
  even the register payload is ciphertext in the network tab. Sessions use **JWT**.
- **At rest:** each user's **API key** and their question/option/answer/notes
  content are AES-GCM encrypted in Postgres; passwords are BCrypt-hashed.
- **Isolation:** all data is scoped to the authenticated user.
- Serve behind **HTTPS** in production (browser WebCrypto requires a secure
  context; localhost is exempt for local dev).

The **desktop apps** are the single-user, no-backend mode: keys and data live only
in the app's `localStorage`, and the AI request goes straight to the provider.

## Build desktop executables

The build script takes the target platform(s) as command-line arguments:

```bash
npm run dist           # build for the current OS
npm run dist mac       # macOS  -> .dmg + .zip
npm run dist win       # Windows (x64) -> NSIS installer + portable .exe
npm run dist linux     # Linux  -> AppImage
npm run dist mac win   # multiple targets at once
npm run dist all       # mac + win + linux
```

Convenience aliases are also defined:

```bash
npm run dist:mac
npm run dist:win
npm run dist:all
```

You can also call the script directly (same arguments):

```bash
node scripts/build.mjs win
```

Each run first builds the frontend (`vite build`) and then packages it with
[electron-builder](https://www.electron.build/). **Output lands in `./release/`.**

### Platform-specific notes

- **Build on the OS you're targeting when possible.** electron-builder produces
  native installers, and cross-compilation has caveats:
  - Building a **Windows** package on **macOS/Linux** requires
    [Wine](https://www.winehq.org/) for the NSIS installer
    (`brew install --cask wine-stable` on macOS). The `portable` `.exe` target is
    more forgiving but still smoother on Windows.
  - Building **macOS** packages is only supported **on macOS** (Apple's tooling).
- The apps are **unsigned**. On first launch:
  - macOS: right-click the app → *Open* (or run
    `xattr -dr com.apple.quarantine "Quiz.app"`).
  - Windows: dismiss the SmartScreen "unknown publisher" prompt.
- For reliable multi-platform artifacts, run the matching `npm run dist <os>` on a
  CI runner for each OS (e.g. GitHub Actions `macos-latest` / `windows-latest`).

## Choosing an LLM provider

Generation works with **Gemini**, **Claude**, or **ChatGPT**. Open the key modal
(🔑 in the top bar), pick a provider — its API-key page opens in your default
browser — then paste the key. Keys are stored per-provider in `localStorage` and
sent **directly from the browser to that provider**.

| Provider | Key page                              |
|----------|---------------------------------------|
| Gemini   | aistudio.google.com/apikey            |
| Claude   | console.anthropic.com/settings/keys   |
| ChatGPT  | platform.openai.com/api-keys          |

## Where your data lives

Everything is kept in the browser's `localStorage` — nothing is uploaded:

| Key           | Contents                                                          |
|---------------|------------------------------------------------------------------|
| `ip_courses`  | Each course's quiz (`.txt` content) and optional notes (`.md`).  |
| `ip_answers`  | Your attempts per course (`question number, candidate answer, marks`). |
| `ip_archive`  | Deleted courses (quiz + notes) — revived from the Archive modal. |
| `llmKeys` / `llmProvider` | Your per-provider API keys and the selected provider. |

Clearing the browser's site data (or using a different browser/device) starts
fresh. Use **+ Add** to import `.txt`/`.md` files, or **✨ Generate** to create
courses. The app ships with no example content.

### Quiz file format

Fields are separated by `$$$` (so commas/quotes in text need no escaping); older
comma-separated files still parse. The first row is the header, and the `section`
column is optional (defaults to `main`). Two question types are supported,
detected from the header:

**MCQ** (has `option`/`correct option number` columns):

```
section$$$question number$$$question$$$option 1$$$option 2$$$option 3$$$option 4$$$correct option number
Basics$$$1$$$Which keyword defines a class in Java?$$$class$$$struct$$$define$$$object$$$1
```

**Non-MCQ / open-ended** (has an `answer` column, no options):

```
section$$$question number$$$question$$$answer
Core$$$1$$$Explain the virtual DOM.$$$A lightweight in-memory tree React diffs to compute minimal real-DOM updates.
```

For MCQ, `marks` is `1` when the chosen option matches the correct one. For
non-MCQ you reveal the model answer and self-assess ("I knew this" / "Need
review"), which records `marks` `1`/`0` so section and overall scores still work.

## Features

- Left navbar lists every course; **add a `.txt` and refresh** to load it. On
  narrow screens the navbar collapses into a ☰ drawer.
- Per-course buttons: **notes toggle** (📝), **reset attempts** (↺), **delete → archive** (🗑).
- Section-wise collapsible widgets with per-section scores; sticky section headers.
- Header shows the live overall score and a light/dark toggle.
- **+ Add** uploads `.txt`/`.md` files into the course folder.
- **✨ Generate** opens a modal (tags, question count, difficulty, **MCQ / Non-MCQ**
  toggle); the app calls your chosen provider (Gemini / Claude / ChatGPT) and saves
  a generated quiz + notes with a live streaming status bar.
- **🔄 Refresh notes** on the notes page regenerates just the notes, grounded in
  the course's questions.

## Project layout

```
course/               sample + generated quizzes and notes
server/api.cjs        Node backend: filesystem + LLM proxy (Gemini/Claude/ChatGPT)
vite-api-plugin.js    serves the Node API in the Vite dev server
electron/main.cjs     desktop shell: localhost server + window + menus
scripts/build.mjs     platform-arg desktop build/packaging script
src/providers.js      provider metadata + per-provider key storage
src/                  React app (components, prompt builder, LLM client)
```
