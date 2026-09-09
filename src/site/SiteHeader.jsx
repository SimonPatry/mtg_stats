import { useEffect, useRef, useState } from 'react'
import { Link } from '../components/Link.jsx'
import { useLocation } from '../lib/router.js'
import { useAuth, signOut } from '../hooks/useAuth.js'
import { Login } from '../admin/Login.jsx'

/**
 * En-tête collant. Il publie sa hauteur dans --header-height, dont se sert le
 * scroll-margin-top des bandes pour qu'une ancre ne passe pas dessous.
 *
 * Navigation membre + clé admin à droite ; le burger ouvre la sidebar filtres.
 */
export function SiteHeader({
  menuOpen,
  onToggleMenu,
  showMenuToggle = true,
  memberActive = false,
  memberView = 'dashboard',
  onOpenMember,
  onBackToVitrine,
}) {
  const header = useRef(null)
  const loginPanel = useRef(null)
  const [pathname] = useLocation()
  const { authenticated, isAdmin, isMember, signIn } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const onAdmin = pathname.startsWith('/admin')
  const awayFromVitrine = memberActive || onAdmin

  useEffect(() => {
    const el = header.current
    if (!el) return undefined
    const publish = () =>
      document.documentElement.style.setProperty('--header-height', `${el.offsetHeight}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!loginOpen) return undefined
    function onPointerDown(e) {
      if (loginPanel.current && !loginPanel.current.contains(e.target)) {
        setLoginOpen(false)
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setLoginOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [loginOpen])

  function goMember(view) {
    if (isMember) onOpenMember?.(view)
  }

  return (
    <header className="site-header" ref={header}>
      {showMenuToggle ? (
        <button
          type="button"
          className="site-header__menu-toggle"
          aria-expanded={menuOpen ? 'true' : 'false'}
          aria-controls="deck-menu"
          aria-label={menuOpen ? 'Fermer les filtres' : 'Ouvrir les filtres'}
          onClick={onToggleMenu}
        >
          <span className="site-header__menu-icon" />
        </button>
      ) : null}

      <div className="site-header__inner">
        <p className="site-header__eyebrow">Grimoire de decks</p>
        <h1 className="site-header__title">Forge Arcanique</h1>
      </div>

      <div className="site-header__actions">
        <nav className="site-header__nav" aria-label="Navigation">
          {awayFromVitrine ? (
            <button
              type="button"
              className="site-header__nav-link"
              onClick={() => onBackToVitrine?.()}
            >
              Vitrine
            </button>
          ) : (
            <span className="site-header__nav-link is-active">Vitrine</span>
          )}

          {authenticated === false && (
            <div className="site-header__login-wrap" ref={loginPanel}>
              <button
                type="button"
                className={`site-header__nav-link${loginOpen ? ' is-active' : ''}`}
                aria-expanded={loginOpen ? 'true' : 'false'}
                aria-controls="site-header-login"
                onClick={() => setLoginOpen((open) => !open)}
              >
                Connexion
              </button>
              {loginOpen ? (
                <div className="site-header__login" id="site-header-login">
                  <Login
                    compact
                    allowRegister
                    onSuccess={(session) => {
                      signIn(session)
                      setLoginOpen(false)
                      onOpenMember?.('dashboard')
                    }}
                  />
                </div>
              ) : null}
            </div>
          )}

          {authenticated === null && (
            <span className="site-header__nav-link site-header__nav-link--muted" aria-live="polite">
              Session…
            </span>
          )}

          {isMember && (
            <>
              {memberActive && memberView === 'dashboard' ? (
                <span className="site-header__nav-link is-active">Stats</span>
              ) : (
                <button
                  type="button"
                  className="site-header__nav-link"
                  onClick={() => goMember('dashboard')}
                >
                  Stats
                </button>
              )}
              {memberActive && memberView === 'myDecks' ? (
                <span className="site-header__nav-link is-active">Mes decks</span>
              ) : (
                <button
                  type="button"
                  className="site-header__nav-link"
                  onClick={() => goMember('myDecks')}
                >
                  Mes decks
                </button>
              )}
              <button
                type="button"
                className="site-header__nav-link site-header__nav-link--muted"
                onClick={() => signOut()}
              >
                Quitter
              </button>
            </>
          )}
        </nav>

        {/* Clé admin ↔ vitrine : réservée aux comptes admin connectés. */}
        {isAdmin ? (
          <Link
            to={onAdmin ? '/' : '/admin'}
            className={`site-header__admin${onAdmin ? ' is-active' : ''}`}
            title={onAdmin ? 'Retour à la vitrine' : 'Administration'}
            aria-label={onAdmin ? 'Retour à la vitrine' : 'Administration'}
            aria-current={onAdmin ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="8.5" cy="8.5" r="4.25" />
              <path d="M11.6 11.6 L19.5 19.5" />
              <path d="M17 17 L15 19" />
              <path d="M19.5 19.5 L17.5 21.5" />
            </svg>
          </Link>
        ) : null}
      </div>
    </header>
  )
}
