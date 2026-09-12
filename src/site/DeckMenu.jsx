import { useEffect, useRef, useState } from 'react'
import { matchesSelectedTags } from '../components/TagFilter.jsx'
import VitrineTagFilter from '../components/VitrineTagFilter.jsx'

/**
 * Tiroir latéral (overlay) : filtres de la vitrine.
 * Blocs séparés pour préparer d’autres types de filtres :
 *   1. Tags
 *   2. Tous les decks (recherche par nom + ancres)
 * Desktop : s’ouvre au survol du bord gauche ; le burger épingle le menu.
 * Mobile : burger uniquement.
 */
export function DeckMenu({
  decks,
  open,
  onClose,
  onOpenDeck,
  selectedTags = [],
  onSelectedTags,
  tagOptions = [],
}) {
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState(false)
  const leaveTimer = useRef(null)

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

  const needle = query.trim().toLowerCase()
  const visible = decks.filter((d) => {
    if (!matchesSelectedTags(d.tags, selectedTags)) return false
    if (!needle) return true
    return String(d.name || '').toLowerCase().includes(needle)
  })

  return (
    <>
      <div
        className="deck-menu__hotzone"
        aria-hidden="true"
        onMouseEnter={enterHover}
        onMouseLeave={leaveHover}
      />

      <aside
        className={`deck-menu${visibleMenu ? ' is-open' : ''}`}
        id="deck-menu"
        aria-hidden={visibleMenu ? 'false' : 'true'}
        onMouseEnter={enterHover}
        onMouseLeave={leaveHover}
      >
        <button
          type="button"
          className="deck-menu__overlay"
          aria-label="Fermer les filtres"
          tabIndex={visibleMenu ? 0 : -1}
          onClick={() => {
            setHovered(false)
            onClose()
          }}
        />
        <nav className="deck-menu__panel" aria-label="Filtres">
          {tagOptions.length > 0 && onSelectedTags ? (
            <div className="deck-menu__section deck-menu__section--filter">
              <p className="deck-menu__section-label">Tags</p>
              <div className="deck-menu__tags">
                <VitrineTagFilter
                  tags={tagOptions}
                  value={selectedTags}
                  onChange={onSelectedTags}
                />
              </div>
            </div>
          ) : null}

          <div className="deck-menu__section deck-menu__section--decks">
            <p className="deck-menu__section-label">Tous les decks</p>
            <div className="deck-menu__search">
              <input
                type="search"
                className="deck-menu__search-input"
                placeholder="Nom du deck…"
                aria-label="Filtrer par nom de deck"
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
        </nav>
      </aside>
    </>
  )
}
