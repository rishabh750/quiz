import {
  buildPrompt,
  buildNotesPrompt,
  buildSectionNotesPrompt,
  courseSlug,
  DELIM,
  QUIZ_HEADER,
} from './prompt.js'
import { API_BASE } from './config.js'
import { getToken } from './auth.js'
import { prepareRequest, decryptEnvelope, decryptChunk } from './crypto.js'

async function streamGenerate(prompt, cred, onProgress) {
  const { headers, body, aesKey } = await prepareRequest({ prompt, provider: cred && cred.provider })
  const token = getToken()
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await fetch(API_BASE + '/api/generate', { method: 'POST', headers, body })
  const encrypted = res.headers.get('X-Enc') === '1'
  if (!res.ok) {
    let t = await res.text()
    if (encrypted) t = await decryptEnvelope(aesKey, t)
    let msg = 'Generation failed'
    try {
      const data = JSON.parse(t)
      if (data && data.detail) msg = data.detail
    } catch {
      void 0
    }
    throw new Error(msg)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (encrypted) {
      buf += decoder.decode(value, { stream: true })
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        text += await decryptChunk(aesKey, line)
        if (onProgress) onProgress(text.length)
      }
    } else {
      text += decoder.decode(value, { stream: true })
      if (onProgress) onProgress(text.length)
    }
  }
  if (text.startsWith('[ERROR] ')) throw new Error(text.slice(8).trim())
  return text
}

export async function regenerateSection(params, cred, onProgress) {
  const text = await streamGenerate(buildSectionNotesPrompt(params), cred, onProgress)
  const md = extractNotes(text)
  if (!md) throw new Error('The model returned no notes')
  return md
}

export async function regenerateNotes(params, cred, onProgress) {
  const text = await streamGenerate(buildNotesPrompt(params), cred, onProgress)
  const notes = extractNotes(text)
  if (!notes) throw new Error('The model returned no notes')
  return notes
}

function extractNotes(text) {
  const m = text.match(/```[^\n]*\n([\s\S]*?)```/)
  return (m ? m[1] : text).trim()
}

export async function generateCourse(params, cred, onProgress) {
  const text = await streamGenerate(buildPrompt(params), cred, onProgress)
  const { quiz, notes } = parseGenerated(text)
  if (!quiz) throw new Error('Could not find the quiz in the model output')

  const slug = courseSlug(params)
  const files = [{ filename: slug + '.txt', content: quiz }]
  if (notes) files.push({ filename: slug + '.md', content: notes })
  return files
}

function parseGenerated(text) {
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
