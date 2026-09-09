import { useEffect, useRef, useState } from 'react'
import { Login } from '../admin/Login.jsx'
import { useAuth, signOut } from '../hooks/useAuth.js'
import TagFilter, { matchesSelectedTags } from '../components/TagFilter.jsx'

/**
 * Tiroir latéral (overlay) : navigation + login + liste des decks.
 * Desktop : s’ouvre au survol du bord gauche ; le burger épingle le menu.
 * Mobile : burger uniquement.
 */
export function DeckMenu({
  decks,
  open,
  onClose,
  memberActive = false,
  memberView = 'dashboard',
  adminActive = false,
  onOpenMember,
  onBackToVitrine,
  onOpenDeck,
  selectedTags = [],
  onSelectedTags,
  tagOptions = [],
}) {
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState(false)
  const leaveTimer = useRef(null)
  const { authenticated, isMember, signIn } = useAuth()

  const visibleMenu = open || hovered

  useEffect(() => {
    if (!visibleMenu) return undefined
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      setHovered(false)
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [visibleMenu, onClose])

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
  }, [])

  function enterHover() {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
    setHovered(true)
  }

  function leaveHover() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => setHovered(false), 160)
  }

  const showDecks = !memberActive && !adminActive
  const needle = query.trim().toLowerCase()
  const visible = decks.filter((d) => {
    if (!matchesSelectedTags(d.tags, selectedTags)) return false
    if (!needle) return true
    const hay = `${d.name} ${(d.tags ?? []).join(' ')}`.toLowerCase()
    return hay.includes(needle)
  })

  function goMember(view) {
    if (isMember) onOpenMember?.(view)
  }

  const onVitrine = memberActive || adminActive

  return (
    <>
      {/* Zone de survol desktop — ouvre le tiroir sans clic. */}
      <div
        className="deck-menu__hotzone"
        aria-hidden="true"
        onMouseEnter={enterHover}
        onMouseLeave={leaveHover}
      />

      <aside
        className={`deck-menu${visibleMenu ? ' is-open' : ''}${memberActive || adminActive ? ' deck-menu--member' : ''}`}
        id="deck-menu"
        aria-hidden={visibleMenu ? 'false' : 'true'}
        onMouseEnter={enterHover}
        onMouseLeave={leaveHover}
      >
        <button
          type="button"
          className="deck-menu__overlay"
          aria-label="Fermer le menu"
          tabIndex={visibleMenu ? 0 : -1}
          onClick={() => {
            setHovered(false)
            onClose()
          }}
        />
        <nav className="deck-menu__panel" aria-label="Menu">
          <div className="deck-menu__section deck-menu__section--nav">
            <div className="deck-menu__nav">
              {onVitrine ? (
                <button
                  type="button"
                  className="deck-menu__nav-link"
                  onClick={() => onBackToVitrine?.()}
                >
                  Vitrine
                </button>
              ) : (
                <span className="deck-menu__nav-link is-active">Vitrine</span>
              )}
              {memberActive && memberView === 'dashboard' ? (
                <span className="deck-menu__nav-link is-active">Stats & parties</span>
              ) : (
                <button
                  type="button"
                  className="deck-menu__nav-link"
                  onClick={() => goMember('dashboard')}
                  disabled={authenticated === null}
                >
                  Stats & parties
                </button>
              )}
              {isMember && (
                memberActive && memberView === 'myDecks' ? (
                  <span className="deck-menu__nav-link is-active">Mes decks</span>
                ) : (
                  <button
                    type="button"
                    className="deck-menu__nav-link"
                    onClick={() => goMember('myDecks')}
                  >
                    Mes decks
                  </button>
                )
              )}
            </div>

            {authenticated === false && (
              <div className="deck-menu__login">
                <Login
                  compact
                  allowRegister
                  onSuccess={(session) => {
                    signIn(session)
                    onOpenMember?.('dashboard')
                  }}
                />
              </div>
            )}
            {authenticated === null && (
              <p className="deck-menu__hint">Session…</p>
            )}
          </div>

          {showDecks && (
            <div className="deck-menu__section deck-menu__section--decks">
              <p className="deck-menu__section-label">Tous les decks</p>
              {tagOptions.length > 0 && onSelectedTags ? (
                <div className="deck-menu__tags">
                  <TagFilter
                    tags={tagOptions}
                    value={selectedTags}
                    onChange={onSelectedTags}
                  />
                </div>
              ) : null}
              <div className="deck-menu__search">
                <input
                  type="search"
                  className="deck-menu__search-input"
                  placeholder="Rechercher…"
                  aria-label="Rechercher un deck"
                  autoComplete="off"
                  value={query}
                  onInput={(e) => setQuery(e.currentTarget.value)}
                />
              </div>

              <ul className="deck-menu__list">
                {visible.length === 0 && (
                  <li className="deck-menu__empty">
                    {decks.length === 0 ? 'Aucun deck.' : 'Aucun deck ne correspond.'}
                  </li>
                )}
                {visible.map((deck) => (
                  <li key={deck.id}>
                    <button
                      type="button"
                      className="deck-menu__link"
                      onClick={() => onOpenDeck?.(deck.id)}
                    >
                      <span className="deck-menu__link-index">
                        {String(decks.indexOf(deck) + 1).padStart(2, '0')}
                      </span>
                      <span>{deck.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isMember && (
            <div className="deck-menu__footer">
              <button
                type="button"
                className="deck-menu__nav-link deck-menu__nav-link--muted"
                onClick={() => { onClose(); signOut() }}
              >
                Déconnexion
              </button>
            </div>
          )}
        </nav>
      </aside>
    </>
  )
}
