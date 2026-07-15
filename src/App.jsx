import { useEffect, useState, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import Quiz from './components/Quiz.jsx'
import Notes from './components/Notes.jsx'
import ArchiveModal from './components/ArchiveModal.jsx'
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
} from './api.js'

const readFileText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsText(file)
  })

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [courses, setCourses] = useState([])
  const [active, setActive] = useState(null)
  const [view, setView] = useState('quiz')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [notes, setNotes] = useState({ exists: false, content: '' })
  const [loading, setLoading] = useState(false)
  const [archive, setArchive] = useState(null)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    getCourses().then((list) => {
      setCourses(list)
      setActive((cur) => cur ?? list[0] ?? null)
    })
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

  const handleUpload = useCallback(
    async (fileObjects) => {
      const files = await Promise.all(
        fileObjects.map(async (file) => ({
          filename: file.name,
          content: await readFileText(file),
        }))
      )
      await saveFiles(files)
    },
    [saveFiles]
  )

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
          onUpload={handleUpload}
          onGenerated={saveFiles}
          onToggleNav={() => setNavOpen((o) => !o)}
        />
        <section className="content">
          {!active ? (
            <p className="muted">
              No courses yet. Tap <strong>✨ Generate</strong> to create one, or{' '}
              <strong>+ Add</strong> to import a <code>.txt</code> quiz file.
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
          onClose={() => setArchive(null)}
        />
      )}
    </div>
  )
}
