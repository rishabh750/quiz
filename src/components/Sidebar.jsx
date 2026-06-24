export default function Sidebar({
  courses,
  active,
  view,
  onSelect,
  onToggleView,
  onReset,
  onArchive,
  onOpenArchive,
}) {
  return (
    <aside className="sidebar">
      <h1 className="brand">Courses</h1>
      <nav className="course-list">
        {courses.length === 0 && <p className="muted small">No courses yet</p>}
        <ul>
          {courses.map((c) => {
            const showingNotes = c === active && view === 'notes'
            return (
              <li key={c} className="nav-row">
                <button
                  className={'nav-item' + (c === active ? ' active' : '')}
                  onClick={() => onSelect(c)}
                >
                  {c}
                </button>
                <button
                  className={'icon-btn' + (showingNotes ? ' on' : '')}
                  title={showingNotes ? 'Show questions' : 'Show notes'}
                  onClick={() => onToggleView(c)}
                >
                  {showingNotes ? '❓' : '📝'}
                </button>
                <button
                  className="icon-btn reset-btn"
                  title={'Reset attempts for ' + c}
                  onClick={() => onReset(c)}
                >
                  ↺
                </button>
                <button
                  className="icon-btn delete-btn"
                  title={'Delete ' + c + ' (move to archive)'}
                  onClick={() => onArchive(c)}
                >
                  🗑
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <button className="archive-btn" onClick={onOpenArchive} title="View archived courses">
        🗄 Archive
      </button>
    </aside>
  )
}
