import { useMemo } from 'react'
import { marked } from 'marked'

export default function Notes({ notes, course }) {
  const html = useMemo(
    () => (notes.content ? marked.parse(notes.content) : ''),
    [notes.content]
  )

  if (!notes.exists) {
    return (
      <p className="muted">
        No notes found. Add a <code>{course}.md</code> file to the <code>course</code> folder.
      </p>
    )
  }

  return <article className="notes" dangerouslySetInnerHTML={{ __html: html }} />
}
