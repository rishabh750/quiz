import { useState } from 'react'

export default function ArchiveModal({ courses, onRevive, onClose }) {
  const [busy, setBusy] = useState(null)

  const revive = async (course) => {
    setBusy(course)
    try {
      await onRevive(course)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Archived courses</h2>
        {courses.length === 0 ? (
          <p className="muted small">No archived courses. Deleting a course moves it here.</p>
        ) : (
          <ul className="archive-list">
            {courses.map((c) => (
              <li key={c} className="archive-row">
                <span className="archive-name">{c}</span>
                <button className="add-btn" disabled={busy === c} onClick={() => revive(c)}>
                  {busy === c ? 'Reviving…' : 'Revive'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <button className="gen-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
