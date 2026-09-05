import { useSyncExternalStore } from 'react'

/**
 * Micro-magasin d'état global, sans dépendance.
 *
 * Remplace les signaux de Preact par le mécanisme prévu par React lui-même
 * (`useSyncExternalStore`) : une valeur, des abonnés, et un hook pour la lire.
 * Une trentaine de lignes valent mieux qu'une bibliothèque d'état pour les
 * deux valeurs globales de ce projet — l'aperçu de carte et la session.
 */
export function createStore(initial) {
  let value = initial
  const listeners = new Set()

  const get = () => value
  const set = (next) => {
    const resolved = typeof next === 'function' ? next(value) : next
    if (Object.is(resolved, value)) return
    value = resolved
    listeners.forEach((listener) => listener())
  }
  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { get, set, subscribe, use: () => useSyncExternalStore(subscribe, get, get) }
}
