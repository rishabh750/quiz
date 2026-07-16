# Architecture

High-level view of InterviewPrep: the React frontend, the Spring Boot + PostgreSQL
backend, and how they are packaged for Docker. Diagrams are UML rendered with
Mermaid (component, deployment, and sequence — no class-level detail).

The core idea is **one React UI, two backends**. The frontend picks its backend at
runtime from `window.IS_DESKTOP`:

- **Desktop** → single-user, data in `localStorage`, LLM called directly from the app.
- **Web** → multi-user Spring Boot + PostgreSQL; data encrypted at rest **and** in transit; LLM proxied server-side.

## Component overview

```mermaid
graph TB
  subgraph UI["React UI (shared)"]
    V["Views<br/>AuthModal · Header · Notes · Quiz"]
    FAC["api.js facade"]
    SES["session.js / mode.js<br/>(IS_DESKTOP)"]
    LLM["gemini.js<br/>(stream client)"]
    V --> FAC
    V --> SES
    V --> LLM
  end

  subgraph Desktop["Desktop mode"]
    LOC["backends/local.js"]
    LS[("localStorage")]
    LOC --> LS
  end

  subgraph Web["Web mode"]
    REM["backends/remote.js<br/>+ auth.js (JWT)"]
  end

  subgraph Backend["Spring Boot backend"]
    API["/api controllers<br/>auth · account · courses · answers · generate"]
    SEC["security<br/>JWT · BCrypt"]
    CRY["crypto<br/>payload cipher · at-rest AES"]
    PROXY["llm<br/>provider stream proxy"]
    API --> SEC
    API --> CRY
    API --> PROXY
  end

  DB[("PostgreSQL<br/>users · courses<br/>questions · answers")]
  PROV["LLM providers<br/>Gemini · Claude · ChatGPT"]

  FAC -.desktop.-> LOC
  FAC -.web.-> REM
  REM -->|encrypted payload + Bearer JWT| API
  API --> DB
  CRY -->|encrypt/decrypt| DB
  LLM -.desktop: direct.-> PROV
  PROXY -.web: server-side.-> PROV
```

**Notes**

- `api.js` is the single seam: view components never branch on mode themselves.
- On desktop the browser calls the provider directly; on web the request is proxied
  through `/api/generate` using the account's stored (encrypted) key.
- The at-rest JPA converter transparently AES-GCM-encrypts sensitive columns on
  write and decrypts on read, so ciphertext is what actually rests in Postgres.
- A payload cipher filter decrypts each request body (RSA-wrapped AES-GCM) and
  encrypts each response, so `/api` traffic is ciphertext even in the network tab.

## Deployment (Docker Compose)

```mermaid
graph LR
  User(["Browser"])

  subgraph Host["Docker host"]
    subgraph C["single container"]
      SH["start.sh"]
      S["Spring Boot (Tomcat)<br/>serves /api + static UI"]
      DB[("PostgreSQL<br/>127.0.0.1:5432")]
      SH --> DB
      SH --> S
      S -->|127.0.0.1| DB
    end
  end

  V1[("pgdata volume")] -.-> DB
  V2[("appdata volume<br/>secrets")] -.-> S
  User -->|":8000"| S
  User -. put TLS in front .-> S
```

**Key properties**

- **One container, one command:** PostgreSQL, the API, and the UI all run in a
  single image. `start.sh` boots Postgres on `127.0.0.1`, then launches the app.
  Only port `8000` is published.
- **Multi-stage image:** a Node stage builds the React `dist/`; a Zulu JDK stage
  builds the Spring Boot jar; the final Zulu JRE stage adds PostgreSQL, so one image
  ships DB + UI + API. State lives in the `pgdata` and `appdata` volumes.
- **Secrets** (`JWT_SECRET`, `APP_ENCRYPTION_KEY`) come from `.env`; compose fails
  fast if unset. `APP_ENCRYPTION_KEY` must stay stable or encrypted data is lost.
- **State** lives in the `pgdata` volume.

Desktop apps are a separate deployment entirely — no containers, no backend; see
[DESKTOP.md](DESKTOP.md).

## Flow: encrypted transport (every /api call)

Payloads are ciphertext on the wire — even the register body in the network tab.

