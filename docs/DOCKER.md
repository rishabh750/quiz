# Docker deployment (hosted web app)

Host the **multi-user** InterviewPrep web app as a single container image, backed
by PostgreSQL. Each user's LLM **API key** and their **questions / options /
answers / notes** are **encrypted at rest** (Fernet); passwords are bcrypt-hashed;
every query is scoped to the authenticated user.

This is separate from the desktop apps, which use `localStorage` and no backend —
see [DESKTOP.md](DESKTOP.md). For Vercel, see [VERCEL.md](VERCEL.md).

## Deploy — one command

```bash
docker compose up --build -d
```

Open **http://localhost:8000** and log in with the default account:

| Email | Password |
|-------|----------|
| `admin@interviewprep.app` | `interviewprep` |

Then open **Profile** (top-left 👤) to set your Gemini / Claude / ChatGPT API key.
That's it — no `.env`, no secrets to generate.

**What happens automatically:**

- Postgres starts (internal to the compose network, **no host port**).
- The app container builds the UI and serves it plus the API on **port 8000** (the
  only exposed port).
- On first run the app **generates and persists** its encryption key + JWT secret to
  the `appdata` volume, and **seeds the default account**. Restarts reuse them.

## Architecture

Two services in [docker-compose.yml](../docker-compose.yml):

- **`db`** — `postgres:16-alpine`, data on the `pgdata` volume, no host port.
- **`app`** — multi-stage [Dockerfile](../Dockerfile): a Node stage builds the
  frontend, a Python stage runs FastAPI, serving the built UI at `/` and the API at
  `/api`. Secrets persist on the `appdata` volume.

## Manage

```bash
docker compose logs -f app     # logs
docker compose up --build -d    # update after a git pull
docker compose down             # stop, keep data
docker compose down -v          # stop AND wipe all data (incl. secrets — see below)
```

## Overrides (optional)

Everything works with zero config. To change defaults, copy the template and set
only what you need — compose loads `.env` if present:

```bash
cp .env.example .env
```

| Var | Default | Purpose |
|-----|---------|---------|
| `DEFAULT_USER_EMAIL` | `admin@interviewprep.app` | Seeded account email |
| `DEFAULT_USER_PASSWORD` | `interviewprep` | Seeded account password |
| `DEFAULT_USER_PROVIDER` | `gemini` | Seeded account provider |
| `DEFAULT_USER_API_KEY` | — | Pre-set the seeded account's API key |
| `APP_ENCRYPTION_KEY` | auto (persisted) | Fernet key — set to pin it explicitly |
| `JWT_SECRET` | derived from the encryption key | HS256 signing secret |
| `DATABASE_URL` | bundled `db` service | Point at an external Postgres instead |

> ⚠️ The encryption key lives on the `appdata` volume. **`docker compose down -v`
> deletes it**, making existing encrypted data unrecoverable. For a portable,
> backed-up setup, set `APP_ENCRYPTION_KEY` in `.env` and store it safely
> (generate one with
> `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
> Also **change the default password** for anything beyond local use.

## Production notes

- **Put TLS in front.** The app serves plain HTTP on 8000; terminate HTTPS with
  Caddy / Nginx / your PaaS.
- **Persistence** is the `pgdata` (data) and `appdata` (secrets) volumes — back
  both up.
- **Change default DB credentials** and consider a managed Postgres for real
  deployments.

## Run the backend without Docker

See [backend/README.md](../backend/README.md) and [DEVELOPMENT.md](DEVELOPMENT.md).
