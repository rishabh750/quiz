const fs = require('node:fs')
const path = require('node:path')

// Minimal RFC-4180-ish CSV parser that handles quoted fields containing commas.
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map(parseCsvLine)
}

// Parse a quiz file. Fields are separated by "$$$" (preferred — no escaping
// needed) or, for older files, by commas. The delimiter is detected from the
// header row so both formats keep working.
function parseQuiz(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return []
  if (lines[0].includes('$$$')) {
    return lines.map((l) => l.split('$$$').map((c) => c.trim()))
  }
  return lines.map(parseCsvLine)
}

// Quote a CSV field if it contains comma, quote or newline.
function csvField(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

const ANSWERS_HEADER = 'question number,candidate answer,marks'

// Default Gemini model used for generation. Large output budget so a
// 100-question quiz plus notes fit in one response.
const DEFAULT_MODEL = 'gemini-2.5-flash'

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) }
      catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

// Build an async request handler for the /api routes, backed by the given
// folders. Returns true when it handled the request, false otherwise so the
// caller can fall through to static-file / next-middleware handling.
function createApiHandler({ courseDir, answersDir, archiveDir }) {
  const answersFile = (course) => path.join(answersDir, course + '.csv')

  // Move a course's quiz (.txt) and notes (.md) between two folders.
  const moveCourseFiles = (name, fromDir, toDir) => {
    if (!fs.existsSync(toDir)) fs.mkdirSync(toDir, { recursive: true })
    const moved = []
    for (const ext of ['.txt', '.md']) {
      const src = path.join(fromDir, name + ext)
      if (fs.existsSync(src)) {
        const dest = path.join(toDir, name + ext)
        try {
          fs.renameSync(src, dest)
        } catch {
          // Fallback for cross-device moves.
          fs.copyFileSync(src, dest)
          fs.unlinkSync(src)
        }
        moved.push(name + ext)
      }
    }
    return moved
  }

  const listArchive = () => {
    if (!fs.existsSync(archiveDir)) return []
    return fs
      .readdirSync(archiveDir)
      .filter((f) => f.toLowerCase().endsWith('.txt'))
      .map((f) => f.replace(/\.txt$/i, ''))
      .sort()
  }

  const readAnswers = (course) => {
    const file = answersFile(course)
    if (!fs.existsSync(file)) return []
    const rows = parseCsv(fs.readFileSync(file, 'utf8'))
    return rows.slice(1).map((r) => ({
      questionNumber: r[0],
      candidateAnswer: r[1],
      marks: Number(r[2]) || 0,
    }))
  }

  const writeAnswers = (course, answers) => {
    const file = answersFile(course)
    if (answers.length === 0) {
      if (fs.existsSync(file)) fs.unlinkSync(file)
      return
    }
    if (!fs.existsSync(answersDir)) fs.mkdirSync(answersDir, { recursive: true })
    const lines = [ANSWERS_HEADER]
    for (const a of answers) {
      lines.push([a.questionNumber, a.candidateAnswer, a.marks].map(csvField).join(','))
    }
    fs.writeFileSync(file, lines.join('\n') + '\n')
  }

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost')
    if (!/^\/api(\/|$)/.test(url.pathname)) return false

    try {
      const parts = url.pathname.replace(/^\/api/, '').split('/').filter(Boolean)

      // GET /api/courses -> list course names
      if (req.method === 'GET' && parts[0] === 'courses' && parts.length === 1) {
        if (!fs.existsSync(courseDir)) { send(res, 200, []); return true }
        const courses = fs
          .readdirSync(courseDir)
          .filter((f) => f.toLowerCase().endsWith('.txt'))
          .map((f) => f.replace(/\.txt$/i, ''))
          .sort()
        send(res, 200, courses)
        return true
      }

      // GET /api/archive -> list archived course names
      if (req.method === 'GET' && parts[0] === 'archive' && parts.length === 1) {
        send(res, 200, listArchive())
        return true
      }

      // POST /api/archive/:name -> archive a course: clear its answers and move
      // its quiz + notes from the course folder into the archive folder.
      if (req.method === 'POST' && parts[0] === 'archive' && parts.length === 2) {
        const name = path.basename(decodeURIComponent(parts[1]))
        writeAnswers(name, [])
        const moved = moveCourseFiles(name, courseDir, archiveDir)
        send(res, 200, { archived: name, moved, archive: listArchive() })
        return true
      }

      // POST /api/archive/:name/revive -> move a course's quiz + notes back
      // from the archive folder into the course folder.
      if (req.method === 'POST' && parts[0] === 'archive' && parts.length === 3 && parts[2] === 'revive') {
        const name = path.basename(decodeURIComponent(parts[1]))
        const moved = moveCourseFiles(name, archiveDir, courseDir)
        send(res, 200, { revived: name, moved, archive: listArchive() })
        return true
      }

      // POST /api/courses -> upload a quiz (.txt) or notes (.md) file
      if (req.method === 'POST' && parts[0] === 'courses' && parts.length === 1) {
        const { filename, content } = await readJsonBody(req)
        const safe = path.basename(String(filename || ''))
        if (!/\.(txt|md)$/i.test(safe)) {
          send(res, 400, { error: 'only .txt (quiz) and .md (notes) files are allowed' })
          return true
        }
        if (!fs.existsSync(courseDir)) fs.mkdirSync(courseDir, { recursive: true })
        fs.writeFileSync(path.join(courseDir, safe), String(content ?? ''))
        send(res, 200, { saved: safe })
        return true
      }

      // POST /api/generate -> proxy a prompt to the Gemini API and STREAM its
      // text back as it arrives (chunked text/plain), so the UI can show live
      // progress. Proxied to avoid CORS and keep the key out of page URLs.
      if (req.method === 'POST' && parts[0] === 'generate' && parts.length === 1) {
        const { prompt, apiKey, model } = await readJsonBody(req)
        if (!apiKey) { send(res, 400, { error: 'missing API key' }); return true }
        if (!prompt) { send(res, 400, { error: 'missing prompt' }); return true }
        const m = model || DEFAULT_MODEL
        const endpoint =
          'https://generativelanguage.googleapis.com/v1beta/models/' +
          encodeURIComponent(m) +
          ':streamGenerateContent?alt=sse'
        const generationConfig = { temperature: 0.6, maxOutputTokens: 32768 }
        // For 2.5 models, turn off "thinking" so the whole output budget goes
        // to the quiz/notes content rather than reasoning tokens (also faster).
        if (/2\.5/.test(m)) generationConfig.thinkingConfig = { thinkingBudget: 0 }
        const gres = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig,
          }),
        })
        if (!gres.ok || !gres.body) {
          const data = await gres.json().catch(() => ({}))
          send(res, gres.ok ? 502 : gres.status, {
            error: (data.error && data.error.message) || 'Gemini request failed',
          })
          return true
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')

        const reader = gres.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          // Server-Sent Events: one "data: {json}" per line.
          let nl
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim()
            buf = buf.slice(nl + 1)
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (!payload || payload === '[DONE]') continue
            try {
              const obj = JSON.parse(payload)
              const t = ((obj.candidates && obj.candidates[0]?.content?.parts) || [])
                .map((p) => p.text || '')
                .join('')
              if (t) res.write(t)
            } catch {
              // ignore partial / non-JSON keepalive lines
            }
          }
        }
        res.end()
        return true
      }

      // GET /api/courses/:name -> parsed questions
      if (req.method === 'GET' && parts[0] === 'courses' && parts.length === 2) {
        const name = decodeURIComponent(parts[1])
        const file = path.join(courseDir, name + '.txt')
        if (!fs.existsSync(file)) { send(res, 404, { error: 'course not found' }); return true }
        const rows = parseQuiz(fs.readFileSync(file, 'utf8'))
        const header = rows[0] || []
        // The section column is optional. If the header's first cell isn't
        // "section", treat the file as the column-less format and put every
        // question in the default "main" section.
        const hasSection = (header[0] || '').trim().toLowerCase() === 'section'
        const body = rows.slice(1).map((r) => {
          const c = hasSection ? r : ['main', ...r]
          return {
            section: c[0] && c[0].trim() ? c[0] : 'main',
            questionNumber: c[1],
            question: c[2],
            options: [c[3], c[4], c[5], c[6]],
            correctOption: Number(c[7]),
          }
        })
        send(res, 200, body)
        return true
      }

      // GET /api/answers/:name -> saved answers
      if (req.method === 'GET' && parts[0] === 'answers' && parts.length === 2) {
        send(res, 200, readAnswers(decodeURIComponent(parts[1])))
        return true
      }

      // GET /api/notes/:name -> raw markdown notes (same base name, .md)
      if (req.method === 'GET' && parts[0] === 'notes' && parts.length === 2) {
        const name = decodeURIComponent(parts[1])
        const file = path.join(courseDir, name + '.md')
        const exists = fs.existsSync(file)
        send(res, 200, { exists, content: exists ? fs.readFileSync(file, 'utf8') : '' })
        return true
      }

      // POST /api/answers/:name -> upsert an answer row
      if (req.method === 'POST' && parts[0] === 'answers' && parts.length === 2) {
        const name = decodeURIComponent(parts[1])
        const { questionNumber, candidateAnswer, marks } = await readJsonBody(req)
        const answers = readAnswers(name)
        const idx = answers.findIndex((a) => a.questionNumber === String(questionNumber))
        const row = {
          questionNumber: String(questionNumber),
          candidateAnswer: String(candidateAnswer),
          marks: Number(marks) || 0,
        }
        if (idx >= 0) answers[idx] = row
        else answers.push(row)
        writeAnswers(name, answers)
        send(res, 200, answers)
        return true
      }

      // DELETE /api/answers/:name -> reset attempts.
      // With a { questionNumbers: [...] } body, reset only those questions
      // (used for per-section resets); otherwise reset the whole course.
      if (req.method === 'DELETE' && parts[0] === 'answers' && parts.length === 2) {
        const name = decodeURIComponent(parts[1])
        const body = await readJsonBody(req).catch(() => ({}))
        const nums = body && Array.isArray(body.questionNumbers) ? body.questionNumbers : null
        if (nums) {
          const drop = new Set(nums.map(String))
          const remaining = readAnswers(name).filter((a) => !drop.has(String(a.questionNumber)))
          writeAnswers(name, remaining)
          send(res, 200, remaining)
          return true
        }
        writeAnswers(name, [])
        send(res, 200, [])
        return true
      }

      send(res, 404, { error: 'not found' })
      return true
    } catch (e) {
      send(res, 500, { error: String(e && e.message ? e.message : e) })
      return true
    }
  }
}

module.exports = { createApiHandler }