```mermaid
sequenceDiagram
  participant UI as React UI
  participant API as Spring Boot /api

  Note over UI,API: once, cached
  UI->>API: GET /api/crypto/public-key
  API-->>UI: RSA public key

  Note over UI,API: per request
  UI->>UI: random AES-256 key + IV
  UI->>UI: RSA-OAEP wrap AES key → X-Enc-Key header
  UI->>UI: AES-GCM encrypt body → {iv, d}
  UI->>API: request (header + encrypted body)
  API->>API: RSA unwrap AES key, AES-GCM decrypt body
  API->>API: JWT check + handle
  API->>API: AES-GCM encrypt response with same key
  API-->>UI: {iv, d} (X-Enc: 1)
  UI->>UI: AES-GCM decrypt → JSON
```

The `/generate` stream reuses the same AES key, encrypting each streamed chunk
(`base64(iv‖ciphertext)` per line) so the live token stream stays confidential too.

## Flow: register / login (web)

```mermaid
sequenceDiagram
  actor U as User
  participant UI as React UI
  participant API as Spring Boot /api
  participant DB as PostgreSQL

  U->>UI: register (email, password, provider, API key)
  UI->>API: POST /api/auth/register
  API->>API: BCrypt(password), AES-GCM(api_key)
  API->>DB: INSERT user (hash + ciphertext)
  API-->>UI: JWT
  UI->>UI: store token (localStorage)
  UI->>API: GET /api/me (Bearer JWT)
  API->>DB: SELECT user
  API-->>UI: { provider, has_api_key }
  UI-->>U: app landing
```

## Flow: generate a quiz / notes (web vs desktop)

```mermaid
sequenceDiagram
  actor U as User
  participant UI as React UI
  participant API as Spring Boot /api
  participant DB as PostgreSQL
  participant P as LLM provider

  Note over UI,P: Web mode — proxied, key never leaves the server
  U->>UI: Generate (topics, count, type)
  UI->>API: POST /api/generate (Bearer JWT)
  API->>DB: read user's encrypted API key → decrypt
  API->>P: stream prompt
  P-->>API: streamed tokens
  API-->>UI: streamed text
  UI->>API: POST /api/courses (parsed quiz / notes)
  API->>DB: store encrypted questions + notes

  Note over UI,P: Desktop mode — direct, no backend
  UI->>P: stream prompt (key from localStorage)
  P-->>UI: streamed tokens
  UI->>UI: parse + save to localStorage
```

## Flow: encryption at rest (web)

```mermaid
sequenceDiagram
  participant API as router
  participant M as SQLAlchemy model
  participant ET as AtRestConverter
  participant DB as PostgreSQL

  Note over API,DB: Write
  API->>M: save question / api_key / notes
  M->>ET: process_bind_param(value)
  ET->>ET: AES-GCM.encrypt (APP_ENCRYPTION_KEY)
  ET->>DB: store ciphertext (TEXT)

  Note over API,DB: Read
  API->>M: load row
  M->>ET: process_result_value(ciphertext)
  ET->>ET: AES-GCM.decrypt
  ET-->>API: plaintext (in-memory only)
```

## Data model (high level)

Ownership, not columns — every record is scoped to a user.

```mermaid
graph LR
  U["User<br/>email · password_hash<br/>provider · api_key🔒"]
  C["Course<br/>name · notes🔒 · archived"]
  Q["Question<br/>section · type<br/>question🔒 · options🔒<br/>answer🔒"]
  A["Answer<br/>candidate_answer<br/>marks"]

  U -->|owns| C
  C -->|has many| Q
  C -->|has many| A

  L["🔒 = AES-GCM-encrypted at rest"]
```

## Mode selection at a glance

| Aspect | Desktop | Web (Docker) |
|--------|---------|--------------|
| Selector | `window.IS_DESKTOP = true` (Electron preload) | unset in browser |
| Backend facade | `backends/local.js` | `backends/remote.js` + `auth.js` |
| Storage | `localStorage` (per browser) | PostgreSQL (per user, encrypted) |
| Accounts | none | register / login (JWT) |
| LLM call | direct browser → provider | proxied via `/api/generate` |
| Auth modal | hidden | shown as landing |

## Related docs

- [DEVELOPMENT.md](DEVELOPMENT.md) — run and develop both modes.
- [DESKTOP.md](DESKTOP.md) — desktop packaging.
- [DOCKER.md](DOCKER.md) — hosting the web app.
- [backend/README.md](../backend/README.md) — endpoints, config, schema.
