/** Chemins de l’application (react-router-dom). */
export const ROUTES = {
  vitrine: '/',
  stats: '/stats',
  decks: '/decks',
  admin: '/admin',
}

/** Vue membre dérivée de l’URL, ou null hors espace membre. */
export function memberViewFromPath(pathname) {
  if (pathname === ROUTES.stats) return 'dashboard'
  if (pathname === ROUTES.decks) return 'myDecks'
  return null
}

export function pathForMemberView(view) {
  return view === 'myDecks' ? ROUTES.decks : ROUTES.stats
}
