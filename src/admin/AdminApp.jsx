import { useLayoutEffect } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useLocation } from '../lib/router.js'
import { useDecks } from '../hooks/useDecks.js'
import { useSiteMenu } from '../hooks/useSiteMenu.js'
import { Login } from './Login.jsx'
import StatsApp from './StatsApp.jsx'
import { Link } from '../components/Link.jsx'
import { SiteHeader } from '../site/SiteHeader.jsx'
import { DeckMenu } from '../site/DeckMenu.jsx'
import { OPEN_MEMBER_KEY } from '../site/memberHandoff.js'

import '../index.css'

/**
 * Administration : réservée aux comptes `role = admin`.
 * Même cadre que la vitrine (header + menu) pour naviguer sans se déconnecter.
 */
export default function AdminApp() {
  const { authenticated, isAdmin, signIn, user } = useAuth()
  const [, navigate] = useLocation()
  const { decks } = useDecks()
  const { menuOpen, toggleMenu, closeMenu } = useSiteMenu()

  useLayoutEffect(() => {
    document.body.classList.add('admin-theme')
    return () => document.body.classList.remove('admin-theme')
  }, [])

  if (authenticated === null) return <p className="loading">Ouverture du grimoire…</p>

  if (!authenticated) {
    return <Login onSuccess={signIn} />
  }

  if (!isAdmin) {
    return (
      <div className="admin-login">
        <h1>Forge Arcanique</h1>
        <p>Réservé aux comptes administrateur.</p>
        <p className="hint">
          Connecté en tant que <strong>{user?.username}</strong> (membre).
        </p>
        <Link to="/" className="admin-login__back">← Retour à la vitrine</Link>
      </div>
    )
  }

  function goVitrine() {
    navigate('/')
  }

  function goMember(view = 'dashboard') {
    try {
      sessionStorage.setItem(OPEN_MEMBER_KEY, view === 'myDecks' ? 'myDecks' : 'dashboard')
    } catch { /* ignore */ }
    navigate('/')
  }

  return (
    <>
      <SiteHeader menuOpen={menuOpen} onToggleMenu={toggleMenu} />
      <div className={`site-shell${menuOpen ? ' is-menu-open' : ''}`}>
        <DeckMenu
          decks={decks ?? []}
          open={menuOpen}
          onClose={closeMenu}
          adminActive
          memberActive={false}
          onOpenMember={goMember}
          onBackToVitrine={goVitrine}
          onOpenDeck={(deckId) => {
            closeMenu()
            navigate('/')
            requestAnimationFrame(() => {
              window.location.hash = `deck-${deckId}`
            })
          }}
        />
        <div
          className="site-main"
          onClick={menuOpen ? closeMenu : undefined}
        >
          <div className="member-shell">
            <StatsApp mode="admin" embedded />
          </div>
        </div>
      </div>
    </>
  )
}
