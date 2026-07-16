import { API_BASE } from './mode.js'

const TOKEN_KEY = 'ip_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export function isAuthed() {
  return !!getToken()
}

export function logout() {
  setToken('')
}

export async function apiFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = 'Bearer ' + token
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const res = await fetch(API_BASE + path, { ...opts, headers })
  if (!res.ok) {
    let msg = 'Request failed (' + res.status + ')'
    try {
      const data = await res.json()
      if (data && data.detail) msg = typeof data.detail === 'string' ? data.detail : msg
    } catch {
      void 0
    }
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return res
}

const json = (res) => res.json()

export async function register({ email, password, provider, apiKey }) {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, provider, api_key: apiKey || null }),
  })
  const data = await json(res)
  setToken(data.access_token)
  return data
}

export async function login({ email, password }) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const data = await json(res)
  setToken(data.access_token)
  return data
}

export async function fetchMe() {
  const res = await apiFetch('/api/me')
  return json(res)
}

export async function updateAccount({ provider, apiKey }) {
  const body = {}
  if (provider !== undefined) body.provider = provider
  if (apiKey !== undefined) body.api_key = apiKey
  const res = await apiFetch('/api/account', { method: 'PATCH', body: JSON.stringify(body) })
  return json(res)
}
