# Architecture

High-level view of InterviewPrep: the React frontend, the FastAPI + PostgreSQL
backend, and how they are packaged for Docker. Diagrams are UML rendered with
Mermaid (component, deployment, and sequence — no class-level detail).

The core idea is **one React UI, two backends**. The frontend picks its backend at
runtime from `window.IS_DESKTOP`:

- **Desktop** → single-user, data in `localStorage`, LLM called directly from the app.
- **Web** → multi-user FastAPI + PostgreSQL, data encrypted at rest, LLM proxied server-side.

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

  subgraph Backend["FastAPI backend"]
    API["/api routers<br/>auth · account · courses · answers · generate"]
    SEC["security.py<br/>JWT · bcrypt · Fernet"]
    CRY["crypto.py<br/>EncryptedText"]
    PROXY["llm.py<br/>provider stream proxy"]
    API --> SEC
    API --> CRY
    API --> PROXY
  end

  DB[("PostgreSQL<br/>users · courses<br/>questions · answers")]
  PROV["LLM providers<br/>Gemini · Claude · ChatGPT"]

  FAC -.desktop.-> LOC
  FAC -.web.-> REM
  REM -->|HTTPS + Bearer JWT| API
  API --> DB
  CRY -->|encrypt/decrypt| DB
  LLM -.desktop: direct.-> PROV
  PROXY -.web: server-side.-> PROV
```

**Notes**

- `api.js` is the single seam: view components never branch on mode themselves.
- On desktop the browser calls the provider directly; on web the request is proxied
  through `/api/generate` using the account's stored (encrypted) key.
- `EncryptedText` transparently encrypts sensitive columns on write and decrypts on
  read, so ciphertext is what actually rests in Postgres.

## Deployment (Docker Compose)

```mermaid
graph LR
  User(["Browser"])

  subgraph Host["Docker host"]
    subgraph Net["compose network (internal)"]
      subgraph App["app container"]
        S["FastAPI (uvicorn)<br/>serves /api + static UI"]
        ST["/static = built React dist"]
        S --- ST
      end
      DB[("db container<br/>postgres:16<br/>volume: pgdata")]
      S -->|DATABASE_URL| DB
    end
  end

  User -->|":8000 (HTTP)"| S
  User -. put TLS in front .-> S

  ENV["JWT_SECRET<br/>APP_ENCRYPTION_KEY<br/>(.env)"] -.-> S
```

**Key properties**

- **Single exposed surface:** only the `app` container publishes a port (`8000`),
  serving both the UI and the API. **Postgres has no host port** — reachable only
  inside the compose network.
- **Multi-stage image:** a Node stage builds the React `dist/`; the Python stage
  copies it in as `static/` and runs FastAPI, so one image ships UI + API.
- **Secrets** (`JWT_SECRET`, `APP_ENCRYPTION_KEY`) come from `.env`; compose fails
  fast if unset. `APP_ENCRYPTION_KEY` must stay stable or encrypted data is lost.
- **State** lives in the `pgdata` volume.

Desktop apps are a separate deployment entirely — no containers, no backend; see
[DESKTOP.md](DESKTOP.md).

## Flow: register / login (web)

```mermaid
sequenceDiagram
  actor U as User
  participant UI as React UI
  participant API as FastAPI /api
  participant DB as PostgreSQL

  U->>UI: register (email, password, provider, API key)
  UI->>API: POST /api/auth/register
  API->>API: bcrypt(password), Fernet(api_key)
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
  participant API as FastAPI /api
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
  participant ET as EncryptedText
  participant DB as PostgreSQL

  Note over API,DB: Write
  API->>M: save question / api_key / notes
  M->>ET: process_bind_param(value)
  ET->>ET: Fernet.encrypt (APP_ENCRYPTION_KEY)
  ET->>DB: store ciphertext (TEXT)

  Note over API,DB: Read
  API->>M: load row
  M->>ET: process_result_value(ciphertext)
  ET->>ET: Fernet.decrypt
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

  L["🔒 = Fernet-encrypted at rest"]
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
