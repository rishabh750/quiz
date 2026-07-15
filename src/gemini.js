import { buildPrompt, buildNotesPrompt, slugify, DELIM, QUIZ_HEADER } from './prompt.js'

const GEN = {
  gemini: {
    model: 'gemini-2.5-flash',
    url: (m) =>
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(m) +
      ':streamGenerateContent?alt=sse',
    headers: (key) => ({ 'Content-Type': 'application/json', 'x-goog-api-key': key }),
    body: (prompt, m) => {
      const generationConfig = { temperature: 0.6, maxOutputTokens: 32768 }
      if (/2\.5/.test(m)) generationConfig.thinkingConfig = { thinkingBudget: 0 }
      return { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig }
    },
    delta: (o) =>
      ((o.candidates && o.candidates[0] && o.candidates[0].content && o.candidates[0].content.parts) || [])
        .map((p) => p.text || '')
        .join(''),
  },
  openai: {
    model: 'gpt-4o',
    url: () => 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }),
    body: (prompt, m) => ({
      model: m,
      stream: true,
      max_tokens: 16384,
      messages: [{ role: 'user', content: prompt }],
    }),
    delta: (o) => (o.choices && o.choices[0] && o.choices[0].delta && o.choices[0].delta.content) || '',
  },
  anthropic: {
    model: 'claude-sonnet-5',
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    body: (prompt, m) => ({
      model: m,
      stream: true,
      max_tokens: 32000,
      messages: [{ role: 'user', content: prompt }],
    }),
    delta: (o) => (o.type === 'content_block_delta' && o.delta && o.delta.text) || '',
  },
}

async function streamGenerate(prompt, { provider, apiKey }, onProgress) {
  const gen = GEN[provider] || GEN.gemini
  const m = gen.model
  let res
  try {
    res = await fetch(gen.url(m), {
      method: 'POST',
      headers: gen.headers(apiKey),
      body: JSON.stringify(gen.body(prompt, m)),
    })
  } catch {
    throw new Error('Could not reach the provider from the browser (network or CORS).')
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data.error && data.error.message) || 'Generation failed')
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const t = gen.delta(JSON.parse(payload))
        if (t) {
          text += t
          if (onProgress) onProgress(text.length)
        }
      } catch {
        void 0
      }
    }
  }
  return text
}

export async function regenerateNotes(params, cred, onProgress) {
  const text = await streamGenerate(buildNotesPrompt(params), cred, onProgress)
  const notes = extractNotes(text)
  if (!notes) throw new Error('The model returned no notes')
  return notes
}

export function extractNotes(text) {
  const m = text.match(/```[^\n]*\n([\s\S]*?)```/)
  return (m ? m[1] : text).trim()
}

export async function generateCourse(params, cred, onProgress) {
  const text = await streamGenerate(buildPrompt(params), cred, onProgress)
  const { quiz, notes } = parseGenerated(text)
  if (!quiz) throw new Error('Could not find the quiz in the model output')

  const slug = slugify(params.topics)
  const files = [{ filename: slug + '.txt', content: quiz }]
  if (notes) files.push({ filename: slug + '.md', content: notes })
  return files
}

export function parseGenerated(text) {
  const blocks = []
  const re = /```[^\n]*\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(text))) blocks.push(m[1].replace(/\s+$/, ''))

  const looksLikeQuiz = (s) => {
    const first = s.split('\n').find((l) => l.trim() !== '') || ''
    if (first.includes(DELIM)) return true
    const lines = s.split('\n').filter((l) => l.trim() !== '')
    const rows = lines.filter((l) => l.includes(DELIM)).length
    return lines.length > 3 && rows >= lines.length * 0.6
  }

  let quiz = null
  let notes = null

  if (blocks.length) {
    quiz = blocks.find(looksLikeQuiz) || null
    notes = blocks.find((b) => b !== quiz) || null
  }

  if (!quiz) {
    const idx = text.indexOf(QUIZ_HEADER)
    const headerIdx = idx >= 0 ? idx : text.search(/section\$\$\$question number/i)
    if (headerIdx >= 0) {
      const rest = text.slice(headerIdx)
      const stop = rest.search(/\n#{1,6}\s/)
      quiz = (stop > 0 ? rest.slice(0, stop) : rest).trim()
      if (stop > 0 && !notes) notes = rest.slice(stop).trim()
    }
  }

  return { quiz, notes }
}
