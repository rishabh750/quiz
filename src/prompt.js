// Build a compact prompt that asks for both a quiz CSV and markdown notes in
// the exact formats this app consumes, focused on interview prep at the
// intersection of one or more comma-separated topics/tags.

// The quiz file uses "$$$" between fields (no escaping needed, unlike commas).
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

// Split a comma-separated input into a clean list of tags.
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

// opts: { topics: string, count: number, difficulty: 'easy'|'medium'|'hard' }
export function buildPrompt({ topics, count = 100, difficulty = 'medium' }) {
  const tags = parseTags(topics)
  const slug = slugify(topics)
  const n = Math.max(1, Math.floor(Number(count) || 100))
  const focus =
    tags.length > 1
      ? `the INTERSECTION of these topics: ${tags.join(', ')}. Every question must require all of them together, not each in isolation`
      : `${tags[0] || 'the topic'}`

  return `Generate interview-prep study material focused on ${focus}. The subject may be anything (not only CS); target what real interviews for this area test. Difficulty level: ${difficulty.toUpperCase()} — calibrate question hardness accordingly.

Output EXACTLY two fenced code blocks, each preceded by a line with its filename, and nothing else.

${slug}.txt — quiz, using "$$$" (three dollar signs) as the field delimiter (NOT commas):
First line, verbatim: ${QUIZ_HEADER}
Then exactly ${n} rows. Fields per row, separated by $$$: section (short sub-theme used to group questions), question number (1..${n}, no gaps), question, option 1, option 2, option 3, option 4, correct option number (1-4).
Do not wrap fields in quotes and do not escape anything — since $$$ is the delimiter, commas/quotes inside text are fine as-is. Exactly 8 fields per line, no blank lines, no commentary.

${slug}.md — Markdown notes (interview-focused, ${difficulty} level, enough to answer every quiz question):
H1 title + 2-sentence intro. H2 sections matching the quiz sections. Explain key concepts in prose (the how and why), bold key terms, give concrete examples with language-tagged code blocks where relevant, use tables to compare, and "> Note:" callouts for gotchas/best-practices. End with a "Quick reference" cheat-sheet and a "Glossary". Be accurate and concise; no filler.`
}
