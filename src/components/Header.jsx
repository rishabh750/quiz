import { useRef, useState } from 'react'
import { generateCourse } from '../gemini.js'
import { openExternal } from '../openExternal.js'
import { PROVIDERS, PROVIDER_IDS, getProvider, setProvider, getKey, setKey } from '../providers.js'
import GenerateModal from './GenerateModal.jsx'

export default function Header({
  course,
  total,
  answers,
  theme,
  onToggleTheme,
  onUpload,
  onGenerated,
  onToggleNav,
}) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ chars: 0, secs: 0 })
  const timerRef = useRef(null)
  const [showGen, setShowGen] = useState(false)
  const [provider, setProviderState] = useState(getProvider())
  const [apiKey, setApiKeyState] = useState(() => getKey(getProvider()))
  const [showKey, setShowKey] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')

  const attempted = answers.length
  const correct = answers.reduce((sum, a) => sum + (Number(a.marks) || 0), 0)
  const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
  const providerLabel = PROVIDERS[provider].label

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

  const openKeyModal = () => {
    setKeyDraft(getKey(provider))
    setShowKey(true)
    openExternal(PROVIDERS[provider].keyUrl)
  }

  const chooseProvider = (p) => {
    setProviderState(p)
    setProvider(p)
    setApiKeyState(getKey(p))
    setKeyDraft(getKey(p))
    openExternal(PROVIDERS[p].keyUrl)
  }

  const saveKey = () => {
    const k = keyDraft.trim()
    setKey(provider, k)
    setApiKeyState(k)
    setShowKey(false)
  }

  const handleGenerate = async (params) => {
    if (generating) return
    const key = getKey(provider)
    if (!key) {
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
      const files = await generateCourse(params, { provider, apiKey: key }, (chars) =>
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

  return (
    <>
      <header className="header">
        <button className="nav-toggle" onClick={onToggleNav} title="Menu" aria-label="Toggle menu">
          ☰
        </button>
        <div className="header-title">{course || 'InterviewPrep'}</div>

        <div className="header-center">
          <button className="add-btn gen-cta" onClick={() => setShowGen(true)} disabled={generating}>
            {generating ? 'Generating…' : '✨ Generate'}
          </button>
          <button
            type="button"
            className={'icon-btn key-btn' + (apiKey ? ' on' : '')}
            title={apiKey ? `${providerLabel} key set — click to change` : `Set ${providerLabel} API key`}
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
              ? `Receiving from ${providerLabel}… ${progress.chars.toLocaleString()} chars · ${progress.secs}s`
              : `Contacting ${providerLabel}… ${progress.secs}s`}
          </span>
        </div>
      )}

      {status && <div className={'toast ' + status.type}>{status.text}</div>}

      {showGen && (
        <GenerateModal
          hasKey={!!apiKey}
          providerLabel={providerLabel}
          onGenerate={handleGenerate}
          onSetKey={openKeyModal}
          onClose={() => setShowGen(false)}
        />
      )}

      {showKey && (
        <div className="modal-overlay" onClick={() => setShowKey(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>API key</h2>
            <div className="segmented">
              {PROVIDER_IDS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={'seg' + (p === provider ? ' active' : '')}
                  onClick={() => chooseProvider(p)}
                >
                  {PROVIDERS[p].label}
                </button>
              ))}
            </div>
            <p className="muted small">
              Opened{' '}
              <a href={PROVIDERS[provider].keyUrl} target="_blank" rel="noreferrer">
                {PROVIDERS[provider].label} key page
              </a>{' '}
              in your browser — sign in, create a key, and paste it here. Stored only in this
              browser (localStorage).
            </p>
            <input
              className="topic-input key-input"
              type="password"
              placeholder={`Paste your ${providerLabel} API key`}
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
