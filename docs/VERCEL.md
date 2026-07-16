# Deploy with Vercel (frontend) + a container API

The backend is now **Java Spring Boot**, which **cannot run as a Vercel serverless
function** (Vercel has no Java runtime). So the split is:

- **Frontend (static React)** → hosted on **Vercel**.
- **Backend (Spring Boot + PostgreSQL)** → runs as a **container** on a host that
  runs Docker images: **Railway, Render, Fly.io, Google Cloud Run**, a VPS, etc.

If you'd rather keep everything in one place, skip Vercel and just use Docker
Compose — see [DOCKER.md](DOCKER.md).

## 1. Deploy the API container

Build the single self-contained image (UI is bundled too, but you'll point Vercel
at its own copy) and run it against a managed Postgres (Neon, Supabase, RDS, …):

```bash
docker build -f Dockerfile.vercel -t interviewprep .
```

Deploy that image to your container host and set env vars:

| Var | Value |
|-----|-------|
| `DATABASE_URL` | your managed Postgres URL (`postgresql://…`) |
| `APP_ENCRYPTION_KEY` | a stable secret — **required**, keep it constant |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://your-app.vercel.app` |
| `PORT` | injected by the platform (the app honors `$PORT`) |

The container exposes the API at `/api`. Note its public URL (e.g.
`https://interviewprep.up.railway.app`).

> **`APP_ENCRYPTION_KEY` must stay constant** across restarts/deploys or encrypted
> data becomes unreadable. `JWT_SECRET` derives from it (or set your own). On first
> boot the default account is seeded (`admin@interviewprep.app` / `interviewprep`).

## 2. Deploy the frontend to Vercel

Import the repo into Vercel. Build settings:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variable:** `VITE_API_BASE` = your API container URL from step 1.

The frontend calls `VITE_API_BASE + /api/...` for everything, with end-to-end
encrypted payloads and a JWT.

## Cross-origin & HTTPS notes

- Set `CORS_ORIGINS` on the API to your exact Vercel origin (the app uses Bearer
  tokens, not cookies, so no credentialed CORS needed).
- Both ends must be **HTTPS** in production — the frontend's payload encryption uses
  the browser **WebCrypto** API, which is only available in a secure context.
  Vercel is HTTPS by default; make sure your container host terminates TLS too.

## Simpler alternative

One command, everything together (Postgres + API + UI), no external services:

```bash
docker compose up --build -d   # http://localhost:8000
```

See [DOCKER.md](DOCKER.md).
