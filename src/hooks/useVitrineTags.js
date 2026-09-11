import { createStore } from '../lib/store.js'

/**
 * Tags cochés sur la vitrine.
 * Persistés hors du composant : ni ancre, ni recherche, ni remount de page
 * ne les enlèvent — seulement un clic utilisateur (puce ou « Retirer les tags »).
 */
const store = createStore([])

export function useVitrineTags() {
  const selectedTags = store.use()
  return {
    selectedTags,
    setSelectedTags: (next) => store.set(next),
    clearSelectedTags: () => store.set([]),
  }
}
