const fs = require('node:fs')
const path = require('node:path')

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

function parseQuiz(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return []
  if (lines[0].includes('$$$')) {
    return lines.map((l) => l.split('$$$').map((c) => c.trim()))
  }
  return lines.map(parseCsvLine)
}

function csvField(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

const ANSWERS_HEADER = 'question number,candidate answer,marks'

const GENERATORS = {
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

function createApiHandler({ courseDir, answersDir, archiveDir }) {
  const answersFile = (course) => path.join(answersDir, course + '.csv')

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

      if (req.method === 'GET' && parts[0] === 'archive' && parts.length === 1) {
        send(res, 200, listArchive())
        return true
      }

      if (req.method === 'POST' && parts[0] === 'archive' && parts.length === 2) {
        const name = path.basename(decodeURIComponent(parts[1]))
        writeAnswers(name, [])
        const moved = moveCourseFiles(name, courseDir, archiveDir)
        send(res, 200, { archived: name, moved, archive: listArchive() })
        return true
      }

      if (req.method === 'POST' && parts[0] === 'archive' && parts.length === 3 && parts[2] === 'revive') {
        const name = path.basename(decodeURIComponent(parts[1]))
        const moved = moveCourseFiles(name, archiveDir, courseDir)
        send(res, 200, { revived: name, moved, archive: listArchive() })
        return true
      }

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

      if (req.method === 'POST' && parts[0] === 'generate' && parts.length === 1) {
        const { prompt, apiKey, provider, model } = await readJsonBody(req)
        if (!apiKey) { send(res, 400, { error: 'missing API key' }); return true }
        if (!prompt) { send(res, 400, { error: 'missing prompt' }); return true }
        const gen = GENERATORS[provider] || GENERATORS.gemini
        const m = model || gen.model
        const gres = await fetch(gen.url(m), {
          method: 'POST',
          headers: gen.headers(apiKey),
          body: JSON.stringify(gen.body(prompt, m)),
        })
        if (!gres.ok || !gres.body) {
          const data = await gres.json().catch(() => ({}))
          send(res, gres.ok ? 502 : gres.status, {
            error: (data.error && data.error.message) || 'Generation request failed',
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
          let nl
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim()
            buf = buf.slice(nl + 1)
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (!payload || payload === '[DONE]') continue
            try {
              const t = gen.delta(JSON.parse(payload))
              if (t) res.write(t)
            } catch {
              void 0
            }
          }
        }
        res.end()
        return true
      }

      if (req.method === 'GET' && parts[0] === 'courses' && parts.length === 2) {
        const name = decodeURIComponent(parts[1])
        const file = path.join(courseDir, name + '.txt')
        if (!fs.existsSync(file)) { send(res, 404, { error: 'course not found' }); return true }
        const rows = parseQuiz(fs.readFileSync(file, 'utf8'))
        const header = rows[0] || []
        const cells = header.map((h) => (h || '').trim().toLowerCase())
        const hasSection = cells[0] === 'section'
        const isQa = cells.includes('answer') && !cells.some((c) => c.startsWith('option'))
        const body = rows.slice(1).map((r) => {
          const c = hasSection ? r : ['main', ...r]
          const base = {
            section: c[0] && c[0].trim() ? c[0] : 'main',
            questionNumber: c[1],
            question: c[2],
          }
          if (isQa) return { ...base, type: 'qa', answer: c[3] }
          return {
            ...base,
            type: 'mcq',
            options: [c[3], c[4], c[5], c[6]],
            correctOption: Number(c[7]),
          }
        })
        send(res, 200, body)
        return true
      }

      if (req.method === 'GET' && parts[0] === 'answers' && parts.length === 2) {
        send(res, 200, readAnswers(decodeURIComponent(parts[1])))
        return true
      }

      if (req.method === 'GET' && parts[0] === 'notes' && parts.length === 2) {
        const name = decodeURIComponent(parts[1])
        const file = path.join(courseDir, name + '.md')
        const exists = fs.existsSync(file)
        send(res, 200, { exists, content: exists ? fs.readFileSync(file, 'utf8') : '' })
        return true
      }

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
