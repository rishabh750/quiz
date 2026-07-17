import { useMemo, useState } from 'react'
import { marked } from 'marked'
import { regenerateNotes, regenerateSection } from '../gemini.js'
import { cred, hasKey, providerLabel } from '../session.js'

function splitSections(md) {
  const lines = String(md || '').split('\n')
  const head = []
  const sections = []
  let cur = null
  let inFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence
    const m = !inFence && /^##\s+(.+?)\s*$/.exec(line)
    if (m && !/^###/.test(line)) {
      cur = { title: m[1], lines: [line] }
      sections.push(cur)
    } else if (cur) {
      cur.lines.push(line)
    } else {
      head.push(line)
    }
  }
  return {
    head: head.join('\n').trim(),
    sections: sections.map((s) => ({ title: s.title, md: s.lines.join('\n').trim() })),
  }
}

export default function Notes({ notes, course, questions, onRegenerated }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const { head, sections } = useMemo(() => splitSections(notes.content), [notes.content])
  const headHtml = useMemo(() => (head ? marked.parse(head) : ''), [head])

  const run = async (label, fn) => {
    if (busy) return
    if (!hasKey()) {
      setError(`Set your ${providerLabel()} API key first (🔑 in the top bar).`)
      return
    }
    setError(null)
    setBusy(label)
    try {
      await fn()
    } catch (err) {
      setError(err.message || 'Failed to regenerate notes')
    } finally {
      setBusy(null)
    }
  }

  const refreshAll = () =>
    run('all', async () => {
      const content = await regenerateNotes({ topics: course, questions }, cred())
      await onRegenerated(content)
    })

  const refreshSection = (title) =>
    run(title, async () => {
      const qs = questions.filter((q) => (q.section || 'main') === title)
      const md = await regenerateSection({ topics: course, section: title, questions: qs }, cred())
      const rebuilt = [head, ...sections.map((s) => (s.title === title ? md : s.md))]
        .filter(Boolean)
        .join('\n\n')
      await onRegenerated(rebuilt)
    })

  return (
    <div className="notes-view">
      <div className="notes-toolbar">
        <button className="add-btn" onClick={refreshAll} disabled={!!busy}>
          {busy === 'all' ? 'Regenerating…' : '🔄 Refresh all notes'}
        </button>
        {error && <span className="notes-error">{error}</span>}
      </div>

      {!notes.exists && !busy ? (
        <p className="muted">
          No notes yet. Click <strong>Refresh all notes</strong> to generate them, or import a{' '}
          <code>{course}.md</code> file with <strong>+ Add</strong>.
        </p>
      ) : (
        <>
          {headHtml && (
            <article className="notes" dangerouslySetInnerHTML={{ __html: headHtml }} />
          )}
          {sections.map((s) => (
            <div className="notes-section" key={s.title}>
              <div className="notes-section-head">
                <span className="notes-section-title">{s.title}</span>
                <button
                  className="icon-btn"
                  title={'Regenerate the "' + s.title + '" section'}
                  disabled={!!busy}
                  onClick={() => refreshSection(s.title)}
                >
                  {busy === s.title ? '…' : '🔄'}
                </button>
              </div>
              <article
                className="notes"
                dangerouslySetInnerHTML={{ __html: marked.parse(s.md.replace(/^##\s+.+\n?/, '')) }}
              />
            </div>
          ))}
        </>
      )}
    </div>
  )
}
