# InterviewPrep API

FastAPI + PostgreSQL backend for the hosted (multi-user) deployment. Stores each
user's courses, questions, notes, and answers, isolated per account. Sensitive
data is encrypted at rest with Fernet: the user's LLM **API key**, and all
**question / option / answer / notes** content. Passwords are bcrypt-hashed.

## Run standalone (without Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, APP_ENCRYPTION_KEY
uvicorn app.main:app --reload --port 8000
```

Tables are created on startup, and a **default account is seeded**
(`admin@interviewprep.app` / `interviewprep` by default — override with the
`DEFAULT_USER_*` vars). See [schema.sql](schema.sql) for the DDL.

## Endpoints (all under `/api`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | email, password, provider, api_key → JWT |
| POST | `/auth/login` | email, password → JWT |
| GET  | `/me` | current account (provider, has_api_key) |
| PATCH| `/account` | change provider and/or api_key |
| GET  | `/courses` / `/archive` | list course names |
| POST | `/courses` | upsert from `{filename, content}` (.txt parses to questions, .md → notes) |
| GET  | `/courses/{name}/questions` / `/notes` | fetch (decrypted) |
| POST | `/archive/{name}` / `/archive/{name}/revive` | archive / restore |
| GET/POST/DELETE | `/answers/{name}` | list / save / reset |
| POST | `/generate` | stream a prompt to the account's provider using the stored key |

Auth is a Bearer JWT in the `Authorization` header.

## Config

| Var | Meaning |
|-----|---------|
| `DATABASE_URL` / `POSTGRES_URL` | Postgres URL; `postgres://` / `postgresql://` are normalized automatically |
| `APP_ENCRYPTION_KEY` | Fernet key — **keep stable**, or encrypted data can't be read. Auto-generated & persisted to `SECRET_DIR` if unset |
| `JWT_SECRET` | HS256 signing secret; derived from `APP_ENCRYPTION_KEY` if unset |
| `SECRET_DIR` | where auto-generated secrets persist (default `/data`) |
| `CORS_ORIGINS` | comma-separated allowed origins (`*` when the API also serves the UI) |
| `STATIC_DIR` | directory of the built frontend to serve at `/` (optional) |
| `DEFAULT_USER_EMAIL` / `DEFAULT_USER_PASSWORD` / `DEFAULT_USER_PROVIDER` / `DEFAULT_USER_API_KEY` | default account seeded on startup |
