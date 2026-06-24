import { useRef, useState } from 'react'
import { generateCourse } from '../gemini.js'
import GenerateModal from './GenerateModal.jsx'

const KEY_STORAGE = 'geminiApiKey'
const AI_STUDIO_URL = 'https://aistudio.google.com/apikey'

export default function Header({ course, total, answers, theme, onToggleTheme, onUpload, onGenerated }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'info'|'error', text }
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ chars: 0, secs: 0 })
  const timerRef = useRef(null)
  const [showGen, setShowGen] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) || '')
  const [showKey, setShowKey] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')

  const attempted = answers.length
  const correct = answers.reduce((sum, a) => sum + (Number(a.marks) || 0), 0)
  const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0

  const flash = (type, text, ms = 3500) => {
    setStatus({ type, text })
    if (ms) setTimeout(() => setStatus(null), ms)
  }

  const handleFiles = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    try {
      await onUpload(files)
    } finally {
      setBusy(false)
    }
  }

  // Open the key modal AND the default browser to sign in to AI Studio so the
  // user can grab/create a key.
  const openKeyModal = () => {
    setKeyDraft(apiKey)
    setShowKey(true)
    window.open(AI_STUDIO_URL, '_blank', 'noopener')
  }

  const handleGenerate = async (params) => {
    if (generating) return
    if (!apiKey) {
      openKeyModal()
      return
    }
    setShowGen(false)
    setGenerating(true)
    setStatus(null)
    setProgress({ chars: 0, secs: 0 })
    const start = Date.now()
    timerRef.current = setInterval(() => {
      setProgress((p) => ({ ...p, secs: Math.round((Date.now() - start) / 1000) }))
    }, 250)
    try {
      const files = await generateCourse(params, apiKey, (chars) =>
        setProgress((p) => ({ ...p, chars }))
      )
      await onGenerated(files)
      flash('info', `Saved ${files.map((f) => f.filename).join(' + ')} to the course folder`)
    } catch (err) {
      flash('error', err.message || 'Generation failed', 6000)
    } finally {
      clearInterval(timerRef.current)
      setGenerating(false)
    }
  }

  const saveKey = () => {
    const k = keyDraft.trim()
    setApiKey(k)
    if (k) localStorage.setItem(KEY_STORAGE, k)
    else localStorage.removeItem(KEY_STORAGE)
    setShowKey(false)
  }

  return (
    <>
      <header className="header">
        <div className="header-title">{course || 'Quiz'}</div>

        <div className="header-center">
          <button className="add-btn gen-cta" onClick={() => setShowGen(true)} disabled={generating}>
            {generating ? 'Generating…' : '✨ Generate'}
          </button>
          <button
            type="button"
            className={'icon-btn key-btn' + (apiKey ? ' on' : '')}
            title={apiKey ? 'Gemini API key set — click to change' : 'Set Gemini API key'}
            onClick={openKeyModal}
          >
            {apiKey ? '🔑' : '🔓'}
          </button>
        </div>

        <div className="header-right">
          <div className="score">
            <span className="stat">
              Attempted <strong>{attempted}</strong> / {total}
            </span>
            <span className="stat">
              Correct <strong>{correct}</strong> / {attempted}
            </span>
            <span className="stat pct">{pct}%</span>
          </div>

          <input ref={fileRef} type="file" accept=".txt,.md" multiple hidden onChange={handleFiles} />
          <button
            className="add-btn"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title="Upload quiz (.txt) or notes (.md) files to the course folder"
          >
            {busy ? 'Uploading…' : '+ Add'}
          </button>

          <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {generating && (
        <div className="genbar" role="status">
          <div className="genbar-track">
            <div className="genbar-fill" />
          </div>
          <span className="genbar-text">
            {progress.chars > 0
              ? `Receiving from Gemini… ${progress.chars.toLocaleString()} chars · ${progress.secs}s`
              : `Contacting Gemini… ${progress.secs}s`}
          </span>
        </div>
      )}

      {status && <div className={'toast ' + status.type}>{status.text}</div>}

      {showGen && (
        <GenerateModal
          hasKey={!!apiKey}
          onGenerate={handleGenerate}
          onSetKey={openKeyModal}
          onClose={() => setShowGen(false)}
        />
      )}

      {showKey && (
        <div className="modal-overlay" onClick={() => setShowKey(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Gemini API key</h2>
            <p className="muted small">
              Opened{' '}
              <a href={AI_STUDIO_URL} target="_blank" rel="noreferrer">
                aistudio.google.com/apikey
              </a>{' '}
              in your browser — sign in, create a key, and paste it here. Stored only in this
              browser (localStorage).
            </p>
            <input
              className="topic-input key-input"
              type="password"
              placeholder="Paste your Gemini API key"
              value={keyDraft}
              autoFocus
              onChange={(e) => setKeyDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveKey()}
            />
            <div className="modal-actions">
              <button className="gen-btn" onClick={() => setShowKey(false)}>
                Cancel
              </button>
              <button className="add-btn" onClick={saveKey}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
