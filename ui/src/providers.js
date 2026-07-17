export const PROVIDERS = {
  gemini: { label: 'Gemini', keyUrl: 'https://aistudio.google.com/apikey' },
  anthropic: { label: 'Claude', keyUrl: 'https://console.anthropic.com/settings/keys' },
  openai: { label: 'ChatGPT', keyUrl: 'https://platform.openai.com/api-keys' },
}

export const PROVIDER_IDS = Object.keys(PROVIDERS)
