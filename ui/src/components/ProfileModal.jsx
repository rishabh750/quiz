import { useState } from 'react'
import { PROVIDERS, PROVIDER_IDS } from '../providers.js'
import { openExternal } from '../openExternal.js'
import { IS_DESKTOP } from '../mode.js'

export default function ProfileModal({ email, initialProvider, keyPresent, onSave, onClose }) {
  const [provider, setProvider] = useState(initialProvider)
  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const chooseProvider = (p) => {
    setProvider(p)
    setSaved(false)
    openExternal(PROVIDERS[p].keyUrl)
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await onSave(provider, keyDraft)
      setKeyDraft('')
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Could not save changes')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Profile</h2>

        {!IS_DESKTOP && email && (
          <p className="muted small">
            Signed in as <strong>{email}</strong>
          </p>
        )}

        <div className="field">
          <span className="field-label">AI model</span>
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
        </div>

        <label className="field">
          <span className="field-label">
            {PROVIDERS[provider].label} API key
            {keyPresent && provider === initialProvider ? ' — set' : ''}
          </span>
          <input
            className="topic-input key-input"
            type="password"
            placeholder={`Paste a new ${PROVIDERS[provider].label} API key`}
            value={keyDraft}
            onChange={(e) => {
              setKeyDraft(e.target.value)
              setSaved(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <span className="field-hint">
            <a href={PROVIDERS[provider].keyUrl} target="_blank" rel="noreferrer">
              Get a {PROVIDERS[provider].label} key
            </a>
            . {IS_DESKTOP ? 'Stored only in this browser.' : 'Stored encrypted on the server.'}
          </span>
        </label>

        {error && <p className="muted small error-text">{error}</p>}
        {saved && !error && <p className="muted small">Saved.</p>}

        <div className="modal-actions">
          <button className="gen-btn" type="button" onClick={onClose}>
            Close
          </button>
          <button className="add-btn" type="button" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
