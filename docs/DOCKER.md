# Docker deployment (hosted web app)

Host the **multi-user** InterviewPrep web app (Spring Boot / Java 21 Zulu) as a
single container image, backed by PostgreSQL. Each user's LLM **API key** and their
**questions / options / answers / notes** are **AES-GCM encrypted at rest**;
passwords are BCrypt-hashed; sessions use **JWT**; every `/api` payload is
**end-to-end encrypted in transit**; every query is scoped to the authenticated user.

This is separate from the desktop apps, which use `localStorage` and no backend —
see [DESKTOP.md](DESKTOP.md). For Vercel, see [VERCEL.md](VERCEL.md).

## Deploy — one command, one container

Everything (PostgreSQL + API + UI) runs inside a **single container**.

```bash
docker compose up --build -d
```

…or without Compose:

```bash
docker build -t interviewprep .
docker run -d -p 8000:8000 \
  -v ip_pgdata:/var/lib/postgresql/data \
  -v ip_appdata:/data \
  interviewprep
```

Open **http://localhost:8000** and log in with the default account:

| Email | Password |
|-------|----------|
| `admin@interviewprep.app` | `interviewprep` |

Then open **Profile** (top-left 👤) to set your Gemini / Claude / ChatGPT API key.
That's it — no `.env`, no external database, no secrets to generate.

**What happens automatically inside the container:**

- PostgreSQL is initialized (into the `pgdata` volume) and started.
- The Spring Boot API connects to it, creates tables, and **seeds the default account**.
- The API + built UI are served on **port 8000** (the only exposed port).
- The encryption key + JWT secret are **generated and persisted** to the `appdata`
  volume on first run and reused on restart.

## Architecture

A single all-in-one image ([Dockerfile](../Dockerfile)) built in stages: a Node
stage builds the frontend, a Zulu JDK stage builds the Spring Boot jar, and the
final Zulu JRE stage adds PostgreSQL. [docker/start.sh](../docker/start.sh) starts
Postgres, then launches the app (which serves the UI at `/` and the API at `/api`).
Two volumes hold state: `pgdata` (database) and `appdata` (secrets).

> **Access over HTTPS or `http://localhost`** to keep payload encryption on. The
> browser's WebCrypto API (used to encrypt request/response bodies) only works in a
> secure context; over plain `http://<remote-ip>` the app still works but falls back
> to unencrypted payloads. Put a TLS terminator in front for remote access.

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
| `APP_ENCRYPTION_KEY` | auto (persisted) | at-rest AES key material — set to pin it |
| `JWT_SECRET` | derived from the encryption key | HS256 signing secret |
| `DATABASE_URL` | embedded PostgreSQL | Point at an external Postgres instead |

> ⚠️ The encryption key lives on the `appdata` volume. **`docker compose down -v`
> deletes it** (and the database), making existing encrypted data unrecoverable.
> For a portable, backed-up setup, set `APP_ENCRYPTION_KEY` in `.env` to any stable
> random string (e.g. `openssl rand -base64 32`) and store it safely. Also **change
> the default password** for anything beyond local use.

## Production notes

- **Put TLS in front.** The app serves plain HTTP on 8000; terminate HTTPS with
  Caddy / Nginx / your PaaS. HTTPS also keeps payload encryption active (see above).
- **Persistence** is the `pgdata` (database) and `appdata` (secrets) volumes — back
  both up.
- The single-container image is ideal for simple self-hosting; for scale, run
  multiple stateless API replicas against an external managed Postgres (set
  `DATABASE_URL`) instead of the embedded one.

## Run the backend without Docker

See [backend/README.md](../backend/README.md) and [DEVELOPMENT.md](DEVELOPMENT.md).
