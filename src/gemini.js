import { buildPrompt, slugify, DELIM, QUIZ_HEADER } from './prompt.js'

// Ask the local server (which proxies + streams Gemini) to generate study
// material, reporting progress as text arrives, then split the response into a
// quiz (.txt) and notes (.md) file. `onProgress(charCount)` is optional.
// params: { topics, count, difficulty }
export async function generateCourse(params, apiKey, onProgress) {
  const prompt = buildPrompt(params)
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, apiKey }),
  })
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Generation failed')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
    if (onProgress) onProgress(text.length)
  }

  const { quiz, notes } = parseGenerated(text)
  if (!quiz) throw new Error('Could not find the quiz in the model output')

  const slug = slugify(params.topics)
  const files = [{ filename: slug + '.txt', content: quiz }]
  if (notes) files.push({ filename: slug + '.md', content: notes })
  return files
}

// Pull the quiz and markdown notes out of the model's response. The prompt asks
// for two fenced code blocks; we also fall back to a raw-text scan. The quiz
// uses "$$$" as the field delimiter.
export function parseGenerated(text) {
  const blocks = []
  const re = /```[^\n]*\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(text))) blocks.push(m[1].replace(/\s+$/, ''))

  const looksLikeQuiz = (s) => {
    const first = s.split('\n').find((l) => l.trim() !== '') || ''
    if (first.includes(DELIM)) return true
    // mostly delimiter-separated rows
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

  // Fallback: no usable code fences — locate the quiz header in raw text.
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
