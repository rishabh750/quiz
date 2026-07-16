import { useState } from 'react'

export default function ArchiveModal({ courses, onRevive, onPurge, onClose }) {
  const [busy, setBusy] = useState(null)

  const run = async (course, action, fn) => {
    setBusy({ course, action })
    try {
      await fn(course)
    } finally {
      setBusy(null)
    }
  }

  const isBusy = (course) => busy && busy.course === course

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
                <div className="archive-actions">
                  <button
                    className="add-btn"
                    disabled={isBusy(c)}
                    onClick={() => run(c, 'revive', onRevive)}
                  >
                    {isBusy(c) && busy.action === 'revive' ? 'Reviving…' : 'Revive'}
                  </button>
                  <button
                    className="btn-danger"
                    disabled={isBusy(c)}
                    title="Permanently delete this course and its data"
                    onClick={() => run(c, 'purge', onPurge)}
                  >
                    {isBusy(c) && busy.action === 'purge' ? 'Removing…' : 'Remove'}
                  </button>
                </div>
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
