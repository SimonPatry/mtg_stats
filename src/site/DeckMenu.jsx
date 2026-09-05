import { useEffect, useState } from 'react'

/**
 * Tiroir latéral listant tous les decks, avec un lien d'ancre vers chacun.
 *
 * Remplace quatre fonctions et une variable globale de l'ancien main.js
 * (initDeckMenu, populateDeckMenu, renderDeckMenuList, filterDeckMenu,
 * allMenuDecks) par deux états locaux et un filtre.
 */
export function DeckMenu({ decks, open, onClose }) {
  const [query, setQuery] = useState('')

  // Fermeture au clavier : l'ancienne version ne gérait qu'Échap sur le
  // document entier, sans jamais retirer l'écouteur.
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Le tiroir couvre la page : on bloque le défilement du fond tant qu'il
  // est ouvert, et on le rend systématiquement au démontage.
  useEffect(() => {
    if (!open) return undefined
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? decks.filter((d) => d.name.toLowerCase().includes(needle))
    : decks

  return (
    <div className={`deck-menu ${open ? 'is-open' : ''}`} id="deck-menu">
      <div className="deck-menu__overlay" onClick={onClose} />
      <nav className="deck-menu__panel" aria-label="Liste des decks">
        <div className="deck-menu__header">
          <span className="deck-menu__title">Tous les decks</span>
          <button type="button" className="deck-menu__close" aria-label="Fermer le menu" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="deck-menu__search">
          <input
            type="search"
            className="deck-menu__search-input"
            placeholder="Rechercher un deck…"
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
              <a className="deck-menu__link" href={`#deck-${deck.id}`} onClick={onClose}>
                <span className="deck-menu__link-index">
                  {String(decks.indexOf(deck) + 1).padStart(2, '0')}
                </span>
                <span>{deck.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
