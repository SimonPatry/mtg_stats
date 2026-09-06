import { useEffect } from 'react'
import { createStore } from '../lib/store.js'
import { api } from '../lib/api.js'

/**
 * Session compte. `null` = pas encore résolu.
 * Persistée via cookie httpOnly (7 jours, renouvelé à chaque /me).
 */
const store = createStore(null)
let inFlight = null

function normalize(payload) {
  if (!payload?.authenticated || !payload.user) return false
  const role = payload.user.role === 'admin' ? 'admin' : 'user'
  return {
    authenticated: true,
    role,
    user: {
      id: payload.user.id,
      username: payload.user.username,
      role,
      playerId: payload.user.playerId ?? null,
    },
  }
}

export function signOut() {
  store.set(false)
  return api.logout().catch(() => {})
}

export function useAuth({ probe = true } = {}) {
  const session = store.use()

  useEffect(() => {
    if (!probe) return
    if (store.get() !== null || inFlight) return
    inFlight = api.me()
      .then((r) => store.set(normalize(r)))
      .catch(() => store.set(false))
      .finally(() => { inFlight = null })
  }, [probe])

  const signedIn = session && session.authenticated === true

  return {
    authenticated: session === null ? null : Boolean(signedIn),
    role: signedIn ? session.role : null,
    user: signedIn ? session.user : null,
    isAdmin: signedIn && session.role === 'admin',
    isMember: signedIn,
    signIn: (payload) => store.set(normalize(payload)),
    signOut,
  }
}
