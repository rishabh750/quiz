# InterviewPrep

A minimalistic, responsive React + Vite study app with light/dark mode,
section-based quizzes (MCQ **and** open-ended / non-MCQ), markdown notes, and
one-click quiz/notes generation via your choice of **Gemini, Claude, or ChatGPT**.

**Fully client-side.** All data lives in the visitor's own browser
(`localStorage`) and the AI request goes **straight from their browser to the
provider** — nothing is stored on or routed through the host. That means it
deploys as a plain static site, and each visitor's courses, answers, and API key
stay private to their browser.

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

## Host it (static site)

```bash
npm run build      # outputs a static site to dist/
```

Deploy the `dist/` folder to any static host (Netlify, Vercel, GitHub Pages, S3,
Cloudflare Pages, …). No server, database, or secrets to manage — the app is HTML
+ JS + CSS. Serve it over **HTTPS** (required for the browser→provider calls and
for `localStorage` to persist reliably).

### Privacy / security model

- **API keys** are stored only in the visitor's `localStorage` and sent
  **directly to the chosen AI provider** — they never reach your host. You never
  see or store anyone's key.
- **Courses, answers, and the archive** are stored only in the visitor's
  `localStorage` — per-browser, never uploaded.
- Because the browser calls the provider directly, the provider must allow
  cross-origin (CORS) browser requests: **Gemini** and **Claude** do (Claude via
  the `anthropic-dangerous-direct-browser-access` header, already sent).
  **OpenAI/ChatGPT** may block direct browser calls depending on account/region;
  if a user hits a CORS error with ChatGPT, they should use Gemini or Claude.

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
