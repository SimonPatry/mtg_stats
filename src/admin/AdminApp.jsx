import { useLayoutEffect, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useLocation } from '../lib/router.js'
import { useDecks } from '../hooks/useDecks.js'
import { useSiteMenu } from '../hooks/useSiteMenu.js'
import { Login } from './Login.jsx'
import StatsApp from './StatsApp.jsx'
import { Link } from '../components/Link.jsx'
import { SiteHeader } from '../site/SiteHeader.jsx'
import { DeckMenu } from '../site/DeckMenu.jsx'
import { collectTagLabels } from '../components/TagFilter.jsx'
import { OPEN_MEMBER_KEY } from '../site/memberHandoff.js'

import '../index.css'

/**
 * Administration : réservée aux comptes `role = admin`.
 * Même cadre que la vitrine (header + filtres) pour naviguer sans se déconnecter.
 */
export default function AdminApp() {
  const { authenticated, isAdmin, signIn, user } = useAuth()
  const [, navigate] = useLocation()
  const { decks } = useDecks()
  const { menuOpen, toggleMenu, closeMenu } = useSiteMenu()
  const allDecks = decks ?? []
  const tagOptions = useMemo(() => collectTagLabels(allDecks), [allDecks])

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
      <SiteHeader
        menuOpen={menuOpen}
        onToggleMenu={toggleMenu}
        onOpenMember={goMember}
        onBackToVitrine={goVitrine}
      />
      <DeckMenu
        decks={allDecks}
        open={menuOpen}
        onClose={closeMenu}
        tagOptions={tagOptions}
        onOpenDeck={(deckId) => {
          closeMenu()
          navigate('/')
          requestAnimationFrame(() => {
            window.location.hash = `deck-${deckId}`
          })
        }}
      />
      <div className="site-main">
        <div className="member-shell">
          <StatsApp mode="admin" embedded />
        </div>
      </div>
    </>
  )
}
