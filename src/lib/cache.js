/**
 * Petit cache localStorage avec date d'expiration.
 *
 * Tolérant par construction : navigation privée, quota plein, JSON corrompu —
 * dans tous les cas on se comporte comme un défaut de cache plutôt que de
 * casser la page. Un cache ne doit jamais être un point de panne.
 */

export function readCache(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { value, expiresAt } = JSON.parse(raw)
    if (typeof expiresAt === 'number' && Date.now() > expiresAt) {
      localStorage.removeItem(key)
      return null
    }
    return value ?? null
  } catch {
    return null
  }
}

export function writeCache(key, value, ttlMs) {
  try {
    const expiresAt = typeof ttlMs === 'number' ? Date.now() + ttlMs : null
    localStorage.setItem(key, JSON.stringify({ value, expiresAt, savedAt: Date.now() }))
  } catch {
    /* quota plein ou stockage indisponible : tant pis */
  }
}

/** Date d'écriture d'une entrée, pour afficher « données du … » en mode dégradé. */
export function cacheSavedAt(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { savedAt } = JSON.parse(raw)
    return typeof savedAt === 'number' ? new Date(savedAt) : null
  } catch {
    return null
  }
}
