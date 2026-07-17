import { IS_DESKTOP } from './mode.js'
import { PROVIDERS, getProvider, getKey } from './providers.js'

let webState = { provider: 'gemini', hasKey: false, email: '' }

export function setWebSession(s) {
  webState = { ...webState, ...s }
}

export function currentEmail() {
  return IS_DESKTOP ? '' : webState.email
}

export function currentProvider() {
  return IS_DESKTOP ? getProvider() : webState.provider
}

export function providerLabel() {
  return PROVIDERS[currentProvider()].label
}

export function hasKey() {
  return IS_DESKTOP ? !!getKey(getProvider()) : webState.hasKey
}

export function cred() {
  if (IS_DESKTOP) {
    const p = getProvider()
    return { provider: p, apiKey: getKey(p) }
  }
  return { provider: webState.provider }
}
