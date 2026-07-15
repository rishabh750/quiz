import { useMemo, useState } from 'react'
import { marked } from 'marked'
import { regenerateNotes } from '../gemini.js'
import { getProvider, getKey, PROVIDERS } from '../providers.js'

export default function Notes({ notes, course, questions, onRegenerated }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const html = useMemo(
    () => (notes.content ? marked.parse(notes.content) : ''),
    [notes.content]
  )

  const refresh = async () => {
    if (busy) return
    const provider = getProvider()
    const apiKey = getKey(provider)
    if (!apiKey) {
      setError(`Set your ${PROVIDERS[provider].label} API key first (🔑 in the top bar).`)
      return
    }
    setError(null)
    setBusy(true)
    setProgress(0)
    try {
      const content = await regenerateNotes({ topics: course, questions }, { provider, apiKey }, setProgress)
      await onRegenerated(content)
    } catch (err) {
      setError(err.message || 'Failed to regenerate notes')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="notes-view">
      <div className="notes-toolbar">
        <button className="add-btn" onClick={refresh} disabled={busy}>
          {busy
            ? progress > 0
              ? `Regenerating… ${progress.toLocaleString()} chars`
              : 'Regenerating…'
            : '🔄 Refresh notes'}
        </button>
        {error && <span className="notes-error">{error}</span>}
      </div>

      {!notes.exists && !busy ? (
        <p className="muted">
          No notes yet. Click <strong>Refresh notes</strong> to generate them, or import a{' '}
          <code>{course}.md</code> file with <strong>+ Add</strong>.
        </p>
      ) : (
        <article className="notes" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  )
}
