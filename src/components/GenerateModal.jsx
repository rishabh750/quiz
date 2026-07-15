import { useState } from 'react'

export default function GenerateModal({ hasKey, providerLabel, onGenerate, onSetKey, onClose }) {
  const [searchMode, setSearchMode] = useState('generic')
  const [topics, setTopics] = useState('')
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [round, setRound] = useState('')
  const [count, setCount] = useState(100)
  const [difficulty, setDifficulty] = useState('medium')
  const [mcq, setMcq] = useState(true)

  const specific = searchMode === 'specific'
  const ready = specific ? company.trim() && position.trim() && round.trim() : topics.trim()

  const submit = (e) => {
    e.preventDefault()
    if (!ready) return
    const common = { count: Number(count) || 100, difficulty, mcq }
    if (specific) {
      const c = company.trim()
      const p = position.trim()
      const r = round.trim()
      onGenerate({ ...common, mode: 'specific', company: c, position: p, round: r, topics: `${c} ${p} ${r}` })
    } else {
      onGenerate({ ...common, mode: 'generic', topics: topics.trim() })
    }
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
          <div className="field">
            <span className="field-label">Search mode</span>
            <div className="segmented">
              <button
                type="button"
                className={'seg' + (!specific ? ' active' : '')}
                onClick={() => setSearchMode('generic')}
              >
                Generic
              </button>
              <button
                type="button"
                className={'seg' + (specific ? ' active' : '')}
                onClick={() => setSearchMode('specific')}
              >
                Specific
              </button>
            </div>
          </div>

          {specific ? (
            <>
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
              <span className="field-hint">
                Questions tailored to that company's specific interview round.
              </span>
            </>
          ) : (
            <label className="field">
              <span className="field-label">Tags / topics (comma-separated)</span>
              <input
                className="topic-input"
                type="text"
                placeholder="e.g. React, Testing"
                value={topics}
                autoFocus
                onChange={(e) => setTopics(e.target.value)}
              />
              <span className="field-hint">
                Multiple tags → questions at their intersection. Any subject; focus is interview prep.
              </span>
            </label>
          )}

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
