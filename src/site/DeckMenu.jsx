import { useEffect, useState } from 'react'
import { Login } from '../admin/Login.jsx'
import { useAuth, signOut } from '../hooks/useAuth.js'
import { Link } from '../components/Link.jsx'
import TagFilter, { matchesSelectedTags } from '../components/TagFilter.jsx'

/**
 * Colonne latérale (pas un overlay) : navigation + login + liste des decks.
 * Ouverture / fermeture gérées par le shell parent (flex ~15 % / 85 %).
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
  const { authenticated, isMember, isAdmin, signIn } = useAuth()

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

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
    <aside
      className={`deck-menu${open ? ' is-open' : ''}${memberActive || adminActive ? ' deck-menu--member' : ''}`}
      id="deck-menu"
      aria-hidden={open ? 'false' : 'true'}
    >
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
            {isAdmin && (
              adminActive ? (
                <span className="deck-menu__nav-link is-active">Administration</span>
              ) : (
                <Link
                  to="/admin"
                  className="deck-menu__nav-link"
                >
                  Administration
                </Link>
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
  )
}
