import { readCache, writeCache } from './cache.js'

/**
 * Client Scryfall pour la vitrine (et l’autocomplétion admin).
 *
 * Scryfall demande ~50–100 ms entre requêtes API — pas de sérialiser
 * « attendre la réponse précédente ». Les créneaux se chevauchent.
 *
 * Surtout : les resolveCard du même tick (ex. 12 cartes d’un carrousel)
 * sont regroupés en UN POST /cards/collection (max 75). C’est le modèle
 * Moxfield / Archidekt : peu d’appels API, puis images CDN en parallèle.
 */

const MIN_INTERVAL_MS = 75
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'scryfall-card-v3'
const COLLECTION_URL = 'https://api.scryfall.com/cards/collection'
const COLLECTION_MAX = 75

let nextSlot = 0
const inflight = new Map()

/** File de coalescence : tout resolveCard du même tour d’event-loop. */
let coalesce = []
let coalesceScheduled = false

function slot() {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + MIN_INTERVAL_MS
  return at === now ? Promise.resolve() : new Promise((r) => setTimeout(r, at - now))
}

async function throttledFetch(url, options) {
  await slot()
  const res = await fetch(url, options)
  if (res.status === 429) {
    const retry = Number(res.headers.get('Retry-After') || 1) * 1000
    await new Promise((r) => setTimeout(r, Math.max(retry, MIN_INTERVAL_MS)))
    await slot()
    return fetch(url, options)
  }
  return res
}

export const cardCacheKey = (name, set = '', collectorNumber = '') =>
  `${CACHE_PREFIX}:${name}:${String(set || '').toLowerCase()}:${String(collectorNumber || '')}`

export function peekCard(name, set = '', collectorNumber = '') {
  if (!name) return null
  return readCache(cardCacheKey(name, set, collectorNumber))
}

function extractImageUrl(card) {
  const uris = card.image_uris || card.card_faces?.[0]?.image_uris
  return uris?.normal || uris?.large || uris?.small || null
}

function fromApiCard(card) {
  return {
    image: extractImageUrl(card),
    uri: card.scryfall_uri || null,
  }
}

function remember(key, resolved) {
  if (resolved?.image) writeCache(key, resolved, CACHE_TTL_MS)
  return resolved
}

function toIdentifier({ name, set = '', collectorNumber = '' }) {
  const setCode = String(set || '').toLowerCase()
  const number = String(collectorNumber || '')
  if (setCode && number) {
    return { set: setCode, collector_number: number }
  }
  return { name: String(name || '').trim() }
}

function matchesIdentifier(card, id) {
  if (id.set && id.collector_number != null) {
    return (
      String(card.set).toLowerCase() === String(id.set).toLowerCase() &&
      String(card.collector_number) === String(id.collector_number)
    )
  }
  if (id.name) {
    const want = id.name.toLowerCase()
    return (
      card.name?.toLowerCase() === want ||
      card.card_faces?.some((f) => f.name?.toLowerCase() === want)
    )
  }
  return false
}

async function fetchOne({ name, set, collectorNumber, key }) {
  const setCode = String(set || '').toLowerCase()
  const number = String(collectorNumber || '')
  const url =
    setCode && number
      ? `https://api.scryfall.com/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(number)}`
      : `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`

  const res = await throttledFetch(url)
  if (!res.ok) throw new Error(`Scryfall a répondu ${res.status} pour « ${name} »`)
  return remember(key, fromApiCard(await res.json()))
}

async function fetchCollectionChunk(entries) {
  const identifiers = entries.map((e) => toIdentifier(e))
  const res = await throttledFetch(COLLECTION_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identifiers }),
  })

  if (!res.ok) {
    // Repli unitaire plutôt que d’abandonner le lot.
    await Promise.all(
      entries.map(async (entry) => {
        try {
          const resolved = await fetchOne(entry)
          entry.resolve(resolved)
        } catch (err) {
          entry.reject(err)
        }
      }),
    )
    return
  }

  const json = await res.json()
  const found = Array.isArray(json.data) ? json.data : []

  for (const entry of entries) {
    const id = toIdentifier(entry)
    const card = found.find((c) => matchesIdentifier(c, id))
    if (card) {
      entry.resolve(remember(entry.key, fromApiCard(card)))
    } else {
      // Collection rate / not_found : dernier recours named/set.
      try {
        entry.resolve(await fetchOne(entry))
      } catch (err) {
        entry.reject(err)
      }
    }
  }
}

function flushCoalesce() {
  coalesceScheduled = false
  const batch = coalesce
  coalesce = []
  if (batch.length === 0) return

  // Une seule entrée par clé ; plusieurs waiters partagent la même promesse.
  const byKey = new Map()
  for (const entry of batch) {
    const list = byKey.get(entry.key)
    if (list) list.push(entry)
    else byKey.set(entry.key, [entry])
  }

  const unique = [...byKey.values()].map((waiters) => {
    const head = waiters[0]
    return {
      ...head,
      resolve(value) {
        for (const w of waiters) w.resolve(value)
      },
      reject(err) {
        for (const w of waiters) w.reject(err)
      },
    }
  })

  ;(async () => {
    for (let i = 0; i < unique.length; i += COLLECTION_MAX) {
      const chunk = unique.slice(i, i + COLLECTION_MAX)
      if (chunk.length === 1) {
        const entry = chunk[0]
        try {
          entry.resolve(await fetchOne(entry))
        } catch (err) {
          entry.reject(err)
        }
      } else {
        try {
          await fetchCollectionChunk(chunk)
        } catch (err) {
          for (const entry of chunk) entry.reject(err)
        }
      }
    }
  })()
}

function scheduleCoalesce() {
  if (coalesceScheduled) return
  coalesceScheduled = true
  queueMicrotask(flushCoalesce)
}

/**
 * Résout une carte : { image, uri }. Regroupé automatiquement avec les
 * autres appels du même tick via /cards/collection.
 */
export function resolveCard({ name, set = '', collectorNumber = '' }) {
  if (!name) return Promise.resolve(null)

  const setCode = String(set || '').toLowerCase()
  const number = String(collectorNumber || '')
  const key = cardCacheKey(name, setCode, number)
  const cached = readCache(key)
  if (cached) return Promise.resolve(cached)

  if (inflight.has(key)) return inflight.get(key)

  const task = new Promise((resolve, reject) => {
    coalesce.push({
      name,
      set: setCode,
      collectorNumber: number,
      key,
      resolve,
      reject,
    })
    scheduleCoalesce()
  }).finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, task)
  return task
}

/**
 * Précharge un lot (même pipeline que resolveCard — coalescence + cache).
 */
export function prefetchCards(items = []) {
  return Promise.all(
    items
      .filter((item) => item?.name)
      .map((item) =>
        resolveCard({
          name: item.name,
          set: item.set || '',
          collectorNumber: item.collectorNumber || '',
        }).catch(() => null),
      ),
  )
}

export async function autocomplete(query, signal) {
  if (query.trim().length < 3) return []
  const url = `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`
  const res = await throttledFetch(url, { signal })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.data) ? data.data.slice(0, 10) : []
}

export const manaSymbolUrl = (letter) =>
  `https://svgs.scryfall.io/card-symbols/${letter}.svg`
