import { useEffect, useState, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import Quiz from './components/Quiz.jsx'
import Notes from './components/Notes.jsx'
import ArchiveModal from './components/ArchiveModal.jsx'
import AuthModal from './components/AuthModal.jsx'
import {
  getCourses,
  getQuestions,
  getAnswers,
  getNotes,
  resetAnswers,
  uploadCourseFile,
  getArchive,
  archiveCourse,
  reviveCourse,
  purgeCourse,
} from './api.js'
import { isAuthed, fetchMe, logout } from './auth.js'
import { setSession } from './session.js'

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [courses, setCourses] = useState([])
  const [active, setActive] = useState(null)
  const [view, setView] = useState('quiz')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [notes, setNotes] = useState({ exists: false, content: '' })
  const [loading, setLoading] = useState(false)
  const [archive, setArchive] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [authed, setAuthed] = useState(isAuthed())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const loadCourses = useCallback(() => {
    getCourses()
      .then((list) => {
        setCourses(list)
        setActive((cur) => cur ?? list[0] ?? null)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!authed) return
    fetchMe()
      .then((me) => setSession({ provider: me.provider, hasKey: me.has_api_key, email: me.email }))
      .catch(() => {})
    loadCourses()
  }, [authed, loadCourses])

  const onAuthed = useCallback(async () => {
    const me = await fetchMe()
    setSession({ provider: me.provider, hasKey: me.has_api_key, email: me.email })
    setAuthed(true)
  }, [])

  const onLogout = useCallback(() => {
    logout()
    setCourses([])
    setActive(null)
    setAuthed(false)
  }, [])

  useEffect(() => {
    if (!active) return
    setLoading(true)
    Promise.all([getQuestions(active), getAnswers(active), getNotes(active)])
      .then(([q, a, n]) => {
        setQuestions(q)
        setAnswers(a)
        setNotes(n)
      })
      .finally(() => setLoading(false))
  }, [active])

  const refreshAnswers = useCallback((updated) => setAnswers(updated), [])

  const handleSelect = useCallback((course) => {
    setActive(course)
    setView('quiz')
    setNavOpen(false)
  }, [])

  const handleReset = useCallback(
    async (course) => {
      if (!window.confirm(`Reset all attempts for "${course}"?`)) return
      await resetAnswers(course)
      if (course === active) setAnswers([])
    },
    [active]
  )

  const handleResetSection = useCallback(
    async (questionNumbers) => {
      const remaining = await resetAnswers(active, questionNumbers)
      setAnswers(remaining)
    },
    [active]
  )

  const handleArchive = useCallback(
    async (course) => {
      if (
        !window.confirm(
          `Delete "${course}"?\n\nIts answers will be cleared and the quiz + notes moved to the archive (you can revive them later).`
        )
      )
        return
      await archiveCourse(course)
      const list = await getCourses()
      setCourses(list)
      if (course === active) {
        const next = list[0] ?? null
        setActive(next)
        setView('quiz')
      }
    },
    [active]
  )

  const openArchive = useCallback(async () => {
    setArchive(await getArchive())
  }, [])

  const handleRevive = useCallback(async (course) => {
    const { archive: remaining } = await reviveCourse(course)
    setArchive(remaining)
    const list = await getCourses()
    setCourses(list)
    setActive((cur) => cur ?? list[0] ?? null)
  }, [])

  const handlePurge = useCallback(async (course) => {
    if (
      !window.confirm(
        `Permanently delete "${course}"?\n\nIts quiz, notes, and answers will be erased for good — this cannot be undone.`
      )
    )
      return
    const { archive: remaining } = await purgeCourse(course)
    setArchive(remaining)
  }, [])

  const saveFiles = useCallback(async (files) => {
    let firstQuiz = null
    for (const f of files) {
      const { saved } = await uploadCourseFile(f.filename, f.content)
      if (!firstQuiz && /\.txt$/i.test(saved)) firstQuiz = saved.replace(/\.txt$/i, '')
    }
    const list = await getCourses()
    setCourses(list)
    if (firstQuiz && list.includes(firstQuiz)) {
      setActive(firstQuiz)
      setView('quiz')
    } else {
      setActive((cur) => cur ?? list[0] ?? null)
    }
  }, [])

  const handleRegenerateNotes = useCallback(
    async (content) => {
      await uploadCourseFile(active + '.md', content)
      setNotes({ exists: true, content })
    },
    [active]
  )

  const handleToggleView = useCallback(
    (course) => {
      if (course !== active) {
        setActive(course)
        setView('notes')
      } else {
        setView((v) => (v === 'notes' ? 'quiz' : 'notes'))
      }
    },
    [active]
  )

  if (!authed) return <AuthModal onAuthed={onAuthed} />

  return (
    <div className={'app' + (navOpen ? ' nav-open' : '')}>
      <Sidebar
        courses={courses}
        active={active}
        view={view}
        open={navOpen}
        onSelect={handleSelect}
        onToggleView={handleToggleView}
        onReset={handleReset}
        onArchive={handleArchive}
        onOpenArchive={openArchive}
      />
      <div className="nav-backdrop" onClick={() => setNavOpen(false)} />
      <main className="main">
        <Header
          course={active}
          total={questions.length}
          answers={answers}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          onGenerated={saveFiles}
          onToggleNav={() => setNavOpen((o) => !o)}
          onLogout={onLogout}
        />
        <section className="content">
          {!active ? (
            <p className="muted">
              No courses yet. Tap <strong>✨ Generate</strong> to create one.
            </p>
          ) : loading ? (
            <p className="muted">Loading…</p>
          ) : view === 'notes' ? (
            <Notes
              notes={notes}
              course={active}
              questions={questions}
              onRegenerated={handleRegenerateNotes}
            />
          ) : (
            <Quiz
              course={active}
              questions={questions}
              answers={answers}
              onAnswered={refreshAnswers}
              onResetSection={handleResetSection}
            />
          )}
        </section>
      </main>

      {archive !== null && (
        <ArchiveModal
          courses={archive}
          onRevive={handleRevive}
          onPurge={handlePurge}
          onClose={() => setArchive(null)}
        />
      )}
    </div>
  )
}
