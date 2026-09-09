/** Id DOM d’une bande vitrine (`id="deck-<uuid>"`). */
export function deckAnchorId(deckId) {
  return `deck-${deckId}`
}

/**
 * Scroll vers une bande. Le history API / react-router mettent le hash dans
 * l’URL sans déclencher le scroll natif du navigateur — d’où ce passage explicite.
 */
export function scrollToDeckAnchor(deckId, { behavior = 'smooth' } = {}) {
  const id = deckAnchorId(deckId)
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior, block: 'start' })
  return true
}

/** Retente le scroll tant que la bande n’est pas encore montée (chargement). */
export function scrollToDeckAnchorWhenReady(deckId, { attempts = 12, delayMs = 50 } = {}) {
  if (scrollToDeckAnchor(deckId)) return () => {}
  let left = attempts
  const timer = setInterval(() => {
    left -= 1
    if (scrollToDeckAnchor(deckId) || left <= 0) clearInterval(timer)
  }, delayMs)
  return () => clearInterval(timer)
}
