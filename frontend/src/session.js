import { PROVIDERS } from './providers.js'

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
