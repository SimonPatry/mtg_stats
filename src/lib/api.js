import { readCache, writeCache, cacheSavedAt } from './cache.js'

/**
 * Client de l'API EDH Forge.
 *
 * `credentials: 'include'` est indispensable : le JWT vit dans un cookie
 * httpOnly, c'est le navigateur qui doit l'attacher à chaque appel.
 *
 * Les appels sont relatifs (/api/...) : en développement Vite les relaie vers
 * l'API, en production les deux sont servis par la même origine. Plus de CORS
 * ni d'URL absolue à maintenir.
 */
const JSON_HEADERS = { 'Content-Type': 'application/json' }

const DECKS_CACHE_KEY = 'mtg-showcase-decks-v1'
const DECKS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, { credentials: 'include', ...options })
  if (res.status === 204) return null

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(body.error || `Erreur ${res.status}`), {
      status: res.status,
      body,
    })
  }
  return body
}

const send = (method) => (path, payload) =>
  request(path, { method, headers: JSON_HEADERS, body: JSON.stringify(payload) })

const post = send('POST')
const put = send('PUT')

/**
 * Lecture des decks avec repli sur le cache.
 *
 * Renvoie { decks, stale, savedAt } : `stale` vaut true quand l'API n'a pas
 * répondu et qu'on ressert la dernière réponse connue. Le site affiche alors
 * un bandeau plutôt qu'une page vide — une vitrine reste lisible même quand
 * son back-office dort.
 */
export async function loadShowcase() {
  try {
    const decks = await request('/showcase/decks')
    writeCache(DECKS_CACHE_KEY, decks, DECKS_CACHE_TTL_MS)
    return { decks, stale: false, savedAt: null }
  } catch (err) {
    const cached = readCache(DECKS_CACHE_KEY)
    if (cached) {
      return { decks: cached, stale: true, savedAt: cacheSavedAt(DECKS_CACHE_KEY) }
    }
    throw err
  }
}

export const api = {
  me: () => request('/auth/me'),
  login: (username, password) => post('/auth/login', { username, password }),
  register: (username, password) => post('/auth/register', { username, password }),
  logout: () => post('/auth/logout', {}),

  reference: () => request('/reference'),
  dashboard: () => request('/stats/dashboard'),
  versionStats: () => request('/stats/versions'),

  listUsers: () => request('/users'),
  createUser: (user) => post('/users', user),
  updateUser: (id, user) => put(`/users/${id}`, user),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  updateAccount: (id, payload) => put(`/accounts/${id}`, payload),

  listTags: () => request('/tags'),
  createTag: (label) => post('/tags', { label }),
  updateTag: (id, label) => put(`/tags/${id}`, { label }),
  deleteTag: (id) => request(`/tags/${id}`, { method: 'DELETE' }),

  getDeck: (id) => request(`/decks/${id}`),
  createDeck: (payload) => post('/decks', payload),
  updateDeck: (id, deck) => put(`/decks/${id}`, deck),
  listDecks: () => request('/decks?versions=1'),
  addDeckVersion: (id, version) => post(`/decks/${id}/versions`, version),
  updateDeckVersion: (id, versionId, version) => put(`/decks/${id}/versions/${versionId}`, version),
  deleteDeck: (id) => request(`/decks/${id}`, { method: 'DELETE' }),

  listGames: () => request('/games'),
  getGame: (id) => request(`/games/${id}`),
  createGame: (game) => post('/games', game),
  updateGame: (id, game) => put(`/games/${id}`, game),
  deleteGame: (id) => request(`/games/${id}`, { method: 'DELETE' }),
}
