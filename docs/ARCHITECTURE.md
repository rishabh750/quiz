# Architecture

React UI + Python **FastAPI** API, deployed as **two Vercel services** (a static
`frontend/` and a `backend/` ASGI app). Data is stored in **MongoDB** (shared across
instances); `MONGODB_URI` is required. Diagrams are Mermaid.

## Components

```mermaid
graph TB
  subgraph UI["React UI (frontend/) — static build"]
    V["Views<br/>AuthModal · Header · Notes · Quiz"]
    API["api.js (REST + JWT)"]
    CR["crypto.js<br/>RSA-OAEP + AES-GCM"]
    LLM["generate.js<br/>(streaming client, all providers)"]
    V --> API --> CR
    V --> LLM --> CR
  end

  subgraph Backend["FastAPI (backend/, main:app) — Vercel service"]
    GW["GatewayPrefixMiddleware<br/>strip /svc"]
    MW["PayloadCipherMiddleware<br/>decrypt req / encrypt resp"]
    R["/api routers<br/>auth · account · courses · answers · generate · system"]
    SEC["security<br/>JWT · BCrypt"]
    PROXY["llm<br/>provider stream proxy"]
    GW --> MW --> R --> SEC
    R --> PROXY
  end

  STORE[("MongoDB<br/>users (courses<br/>questions · answers<br/>embedded)")]
  PROV["LLM providers<br/>Gemini · Claude · ChatGPT"]

  CR -->|encrypted payload + Bearer JWT| GW
  R --> STORE
  PROXY -.server-side.-> PROV
```

- The UI encrypts every `/api` body and decrypts every response ([crypto.js](../frontend/src/crypto.js));
  the server does the inverse in an ASGI middleware ([PayloadCipherMiddleware](../backend/crypto.py)),
  so routers see plain JSON.
- Generation is **proxied** server-side (`/api/generate`) using the account's key —
  the key never reaches the browser.
- The frontend calls `/svc/api/*`; the gateway forwards to the backend, whose
  `GatewayPrefixMiddleware` strips `/svc` so routes stay canonical under `/api`.

## Deployment (Vercel — two services)

```mermaid
graph LR
  User(["Browser"])
  subgraph Vercel
    GWY{{"gateway<br/>vercel.json rewrites"}}
    FE["frontend service<br/>static (Vite build)"]
    BE["backend service<br/>main:app (FastAPI)"]
  end
  DB[("MongoDB Atlas")]
  User --> GWY
  GWY -->|"/svc/api/*"| BE
  GWY -->|"/(.*)"| FE
  BE -->|"MONGODB_URI"| DB
```

- `vercel.json` defines a `frontend/` service and a `backend/` service; the gateway
  routes `/svc/api/*` to the backend and everything else to the frontend.
- The backend is stateless — all data lives in **MongoDB** (`MONGODB_URI`), so any
  instance serves any request. `JWT_SECRET` / `RSA_PRIVATE_KEY` use stable defaults
  (override in prod) so tokens and the transport keypair work across instances too.

## Flow: encrypted transport (every /api call)

```mermaid
sequenceDiagram
  participant UI as React UI
  participant API as FastAPI /api
  Note over UI,API: once, cached
  UI->>API: GET /api/crypto/public-key
  API-->>UI: RSA public key (SPKI)
  Note over UI,API: per request
  UI->>UI: random AES key + IV; RSA-wrap key → X-Enc-Key; AES-GCM body
  UI->>API: request (header + encrypted body {iv, d})
  API->>API: RSA-unwrap key, AES-GCM decrypt, JWT check, handle
  API-->>UI: AES-GCM response (same key), X-Enc: 1
  UI->>UI: decrypt → JSON
```

Without Web Crypto (non-secure context) the UI sends plaintext and the server
passes it through — so it still works over plain HTTP, just unencrypted.
`/api/generate` reuses the AES key to encrypt each streamed chunk as
`base64(iv ‖ ciphertext)\n`.

## Flow: generate

```mermaid
sequenceDiagram
  actor U as User
  participant UI as React UI
  participant API as FastAPI /api
  participant P as LLM provider
  U->>UI: Generate (company, role, round, topics)
  UI->>API: POST /api/generate (encrypted)
  API->>API: read account's API key
  API->>P: stream prompt (httpx)
  P-->>API: tokens
  API-->>UI: encrypted chunks
  UI->>API: POST /api/courses (parsed quiz + notes)
```

## Data model

Every record is scoped to a user. Each user is one MongoDB document with courses
(and their questions/answers) embedded; see [store.py](../backend/store.py).

```mermaid
graph LR
  U["User<br/>email · password_hash<br/>provider · api_key"]
  C["Course<br/>name · notes · archived"]
  Q["Question<br/>section · qtype · question<br/>options · correct_option · answer"]
  A["Answer<br/>candidate_answer · marks"]
  U -->|owns| C
  C -->|has many| Q
  C -->|has many| A
```
