
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

  return `Write high-quality, interview-focused Markdown study notes about "${subject}".${grounding}

Structure: H1 title + a 2-sentence intro. H2 sections grouping related concepts. Explain each concept in clear prose (the how and why), bold key terms, give concrete examples with language-tagged code blocks where relevant, use tables to compare, and "> Note:" callouts for gotchas/best-practices. End with a "Quick reference" cheat-sheet and a "Glossary".

Be accurate, well-structured, and concise — no filler. Output ONLY the notes, wrapped in a single \`\`\`markdown code block, and nothing else.`
}

export function buildSectionNotesPrompt({ topics, section, questions = [] }) {
  const subject = String(topics || 'the topic').replace(/-/g, ' ').trim()
  const grounding = questions.length
    ? `\n\nCover everything needed to answer these questions:\n${questions
        .map((q, i) => `${i + 1}. ${q.question}`)
        .join('\n')}`
    : ''
  return `Write ONE focused section of interview-prep Markdown study notes about "${subject}", covering the sub-topic "${section}".${grounding}

Begin with a level-2 heading exactly: "## ${section}". Then clear prose (the how and why), bold key terms, concrete examples with language-tagged code blocks where relevant, tables to compare, and "> Note:" callouts for gotchas. Be accurate and concise. Output ONLY that section, wrapped in a single \`\`\`markdown code block.`
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
    ? ` Concentrate specifically on these topics: ${tags.join(', ')} — every question must target them as they apply to this exact role and round, not in isolation.`
    : ''

  const focus = `a candidate interviewing at ${company} for the ${position} role — specifically the "${round}" interview round. Target EXACTLY what ${company}'s ${round} round for a ${position} actually asks: the real topics, question styles, formats, and difficulty this company and round are known for. Be concrete and ${company}/${round}-specific, never generic; mirror ${company}'s real interview process.${topicFocus}`

  const quizSpec = mcq
    ? `${slug}.txt — multiple-choice quiz, using "$$$" (three dollar signs) as the field delimiter (NOT commas):
First line, verbatim: ${QUIZ_HEADER}
Then exactly ${n} rows. Fields per row, separated by $$$: section (short sub-theme used to group questions), question number (1..${n}, no gaps), question, option 1, option 2, option 3, option 4, correct option number (1-4).
Do not wrap fields in quotes and do not escape anything — since $$$ is the delimiter, commas/quotes inside text are fine as-is. Exactly 8 fields per line, no blank lines, no commentary.`
    : `${slug}.txt — open-ended (non-MCQ) interview questions, using "$$$" (three dollar signs) as the field delimiter (NOT commas):
First line, verbatim: ${QA_HEADER}
Then exactly ${n} rows. Fields per row, separated by $$$: section (short sub-theme used to group questions), question number (1..${n}, no gaps), question (an open-ended interview question — no options), answer (a concise but complete model answer a strong candidate would give).
Do not include any options or a correct-option number. Do not wrap fields in quotes and do not escape anything. Exactly 4 fields per line, no blank lines, no commentary.`

  return `Generate interview-prep study material for ${focus} Difficulty level: ${difficulty.toUpperCase()} — calibrate question hardness accordingly.

Output EXACTLY two fenced code blocks, each preceded by a line with its filename, and nothing else.

${quizSpec}

${slug}.md — Markdown notes (interview-focused, ${difficulty} level, enough to answer every quiz question):
H1 title + 2-sentence intro. H2 sections matching the quiz sections. Explain key concepts in prose (the how and why), bold key terms, give concrete examples with language-tagged code blocks where relevant, use tables to compare, and "> Note:" callouts for gotchas/best-practices. End with a "Quick reference" cheat-sheet and a "Glossary". Be accurate and concise; no filler.`
}
