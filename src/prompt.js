
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

export function buildPrompt(opts) {
  const { topics, count = 100, difficulty = 'medium', mcq = true } = opts
  const slug = slugify(topics)
  const n = Math.max(1, Math.floor(Number(count) || 100))

  let focus
  if (opts.mode === 'specific') {
    const company = String(opts.company || '').trim()
    const position = String(opts.position || '').trim()
    const round = String(opts.round || '').trim()
    focus = `a candidate interviewing at ${company} for the ${position} role — specifically the "${round}" interview round. Target EXACTLY what ${company}'s ${round} round for a ${position} actually asks: the specific topics, question styles, formats, and difficulty that this company and round are known for. Be concrete and ${company}/${round}-specific, not generic; reflect ${company}'s real interview process`
  } else {
    const tags = parseTags(topics)
    focus =
      tags.length > 1
        ? `the INTERSECTION of these topics: ${tags.join(', ')}. Every question must require all of them together, not each in isolation`
        : `${tags[0] || 'the topic'}`
  }

  const quizSpec = mcq
    ? `${slug}.txt — multiple-choice quiz, using "$$$" (three dollar signs) as the field delimiter (NOT commas):
First line, verbatim: ${QUIZ_HEADER}
Then exactly ${n} rows. Fields per row, separated by $$$: section (short sub-theme used to group questions), question number (1..${n}, no gaps), question, option 1, option 2, option 3, option 4, correct option number (1-4).
Do not wrap fields in quotes and do not escape anything — since $$$ is the delimiter, commas/quotes inside text are fine as-is. Exactly 8 fields per line, no blank lines, no commentary.`
    : `${slug}.txt — open-ended (non-MCQ) interview questions, using "$$$" (three dollar signs) as the field delimiter (NOT commas):
First line, verbatim: ${QA_HEADER}
Then exactly ${n} rows. Fields per row, separated by $$$: section (short sub-theme used to group questions), question number (1..${n}, no gaps), question (an open-ended interview question — no options), answer (a concise but complete model answer a strong candidate would give).
Do not include any options or a correct-option number. Do not wrap fields in quotes and do not escape anything. Exactly 4 fields per line, no blank lines, no commentary.`

  return `Generate interview-prep study material focused on ${focus}. The subject may be anything (not only CS); target what real interviews for this area test. Difficulty level: ${difficulty.toUpperCase()} — calibrate question hardness accordingly.

Output EXACTLY two fenced code blocks, each preceded by a line with its filename, and nothing else.

${quizSpec}

${slug}.md — Markdown notes (interview-focused, ${difficulty} level, enough to answer every quiz question):
H1 title + 2-sentence intro. H2 sections matching the quiz sections. Explain key concepts in prose (the how and why), bold key terms, give concrete examples with language-tagged code blocks where relevant, use tables to compare, and "> Note:" callouts for gotchas/best-practices. End with a "Quick reference" cheat-sheet and a "Glossary". Be accurate and concise; no filler.`
}
