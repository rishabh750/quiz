# Architecture

React UI + Spring Boot (Java 21) API, packaged as one container. **In-memory H2**
(POC — no persistence). Diagrams are Mermaid (render on GitHub).

## Components

```mermaid
graph TB
  subgraph UI["React UI (ui/)"]
    V["Views<br/>AuthModal · Header · Notes · Quiz"]
    API["api.js (REST + JWT)"]
    CR["crypto.js<br/>RSA-OAEP + AES-GCM"]
    LLM["gemini.js (stream client)"]
    V --> API --> CR
    V --> LLM --> CR
  end

  subgraph Backend["Spring Boot API (root)"]
    CTL["/api controllers<br/>auth · account · courses · answers · generate"]
    SEC["security<br/>JWT · BCrypt"]
    CIP["crypto<br/>payload cipher filter"]
    PROXY["llm<br/>provider stream proxy"]
    CTL --> SEC
    CTL --> CIP
    CTL --> PROXY
  end

  DB[("H2 in-memory<br/>users · courses<br/>questions · answers")]
  PROV["LLM providers<br/>Gemini · Claude · ChatGPT"]

  CR -->|encrypted payload + Bearer JWT| CIP
  CTL --> DB
  PROXY -.server-side.-> PROV
```

- The UI encrypts every `/api` body and decrypts every response ([crypto.js](../ui/src/crypto.js));
  the server does the inverse in a filter ([PayloadCipherFilter](../src/main/java/com/interviewprep/crypto/PayloadCipherFilter.java)),
  so controllers see plain JSON.
- Generation is **proxied** server-side (`/api/generate`) using the account's key —
  the key never reaches the browser.
- Same origin in the container: Spring Boot serves the built UI at `/` and the API at
  `/api`, so no CORS.

## Deployment (single container)

```mermaid
graph LR
  User(["Browser"])
  subgraph C["one container (Dockerfile)"]
    S["Spring Boot (Tomcat)<br/>serves /api + static UI"]
    DB[("H2 in-memory")]
    S --- DB
  end
  User -->|":8000 (HTTPS in prod)"| S
```

- Multi-stage build: Node builds `ui/dist` → Zulu JDK builds the jar → Zulu JRE runs
  it with the UI copied to `static/`.
- No database container, no volumes — H2 lives in the JVM. **Restart = data gone.**
- The JVM starts with non-blocking entropy (`-Djava.security.egd=file:/dev/./urandom`)
  and cold-start flags (`-XX:TieredStopAtLevel=1 -XX:+UseSerialGC`) so it binds the
  port in ~5s — inside Vercel's 15s container-startup limit. Without the entropy flag,
  RSA/JWT key generation can stall on `/dev/random` and miss the window.

## Flow: encrypted transport (every /api call)

```mermaid
sequenceDiagram
  participant UI as React UI
  participant API as Spring Boot /api
  Note over UI,API: once, cached
  UI->>API: GET /api/crypto/public-key
  API-->>UI: RSA public key
  Note over UI,API: per request
  UI->>UI: random AES key + IV; RSA-wrap key → X-Enc-Key; AES-GCM body
  UI->>API: request (header + encrypted body)
  API->>API: RSA-unwrap key, AES-GCM decrypt, JWT check, handle
  API-->>UI: AES-GCM response (same key)
  UI->>UI: decrypt → JSON
```

Without Web Crypto (non-secure context) the UI sends plaintext and the server passes
it through — so it still works over plain HTTP, just unencrypted. `/generate` reuses
the AES key to encrypt each streamed chunk.

## Flow: generate

```mermaid
sequenceDiagram
  actor U as User
  participant UI as React UI
  participant API as Spring Boot /api
  participant P as LLM provider
  U->>UI: Generate (company, role, round, topics)
  UI->>API: POST /api/generate (encrypted)
  API->>API: read account's API key
  API->>P: stream prompt
  P-->>API: tokens
  API-->>UI: encrypted chunks
  UI->>API: POST /api/courses (parsed quiz + notes)
```

## Data model

Every record scoped to a user; all in-memory.

```mermaid
graph LR
  U["User<br/>email · password_hash<br/>provider · api_key"]
  C["Course<br/>name · notes · archived"]
  Q["Question<br/>section · type · question<br/>options · answer"]
  A["Answer<br/>candidate_answer · marks"]
  U -->|owns| C
  C -->|has many| Q
  C -->|has many| A
```
