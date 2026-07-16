# Deploy to Vercel

InterviewPrep runs on Vercel as a hybrid app:

- the **React frontend** is built and served as static assets, and
- the **FastAPI backend** runs as a **Python serverless function** under `/api`.

Vercel does **not** run `docker-compose` or a bundled Postgres container, so the
database is a **managed Postgres** you attach in one click (Vercel Postgres / Neon).
Everything else is wired up already by [vercel.json](../vercel.json) and
[api/index.py](../api/index.py).

## Steps

1. **Push this repo to GitHub** and import it into Vercel
   (New Project → Import). No build settings to change — `vercel.json` defines them.

2. **Add a Postgres database.** In the project: **Storage → Create Database →
   Postgres** (Neon-backed). Vercel injects `POSTGRES_URL` / `DATABASE_URL` into the
   project automatically — the backend reads either.

3. **Set one environment variable** (Project → Settings → Environment Variables):

   | Var | Value |
   |-----|-------|
   | `APP_ENCRYPTION_KEY` | a Fernet key (see below) |

   Generate it once and keep it:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

   > **This is required on Vercel.** Serverless functions have no persistent disk,
   > so the key can't be auto-persisted like in Docker. It **must stay the same**
   > across deploys or existing encrypted data becomes unreadable. `JWT_SECRET` is
   > derived from it automatically (or set your own).

4. **Deploy.** On first request the app creates its tables and seeds the default
   account. Log in with:

   | Email | Password |
   |-------|----------|
   | `admin@interviewprep.app` | `interviewprep` |

   Then set your LLM API key under **Profile** (top-left 👤).

## Optional environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `JWT_SECRET` | derived from `APP_ENCRYPTION_KEY` | HS256 signing secret |
| `DEFAULT_USER_EMAIL` | `admin@interviewprep.app` | Seeded account email |
| `DEFAULT_USER_PASSWORD` | `interviewprep` | Seeded account password — **change for production** |
| `DEFAULT_USER_PROVIDER` | `gemini` | Seeded account provider |
| `DEFAULT_USER_API_KEY` | — | Pre-set the seeded account's API key |
| `DATABASE_URL` / `POSTGRES_URL` | from the attached DB | Postgres connection string |

## How it maps to Vercel

- [vercel.json](../vercel.json): builds the frontend (`@vercel/static-build` →
  `dist`) and the Python function (`@vercel/python` from
  [api/index.py](../api/index.py), which imports the FastAPI app from `backend/`).
  Routes send `/api/*` to the function and serve everything else from the static
  build (SPA fallback to `index.html`).
- The function uses a `NullPool` SQLAlchemy engine when running on Vercel (it sets
  the `VERCEL` env var), so it plays well with serverless connection limits — use
  the **pooled** `POSTGRES_URL` that Vercel provides.

## Notes & gotchas

- **Python 3.12** is used by Vercel's current Python runtime (the code needs 3.10+).
- The generation endpoint streams from the LLM provider; keep prompts/among request
  sizes within Vercel's function timeout for your plan (raise it in project settings
  if long generations time out).
- To speed up builds, you can set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` as a build-time
  env var (the desktop-only `electron` dev dependency otherwise downloads a binary
  during install that Vercel never uses).
- Prefer the pooled connection string for serverless; the non-pooled one can
  exhaust Postgres connections under load.
