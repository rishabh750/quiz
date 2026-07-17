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

function parseQuizRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return []
  if (lines[0].includes('$$$')) {
    return lines.map((l) => l.split('$$$').map((c) => c.trim()))
  }
  return lines.map(parseCsvLine)
}

export function parseQuestions(text) {
  const rows = parseQuizRows(String(text || ''))
  const header = rows[0] || []
  const cells = header.map((h) => (h || '').trim().toLowerCase())
  const hasSection = cells[0] === 'section'
  const isQa = cells.includes('answer') && !cells.some((c) => c.startsWith('option'))
  return rows.slice(1).map((r) => {
    const c = hasSection ? r : ['main', ...r]
    const base = {
      section: c[0] && c[0].trim() ? c[0] : 'main',
      questionNumber: c[1],
      question: c[2],
    }
    if (isQa) return { ...base, type: 'qa', answer: c[3] }
    return { ...base, type: 'mcq', options: [c[3], c[4], c[5], c[6]], correctOption: Number(c[7]) }
  })
}
