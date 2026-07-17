# InterviewPrep API (Spring Boot / Java 21)

Spring Boot 3.3 API (Azul Zulu JDK 21) at the repo root. **In-memory H2** database —
a POC store that is **not persisted** across restarts. Per-user accounts (courses,
questions, notes, answers) isolated by JWT.

Encryption:
- **In transit** — every `/api` request/response body is end-to-end encrypted so
  payloads are ciphertext even in the browser network tab. The server publishes an
  RSA public key; each request carries a fresh AES-256 key (RSA-OAEP-wrapped in the
  `X-Enc-Key` header) and an AES-GCM body; the response is AES-GCM with the same key.
  See [PayloadCipherFilter](../src/main/java/com/interviewprep/crypto/PayloadCipherFilter.java).
  Falls back to plaintext when the browser has no Web Crypto (non-secure context).
- **At rest** — none; data lives only in RAM.

Sessions use **JWT** (HS256); passwords are **BCrypt**-hashed.

## Run

```bash
./mvnw spring-boot:run                    # :8000, seeds default account
./mvnw -q -DskipTests package             # -> target/app.jar
STATIC_DIR=ui/dist ./mvnw spring-boot:run # also serve the built UI at /
```

## Endpoints (all under `/api`)

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/crypto/public-key` | RSA public key for payload encryption (unencrypted) |
| GET  | `/health` | liveness (unencrypted) |
| POST | `/auth/register` / `/auth/login` | → JWT |
| GET  | `/me` · PATCH `/account` | account (provider, api key) |
| GET  | `/courses` / `/archive` | list names |
| POST | `/courses` | upsert `{filename, content}` (.txt → questions, .md → notes) |
| GET  | `/courses/{name}/questions` / `/notes` | fetch |
| POST | `/archive/{name}` / `/archive/{name}/revive` · DELETE `/archive/{name}` | archive / restore / purge |
| GET/POST/DELETE | `/answers/{name}` | list / save / reset |
| POST | `/generate` | stream a prompt to the account's provider (encrypted per-chunk) |

## Config (env vars — all optional)

| Var | Meaning |
|-----|---------|
| `PORT` | HTTP port (default 8000) |
| `JWT_SECRET` | HS256 secret; auto-generated to `SECRET_DIR` if unset |
| `SECRET_DIR` | where the generated JWT key is written (default `/tmp`) |
| `STATIC_DIR` | directory of the built UI to serve at `/` (optional) |
| `CORS_ORIGINS` | allowed origins if the UI is a separate origin (default `*`) |
| `DEFAULT_USER_EMAIL` / `_PASSWORD` / `_PROVIDER` / `_API_KEY` | seeded account |

> The RSA transport keypair is per process; with multiple replicas use sticky
> sessions or a shared keypair (the UI refetches the key on mismatch).
