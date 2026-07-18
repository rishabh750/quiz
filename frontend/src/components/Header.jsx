import { useRef, useState } from 'react'
import { generateCourse } from '../generate.js'
import { PROVIDERS } from '../providers.js'
import { updateAccount } from '../auth.js'
import { cred, hasKey, setSession, currentEmail } from '../session.js'
import { IconMenu, IconUser, IconSparkles, IconKey, IconUnlock, IconMoon, IconSun } from '../icons.jsx'
import GenerateModal from './GenerateModal.jsx'
import ProfileModal from './ProfileModal.jsx'

export default function Header({
  course,
  total,
  answers,
  theme,
  onToggleTheme,
  onGenerated,
  onToggleNav,
  onLogout,
}) {
  const [status, setStatus] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ chars: 0, secs: 0 })
  const timerRef = useRef(null)
  const [showGen, setShowGen] = useState(false)
  const [provider, setProviderState] = useState(cred().provider)
  const [keyPresent, setKeyPresent] = useState(hasKey())
  const [menuOpen, setMenuOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const attempted = answers.length
  const correct = answers.reduce((sum, a) => sum + (Number(a.marks) || 0), 0)
  const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
  const providerLabel = PROVIDERS[provider].label

  const flash = (type, text, ms = 3500) => {
    setStatus({ type, text })
    if (ms) setTimeout(() => setStatus(null), ms)
  }

  const saveCredentials = async (prov, k) => {
    const key = k.trim()
    const patch = { provider: prov }
    if (key) patch.apiKey = key
    const me = await updateAccount(patch)
    setSession({ provider: me.provider, hasKey: me.has_api_key })
    setProviderState(me.provider)
    setKeyPresent(me.has_api_key)
  }

  const openProfile = () => {
    setMenuOpen(false)
    setShowProfile(true)
  }

  const openKeyFlow = () => {
    setMenuOpen(false)
    window.open(PROVIDERS[provider].keyUrl, '_blank', 'noopener')
    setShowProfile(true)
  }

  const handleGenerate = async (params) => {
    if (generating) return
    if (!hasKey()) {
      openKeyFlow()
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
      const files = await generateCourse(params, cred(), (chars) =>
        setProgress((p) => ({ ...p, chars }))
      )
      await onGenerated(files)
      flash('info', `Saved ${files.map((f) => f.filename).join(' + ')}`)
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
          <IconMenu />
        </button>

        <div className="profile-wrap">
          <button
            type="button"
            className="icon-btn profile-btn"
            title="Account"
            aria-label="Account menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <IconUser />
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="profile-menu">
                <button type="button" onClick={openProfile}>
                  Profile
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onLogout()
                    }}
                  >
                    Log out
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="header-title">{course || 'InterviewPrep'}</div>

        <div className="header-center">
          <button className="add-btn gen-cta" onClick={() => setShowGen(true)} disabled={generating}>
            {generating ? 'Generating…' : (<><IconSparkles /> <span className="btn-label">Generate</span></>)}
          </button>
          <button
            type="button"
            className={'icon-btn key-btn' + (keyPresent ? ' on' : '')}
            title={keyPresent ? `${providerLabel} key set — click to change` : `Set ${providerLabel} API key`}
            onClick={openKeyFlow}
          >
            {keyPresent ? <IconKey /> : <IconUnlock />}
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

          <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
            {theme === 'light' ? <IconMoon /> : <IconSun />}
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
          hasKey={keyPresent}
          providerLabel={providerLabel}
          onGenerate={handleGenerate}
          onSetKey={openKeyFlow}
          onClose={() => setShowGen(false)}
        />
      )}

      {showProfile && (
        <ProfileModal
          email={currentEmail()}
          initialProvider={provider}
          keyPresent={keyPresent}
          onSave={saveCredentials}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  )
}
