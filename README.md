# Quiz

A minimalistic React + Vite quiz app with light/dark mode, section-based quizzes,
markdown notes, and one-click quiz/notes generation via the Gemini API. It runs
either in the browser (Vite dev server) or as a packaged desktop app (Electron).

## Prerequisites

- **Node.js 18+** (Node 22 recommended) and npm.
- To build desktop executables: the Electron toolchain (installed automatically
  by `npm install`).

```bash
npm install
```

## Run in development

```bash
npm run dev
```

Open the printed URL (default http://localhost:5173). File reads/writes are served
by a small Vite dev-server middleware ([vite-api-plugin.js](vite-api-plugin.js))
that shares its logic with the desktop build ([server/api.js](server/api.js)).

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

## Where your data lives

| Folder      | Contents                                                            |
|-------------|---------------------------------------------------------------------|
| `course/`   | One `<name>.txt` per quiz (CSV) and an optional `<name>.md` notes file. |
| `answers/`  | `<name>.csv` written live as you answer (`question number, candidate answer, marks`). |
| `archive/`  | Deleted courses (quiz + notes) — revived from the in-app Archive modal. |

- **Dev / running from source:** these folders live in the project root.
- **Packaged app:** they live in the per-user app-data folder. Use the
  **Course → Open Course Folder / Open Answers Folder** menu items to reveal them.
  On first launch the bundled sample course is copied in automatically.

### Quiz CSV format

First row is the header; the `section` column is optional (defaults to `main`):

```
section,question number,question,option 1,option 2,option 3,option 4,correct option number
Basics,1,Which keyword defines a class in Java?,class,struct,define,object,1
```

`marks` in the answers file is `1` if the chosen option equals the correct option
number, else `0`.

## Features

- Left navbar lists every course; **add a `.txt` and refresh** to load it.
- Per-course buttons: **notes toggle** (📝), **reset attempts** (↺), **delete → archive** (🗑).
- Section-wise collapsible widgets with per-section scores; sticky section headers.
- Header shows the live overall score and a light/dark toggle.
- **+ Add** uploads `.txt`/`.md` files into the course folder.
- **Topic search → Generate:** enter comma-separated topics; the app calls the
  Gemini API (key entered in-app, stored in `localStorage`) and saves a generated
  100-question quiz + notes, with a live streaming status bar. Get a free key at
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## Project layout

```
course/               sample + generated quizzes and notes
server/api.cjs        shared filesystem + Gemini-proxy request handler (CommonJS)
vite-api-plugin.js    serves the API in the Vite dev server
electron/main.cjs     desktop shell: localhost server + window + menus (CommonJS)
scripts/build.mjs     platform-arg build/packaging script
src/                  React app (components, api client, prompt builder)
```
