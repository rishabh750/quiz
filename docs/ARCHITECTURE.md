# Architecture

React UI + Python **FastAPI** API, deployed as **two Vercel services** (a static
`frontend/` and a `backend/` ASGI app). Data is stored in **MongoDB** (shared across
instances); `MONGODB_URI` is required. Diagrams are Mermaid.

## Components

```mermaid
graph TB
  subgraph UI["React UI (frontend/) — static build"]
    V["Views<br/>AuthModal · Header · Notes · Quiz"]
    API["auth.js (REST + JWT)"]
    LLM["generate.js<br/>(streaming client, all providers)"]
    V --> API
    V --> LLM
  end

  subgraph Backend["FastAPI (backend/, main:app) — Vercel service"]
    GW["GatewayPrefixMiddleware<br/>strip /svc"]
    R["/api routers<br/>auth · account · courses · answers · generate · system"]
    SEC["security<br/>JWT · BCrypt"]
    PROXY["llm<br/>provider stream proxy"]
    GW --> R --> SEC
    R --> PROXY
  end

  STORE[("MongoDB<br/>users (courses<br/>questions · answers<br/>embedded)")]
  PROV["LLM providers<br/>Gemini · Claude · ChatGPT"]

  API -->|JSON over HTTPS + Bearer JWT| GW
  LLM -->|JSON over HTTPS + Bearer JWT| GW
  R --> STORE
  PROXY -.server-side.-> PROV
```

- Requests and responses are plain JSON over **HTTPS/TLS**; confidentiality in
  transit is provided by the transport (Vercel terminates TLS for both services).
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
  instance serves any request. `JWT_SECRET` uses a stable default (override in prod)
  so tokens work across instances too.

## Flow: generate

```mermaid
sequenceDiagram
  actor U as User
  participant UI as React UI
  participant API as FastAPI /api
  participant P as LLM provider
  U->>UI: Generate (company, role, round, topics)
  UI->>API: POST /api/generate
  API->>API: read account's API key
  API->>P: stream prompt (httpx)
  P-->>API: tokens
  API-->>UI: streamed text chunks
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
