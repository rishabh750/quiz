// The frontend calls `${API_BASE}/api/...`. In production the Vercel gateway
// (vercel.json) routes `/svc/api/*` to the backend service, so the default base is
// `/svc`. For local dev point it straight at the backend, e.g.
// VITE_API_BASE=http://localhost:8000.
export const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '/svc'
