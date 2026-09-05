import { readCache, writeCache } from './cache.js'

/**
 * Client Scryfall partagé par le site public (illustrations) et par
 * l'autocomplétion de l'administration.
 *
 * Scryfall demande d'espacer les requêtes de 50 à 100 ms et de mettre les
 * résultats en cache au moins 24 h. On respecte les deux : une file d'attente
 * qui sérialise les appels, et un cache de 7 jours — l'illustration d'une
 * carte ne change quasiment jamais.
 */

const MIN_DELAY_MS = 100
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'scryfall-card-v3'

let queue = Promise.resolve()

/** Sérialise les appels et garantit le délai minimum entre deux requêtes. */
function throttledFetch(url, options) {
  const run = queue.then(() => fetch(url, options))
  // Que la requête précédente réussisse ou échoue, on espace la suivante.
  queue = run.catch(() => {}).then(
    () => new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS))
  )
  return run
}

const cacheKey = (name, set, collectorNumber) =>
  `${CACHE_PREFIX}:${name}:${set || ''}:${collectorNumber || ''}`

/** L'image la plus adaptée, y compris pour les cartes recto-verso. */
function extractImageUrl(card) {
  const uris = card.image_uris || card.card_faces?.[0]?.image_uris
  return uris?.normal || uris?.large || uris?.small || null
}

/**
 * Résout une carte : { image, uri }. `uri` est la page Scryfall de la carte.
 * Renvoie null si la carte est introuvable — l'appelant décide quoi afficher.
 */
export async function resolveCard({ name, set = '', collectorNumber = '' }) {
  if (!name) return null

  const key = cacheKey(name, set, collectorNumber)
  const cached = readCache(key)
  if (cached) return cached

  const url =
    set && collectorNumber
      ? `https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(collectorNumber)}`
      : `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`

  const res = await throttledFetch(url)
  if (!res.ok) throw new Error(`Scryfall a répondu ${res.status} pour « ${name} »`)

  const card = await res.json()
  const resolved = { image: extractImageUrl(card), uri: card.scryfall_uri || null }
  if (resolved.image) writeCache(key, resolved, CACHE_TTL_MS)
  return resolved
}

/**
 * Autocomplétion de noms de cartes. Passe par la même file d'attente que le
 * reste : l'admin ne martèle plus Scryfall à chaque frappe.
 */
export async function autocomplete(query, signal) {
  if (query.trim().length < 3) return []
  const url = `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`
  const res = await throttledFetch(url, { signal })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.data) ? data.data.slice(0, 10) : []
}

/** Icône officielle d'un symbole de mana (même origine que les illustrations). */
export const manaSymbolUrl = (letter) =>
  `https://svgs.scryfall.io/card-symbols/${letter}.svg`
