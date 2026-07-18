import { PROVIDERS } from './providers.js'

// Account state for the signed-in user, hydrated from GET /api/me after auth.
let state = { provider: 'gemini', hasKey: false, email: '' }

export function setSession(s) {
  state = { ...state, ...s }
}

export function currentEmail() {
  return state.email
}

function currentProvider() {
  return state.provider
}

export function providerLabel() {
  return PROVIDERS[currentProvider()].label
}

export function hasKey() {
  return state.hasKey
}

export function cred() {
  return { provider: state.provider }
}
