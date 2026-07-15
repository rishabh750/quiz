export const PROVIDERS = {
  gemini: { label: 'Gemini', keyUrl: 'https://aistudio.google.com/apikey' },
  anthropic: { label: 'Claude', keyUrl: 'https://console.anthropic.com/settings/keys' },
  openai: { label: 'ChatGPT', keyUrl: 'https://platform.openai.com/api-keys' },
}

export const PROVIDER_IDS = Object.keys(PROVIDERS)
const DEFAULT_PROVIDER = 'gemini'

const KEYS_STORAGE = 'llmKeys'
const PROVIDER_STORAGE = 'llmProvider'

function loadKeys() {
  try {
    return JSON.parse(localStorage.getItem(KEYS_STORAGE)) || {}
  } catch {
    return {}
  }
}

export function getProvider() {
  const p = localStorage.getItem(PROVIDER_STORAGE)
  return PROVIDERS[p] ? p : DEFAULT_PROVIDER
}

export function setProvider(provider) {
  if (PROVIDERS[provider]) localStorage.setItem(PROVIDER_STORAGE, provider)
}

export function getKey(provider) {
  return loadKeys()[provider] || ''
}

export function setKey(provider, key) {
  const keys = loadKeys()
  if (key) keys[provider] = key
  else delete keys[provider]
  localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys))
}
