import { useState } from 'react'

export default function GenerateModal({ hasKey, providerLabel, onGenerate, onSetKey, onClose }) {
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [round, setRound] = useState('')
  const [topics, setTopics] = useState('')
  const [count, setCount] = useState(100)
  const [difficulty, setDifficulty] = useState('medium')
  const [mcq, setMcq] = useState(true)

  const ready = company.trim() && position.trim() && round.trim()

  const submit = (e) => {
    e.preventDefault()
    if (!ready) return
    onGenerate({
      count: Number(count) || 100,
      difficulty,
      mcq,
      company: company.trim(),
      position: position.trim(),
      round: round.trim(),
      topics: topics.trim(),
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Generate a quiz</h2>

        {!hasKey && (
          <p className="muted small">
            Set your {providerLabel} API key first.{' '}
            <button className="link-btn" type="button" onClick={onSetKey}>
              Set API key
            </button>
          </p>
        )}

        <form onSubmit={submit}>
          <label className="field">
            <span className="field-label">Company name</span>
            <input
              className="topic-input"
              type="text"
              placeholder="e.g. Google"
              value={company}
              autoFocus
              onChange={(e) => setCompany(e.target.value)}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Position</span>
              <input
                className="topic-input"
                type="text"
                placeholder="e.g. Backend Engineer"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Interview round</span>
              <input
                className="topic-input"
                type="text"
                placeholder="e.g. System Design"
                value={round}
                onChange={(e) => setRound(e.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Topics (optional, comma-separated)</span>
            <input
              className="topic-input"
              type="text"
              placeholder="e.g. Caching, Load balancing"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
            />
            <span className="field-hint">
              Narrows the questions to specific topics within that company, role, and round.
            </span>
          </label>

          <div className="field">
            <span className="field-label">Question type</span>
            <div className="segmented">
              <button
                type="button"
                className={'seg' + (mcq ? ' active' : '')}
                onClick={() => setMcq(true)}
              >
                MCQ
              </button>
              <button
                type="button"
                className={'seg' + (!mcq ? ' active' : '')}
                onClick={() => setMcq(false)}
              >
                Non-MCQ
              </button>
            </div>
            <span className="field-hint">
              {mcq
                ? 'Four options with one correct answer.'
                : 'Open-ended questions with a model answer to self-assess against.'}
            </span>
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Number of questions</span>
              <input
                className="topic-input"
                type="number"
                min="1"
                max="300"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">Difficulty</span>
              <select
                className="topic-input"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>

          <div className="modal-actions">
            <button className="gen-btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="add-btn" type="submit" disabled={!ready || !hasKey}>
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
