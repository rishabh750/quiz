import { useMemo, useState } from 'react'
import { saveAnswer } from '../api.js'

// Compute attempted / total / correct / percentage for a set of questions.
function sectionScore(questions, answered) {
  const total = questions.length
  let attempted = 0
  let correct = 0
  for (const q of questions) {
    const a = answered[q.questionNumber]
    if (a) {
      attempted++
      correct += Number(a.marks) || 0
    }
  }
  const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
  return { total, attempted, correct, pct }
}

export default function Quiz({ course, questions, answers, onAnswered, onResetSection }) {
  const [saving, setSaving] = useState(null)
  const [collapsed, setCollapsed] = useState({})

  // Map question number -> saved answer for quick lookup.
  const answered = useMemo(() => {
    const m = {}
    for (const a of answers) m[a.questionNumber] = a
    return m
  }, [answers])

  // Group questions by section, preserving first-seen order.
  const sections = useMemo(() => {
    const map = new Map()
    for (const q of questions) {
      const key = q.section || 'main'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(q)
    }
    return [...map.entries()]
  }, [questions])

  const handleSelect = async (q, optionNumber) => {
    if (answered[q.questionNumber]) return // already answered, lock it
    setSaving(q.questionNumber)
    const marks = optionNumber === q.correctOption ? 1 : 0
    try {
      const updated = await saveAnswer(course, {
        questionNumber: q.questionNumber,
        candidateAnswer: optionNumber,
        marks,
      })
      onAnswered(updated)
    } finally {
      setSaving(null)
    }
  }

  if (questions.length === 0) return <p className="muted">This course has no questions.</p>

  return (
    <div className="quiz">
      {sections.map(([name, items]) => {
        const s = sectionScore(items, answered)
        const isCollapsed = !!collapsed[name]
        const handleSectionReset = async () => {
          if (s.attempted === 0) return
          if (!window.confirm(`Reset attempts for section "${name}"?`)) return
          await onResetSection(items.map((q) => q.questionNumber))
        }
        return (
          <div className="section" key={name}>
            <div className="section-head">
              <button
                className="section-toggle"
                onClick={() => setCollapsed((c) => ({ ...c, [name]: !c[name] }))}
              >
                <span className="chevron">{isCollapsed ? '▸' : '▾'}</span>
                <span className="section-title">{name}</span>
              </button>
              <span className="score">
                <span className="stat">
                  Attempted <strong>{s.attempted}</strong> / {s.total}
                </span>
                <span className="stat">
                  Correct <strong>{s.correct}</strong> / {s.attempted}
                </span>
                <span className="stat pct">{s.pct}%</span>
                <button
                  className="icon-btn reset-btn"
                  title={'Reset attempts for ' + name}
                  disabled={s.attempted === 0}
                  onClick={handleSectionReset}
                >
                  ↺
                </button>
              </span>
            </div>

            {!isCollapsed && (
              <div className="section-body">
                {items.map((q) => {
                  const saved = answered[q.questionNumber]
                  const chosen = saved ? Number(saved.candidateAnswer) : null
                  return (
                    <div className="card" key={q.questionNumber}>
                      <div className="q-head">
                        <span className="q-num">Q{q.questionNumber}</span>
                        {saved && (
                          <span className={'badge ' + (saved.marks ? 'ok' : 'bad')}>
                            {saved.marks ? 'Correct' : 'Wrong'}
                          </span>
                        )}
                      </div>
                      <p className="q-text">{q.question}</p>
                      <div className="options">
                        {q.options.map((opt, i) => {
                          const optNum = i + 1
                          const isChosen = chosen === optNum
                          const isCorrect = q.correctOption === optNum
                          let cls = 'option'
                          if (saved) {
                            if (isCorrect) cls += ' correct'
                            else if (isChosen) cls += ' incorrect'
                          }
                          return (
                            <button
                              key={optNum}
                              className={cls}
                              disabled={!!saved || saving === q.questionNumber}
                              onClick={() => handleSelect(q, optNum)}
                            >
                              <span className="opt-label">{optNum}</span>
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
