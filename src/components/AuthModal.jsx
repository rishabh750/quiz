import { useState } from 'react'
import { login, register } from '../auth.js'
import { openExternal } from '../openExternal.js'
import { PROVIDERS, PROVIDER_IDS } from '../providers.js'

export default function AuthModal({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const isRegister = mode === 'register'

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      if (isRegister) {
        await register({ email, password, provider, apiKey })
      } else {
        await login({ email, password })
      }
      await onAuthed()
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay">
      <div className="modal auth-modal">
        <h1 className="auth-brand">InterviewPrep</h1>
        <div className="segmented auth-tabs">
          <button
            type="button"
            className={'seg' + (!isRegister ? ' active' : '')}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            className={'seg' + (isRegister ? ' active' : '')}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="topic-input"
              type="email"
              autoComplete="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="topic-input"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              required
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {isRegister && (
            <>
              <div className="field">
                <span className="field-label">AI model</span>
                <div className="segmented">
                  {PROVIDER_IDS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={'seg' + (p === provider ? ' active' : '')}
                      onClick={() => {
                        setProvider(p)
                        openExternal(PROVIDERS[p].keyUrl)
                      }}
                    >
                      {PROVIDERS[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span className="field-label">{PROVIDERS[provider].label} API key</span>
                <input
                  className="topic-input"
                  type="password"
                  placeholder={`Paste your ${PROVIDERS[provider].label} key`}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <span className="field-hint">
                  Stored encrypted on the server and used only to generate your quizzes. You can
                  change it later.
                </span>
              </label>
            </>
          )}

          {error && <p className="notes-error">{error}</p>}

          <div className="modal-actions">
            <button className="add-btn auth-submit" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
