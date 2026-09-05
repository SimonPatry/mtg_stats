import { createStore } from '../lib/store.js'

/**
 * L'aperçu de carte au survol est unique pour toute la page : un seul
 * composant monté à la racine, piloté par ce magasin. N'importe quelle carte,
 * dans n'importe quel deck, appelle showPreview() sans rien faire descendre en
 * cascade dans l'arbre.
 */
const store = createStore(null) // { card, anchor } | null

export const usePreview = store.use

export function showPreview(anchorEl, card) {
  store.set({ card, anchor: anchorEl })
}

export function hidePreview() {
  store.set(null)
}

/** Attributs à étaler sur tout élément qui doit déclencher l'aperçu. */
export function previewHandlers(card) {
  return {
    onMouseEnter: (e) => showPreview(e.currentTarget, card),
    onMouseLeave: hidePreview,
    onFocus: (e) => showPreview(e.currentTarget, card),
    onBlur: hidePreview,
  }
}
