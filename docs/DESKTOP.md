# Desktop app distribution (macOS / Windows)

The desktop apps are **single-user** and fully offline-capable: everything lives
in the app's own `localStorage`, there's **no backend, no accounts, no database**,
and the AI request goes **straight from the app to the provider**. The web
backend ([backend/](../backend/)) is not involved — see [DOCKER.md](DOCKER.md) for
that path.

The desktop shell ([electron/main.cjs](../electron/main.cjs)) runs a tiny local
server on a **fixed port (43117)** and loads the built UI in an Electron window.
The fixed port matters: `localStorage` is keyed by origin, so a stable
`http://127.0.0.1:43117` keeps user data across launches. A
[preload](../electron/preload.cjs) sets `window.IS_DESKTOP = true`, which makes
the frontend use the `localStorage` backend and hide the login/register UI.

## Prerequisites

- **Node.js 18+** (Node 22 recommended) and npm.
- The Electron toolchain (installed by `npm install`).

```bash
npm install
```

## Build

The build script takes the target platform(s) as command-line arguments. Each run
first builds the frontend (`vite build`), then packages it with
[electron-builder](https://www.electron.build/). **Output lands in `./release/`.**

```bash
npm run dist           # build for the current OS
npm run dist mac       # macOS   -> .dmg + .zip
npm run dist win       # Windows (x64) -> NSIS installer + portable .exe
npm run dist linux     # Linux   -> AppImage
npm run dist mac win   # multiple targets at once
npm run dist all       # mac + win + linux
```

Convenience aliases (see [package.json](../package.json)):

```bash
npm run dist:mac
npm run dist:win
npm run dist:all
```

Or call the script directly (same arguments):

```bash
node scripts/build.mjs win
```

## Targets produced

| Platform | Targets | Arch |
|----------|---------|------|
| macOS    | `.dmg`, `.zip` | host arch |
| Windows  | NSIS installer, portable `.exe` | **x64** |
| Linux    | AppImage | host arch |

App identity (from `package.json` → `build`): appId `com.interviewprep.app`,
productName **InterviewPrep**, output dir `release/`. The bundled `course/` folder
is shipped as an extra resource and seeded on first launch.

## Platform notes

- **Build on the OS you're targeting when possible.** electron-builder produces
  native installers and cross-compilation has caveats:
  - Building a **Windows** package on **macOS/Linux** needs
    [Wine](https://www.winehq.org/) for the NSIS installer
    (`brew install --cask wine-stable` on macOS). The `portable` `.exe` target is
    more forgiving but still smoother on Windows.
  - Building **macOS** packages is only supported **on macOS** (Apple tooling).
- **Windows is x64 only** (configured in `package.json` → `build.win`). ARM is not
  targeted.
- For reliable multi-platform artifacts, run the matching `npm run dist <os>` on a
  CI runner per OS (GitHub Actions `macos-latest` / `windows-latest`).

## Unsigned apps — first launch

The apps are **unsigned**, so the OS will warn on first run:

- **macOS:** right-click the app → *Open* (or clear quarantine:
  `xattr -dr com.apple.quarantine "InterviewPrep.app"`).
- **Windows:** dismiss the SmartScreen "unknown publisher" prompt (More info → Run
  anyway).

## Using the app

1. Open the 🔑 key modal, pick **Gemini / Claude / ChatGPT** — its API-key page
   opens in your default browser — and paste the key. Keys are stored per-provider
   in `localStorage` and sent **directly** to that provider.
2. **✨ Generate** a quiz + notes, or **+ Add** to import `.txt` / `.md` files.

| Provider | Key page |
|----------|----------|
| Gemini  | aistudio.google.com/apikey |
| Claude  | console.anthropic.com/settings/keys |
| ChatGPT | platform.openai.com/api-keys |

> ChatGPT may block direct browser calls depending on account/region (CORS). If
> you hit a CORS error, use Gemini or Claude.

## Where data lives (desktop)

All in the app's `localStorage` — nothing is uploaded:

| Key | Contents |
|-----|----------|
| `ip_courses` | Each course's quiz (`.txt`) and optional notes (`.md`). |
| `ip_answers` | Your attempts per course (question number, answer, marks). |
| `ip_archive` | Deleted courses — revived from the Archive modal. |
| `llmKeys` / `llmProvider` | Per-provider API keys and the selected provider. |

## Troubleshooting

- **App opens but data resets each launch** — confirm the fixed port (43117) isn't
  being remapped; `localStorage` persistence depends on a stable origin.
- **Startup failure** — the shell writes details to `quiz-error.log` in the app's
  user-data directory and shows an in-window error page pointing to it.

## Related docs

- [DEVELOPMENT.md](DEVELOPMENT.md) — run and develop locally.
- [DOCKER.md](DOCKER.md) — host the multi-user web app instead.
