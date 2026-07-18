
export const DELIM = '$$$'
export const QUIZ_HEADER = [
  'section',
  'question number',
  'question',
  'option 1',
  'option 2',
  'option 3',
  'option 4',
  'correct option number',
].join(DELIM)

export const QA_HEADER = ['section', 'question number', 'question', 'answer'].join(DELIM)

export function parseTags(input) {
  return String(input)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function slugify(input) {
  return (
    parseTags(input)
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'topic'
  )
}

export function buildNotesPrompt({ topics, questions = [] }) {
  const subject = String(topics || 'the topic').replace(/-/g, ' ').trim()
  const grounding = questions.length
    ? `\n\nThe notes MUST cover everything needed to answer these quiz questions:\n${questions
        .map((q, i) => `${i + 1}. ${q.question}`)
        .join('\n')}`
    : ''

  return `Write interview-focused Markdown study notes about "${subject}".${grounding}

Structure: H1 title + 2-sentence intro; H2 sections grouping related concepts; concise prose (how and why) with bold key terms, language-tagged code examples where relevant, comparison tables, and "> Note:" callouts for gotchas; end with a "Quick reference" cheat-sheet and a "Glossary". No filler.

Output ONLY the notes, wrapped in a single \`\`\`markdown code block, and nothing else.`
}

export function buildSectionNotesPrompt({ topics, section, questions = [] }) {
  const subject = String(topics || 'the topic').replace(/-/g, ' ').trim()
  const grounding = questions.length
    ? `\n\nCover everything needed to answer these questions:\n${questions
        .map((q, i) => `${i + 1}. ${q.question}`)
        .join('\n')}`
    : ''
  return `Write ONE section of interview-prep Markdown notes about "${subject}", covering "${section}".${grounding}

Begin with a level-2 heading exactly: "## ${section}". Then concise prose (how and why) with bold key terms, language-tagged code examples where relevant, comparison tables, and "> Note:" callouts for gotchas. Output ONLY that section, wrapped in a single \`\`\`markdown code block.`
}

export function courseSlug({ company = '', position = '', round = '', topics = '' }) {
  const parts = [company, position, round, ...parseTags(topics)]
    .map((s) => String(s).trim())
    .filter(Boolean)
  return slugify(parts.join(', ') || 'interview')
}

export function buildPrompt(opts) {
  const { count = 100, difficulty = 'medium', mcq = true } = opts
  const company = String(opts.company || '').trim()
  const position = String(opts.position || '').trim()
  const round = String(opts.round || '').trim()
  const tags = parseTags(opts.topics)
  const slug = courseSlug(opts)
  const n = Math.max(1, Math.floor(Number(count) || 100))

  const topicFocus = tags.length
    ? ` Focus on: ${tags.join(', ')} (as they apply to this role and round).`
    : ''
  const focus = `${company} ${position} — "${round}" round. Match exactly what ${company}'s ${round} round for a ${position} asks (real topics, question styles, difficulty); be ${company}/${round}-specific, never generic.${topicFocus}`

  const quizSpec = mcq
    ? `${slug}.txt — MCQ quiz. Delimiter: "$$$" (not commas).
Line 1 verbatim: ${QUIZ_HEADER}
Then exactly ${n} rows, fields in order: section (short sub-theme), question number (1..${n}, no gaps), question, option 1, option 2, option 3, option 4, correct option number (1-4). 8 fields/line. No quotes, no escaping, no blank lines, no commentary.`
    : `${slug}.txt — open-ended questions. Delimiter: "$$$" (not commas).
Line 1 verbatim: ${QA_HEADER}
Then exactly ${n} rows, fields in order: section (short sub-theme), question number (1..${n}, no gaps), question (open-ended, no options), answer (concise but complete). 4 fields/line. No quotes, no escaping, no blank lines, no commentary.`

  return `Interview-prep material for ${focus} Difficulty: ${difficulty.toUpperCase()}.
Output EXACTLY two fenced code blocks, each preceded by a line with its filename, and nothing else.

${quizSpec}

${slug}.md — interview-focused Markdown notes (${difficulty} level) covering everything needed to answer every quiz question: H1 title + 2-sentence intro; H2 sections matching the quiz sections; concise prose (how and why) with bold key terms, language-tagged code examples where relevant, comparison tables, and "> Note:" callouts for gotchas; end with a "Quick reference" cheat-sheet and a "Glossary". No filler.`
}
