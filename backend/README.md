# InterviewPrep API (Spring Boot / Java 21)

Spring Boot 3.3 + PostgreSQL backend for the hosted (multi-user) deployment, built
for **Azul Zulu JDK 21**. Stores each user's courses, questions, notes, and answers,
isolated per account.

Two layers of encryption:

- **At rest** — the user's LLM **API key** and all **question / option / answer /
  notes** content are AES-256-GCM encrypted in the database (JPA attribute
  converter). Passwords are BCrypt-hashed.
- **In transit (application layer)** — every `/api` request/response body is
  encrypted end-to-end so payloads are ciphertext even in the browser network tab.
  The server publishes an RSA public key; each request carries a fresh AES-256 key
  (RSA-OAEP-wrapped in the `X-Enc-Key` header) and an AES-GCM-encrypted body, and
  the response is AES-GCM-encrypted with that same key. See
  [PayloadCipherFilter](src/main/java/com/interviewprep/crypto/PayloadCipherFilter.java).

Sessions use **JWT** (HS256, Bearer token).

## Run standalone

```bash
cd backend
export DATABASE_URL=postgresql://user:pass@localhost:5432/interviewprep
export APP_ENCRYPTION_KEY=$(python -c "import secrets;print(secrets.token_urlsafe(32))")
export SECRET_DIR=.secrets      # writable dir for auto-generated secrets in dev
./mvnw spring-boot:run
```

Tables auto-create on startup (`ddl-auto: update`), and a **default account is
seeded** (`admin@interviewprep.app` / `interviewprep` by default — override with the
`DEFAULT_USER_*` vars). Build a jar with `./mvnw -DskipTests package` → `target/app.jar`.

## Endpoints (all under `/api`)

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/crypto/public-key` | RSA public key for payload encryption (unencrypted) |
| GET  | `/health` | liveness (unencrypted) |
| POST | `/auth/register` | email, password, provider, api_key → JWT |
| POST | `/auth/login` | email, password → JWT |
| GET  | `/me` | current account (provider, has_api_key) |
| PATCH| `/account` | change provider and/or api_key |
| GET  | `/courses` / `/archive` | list course names |
| POST | `/courses` | upsert from `{filename, content}` (.txt → questions, .md → notes) |
| GET  | `/courses/{name}/questions` / `/notes` | fetch (decrypted) |
| POST | `/archive/{name}` / `/archive/{name}/revive` | archive / restore |
| DELETE | `/archive/{name}` | permanently delete an archived course |
| GET/POST/DELETE | `/answers/{name}` | list / save / reset |
| POST | `/generate` | stream a prompt to the account's provider (encrypted per-chunk) |

Auth is a Bearer JWT in the `Authorization` header. Every endpoint except
`/crypto/public-key` and `/health` expects the payload-encryption envelope.

## Config (environment variables)

| Var | Meaning |
|-----|---------|
| `DATABASE_URL` / `POSTGRES_URL` | Postgres URL; `postgres://`, `postgresql://`, `postgresql+driver://` are normalized |
| `APP_ENCRYPTION_KEY` | at-rest AES key material — **keep stable**. Auto-generated & persisted to `SECRET_DIR` if unset |
| `JWT_SECRET` | HS256 secret; derived from `APP_ENCRYPTION_KEY` if unset |
| `SECRET_DIR` | where auto-generated secrets persist (default `/data`) |
| `PORT` | HTTP port (default 8000) |
| `CORS_ORIGINS` | comma-separated allowed origins (`*` when the API also serves the UI) |
| `STATIC_DIR` | directory of the built frontend to serve at `/` (optional) |
| `DEFAULT_USER_EMAIL` / `DEFAULT_USER_PASSWORD` / `DEFAULT_USER_PROVIDER` / `DEFAULT_USER_API_KEY` | default account seeded on startup |

> The RSA transport keypair is generated per process. With multiple replicas behind
> a load balancer, either pin a shared keypair or use sticky sessions so a client's
> cached public key matches the instance that decrypts its request. The frontend
> auto-refetches the key on a mismatch.
