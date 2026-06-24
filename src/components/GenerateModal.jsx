import { useState } from 'react'

export default function GenerateModal({ hasKey, onGenerate, onSetKey, onClose }) {
  const [topics, setTopics] = useState('')
  const [count, setCount] = useState(100)
  const [difficulty, setDifficulty] = useState('medium')

  const submit = (e) => {
    e.preventDefault()
    const t = topics.trim()
    if (!t) return
    onGenerate({ topics: t, count: Number(count) || 100, difficulty })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Generate a quiz</h2>

        {!hasKey && (
          <p className="muted small">
            Set your Gemini API key first.{' '}
            <button className="link-btn" type="button" onClick={onSetKey}>
              Set API key
            </button>
          </p>
        )}

        <form onSubmit={submit}>
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
            <button className="add-btn" type="submit" disabled={!topics.trim() || !hasKey}>
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
