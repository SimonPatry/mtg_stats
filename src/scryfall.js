import { readCache, writeCache } from './lib/cache.js'

/**
 * Cadencement des appels à Scryfall.
 *
 * Scryfall demande d'espacer les requêtes d'une cinquantaine de millisecondes.
 * La version précédente allait bien au-delà : elle les SÉRIALISAIT, chacune
 * attendant la fin de la précédente PUIS 80 ms. Quarante illustrations à
 * charger coûtaient alors quarante fois (latence + 80 ms) — douze secondes
 * mesurées sur le tableau de bord.
 *
 * Ici on tient un rythme, pas une file : une requête part toutes les 80 ms,
 * qu'importe où en sont les précédentes. Le débit demandé est respecté, mais
 * les réponses se recouvrent.
 */
const MIN_INTERVAL_MS = 80
let nextSlot = 0

function slot() {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + MIN_INTERVAL_MS
  return at === now ? Promise.resolve() : new Promise((r) => setTimeout(r, at - now))
}

async function enqueue(task) {
  await slot()
  return task()
}

/**
 * Illustrations déjà résolues, gardées d'une visite à l'autre.
 *
 * Une carte est identifiée par son nom et ne change pas d'illustration : sans
 * ce cache, chaque ouverture du tableau de bord repayait l'intégralité des
 * appels. Un mois de validité, et le cache reste facultatif — s'il est
 * indisponible ou corrompu, on retombe simplement sur les appels réseau.
 */
const IMAGE_CACHE_KEY = 'mtg-card-images-v1'
const IMAGE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

const storedImages = readCache(IMAGE_CACHE_KEY) ?? {}
let saveScheduled = false

function rememberImages(name, urls) {
  storedImages[name] = urls
  if (saveScheduled) return
  // Une seule écriture pour toute une rafale de résolutions.
  saveScheduled = true
  queueMicrotask(() => {
    saveScheduled = false
    writeCache(IMAGE_CACHE_KEY, storedImages, IMAGE_CACHE_TTL_MS)
  })
}

/** Promesses en cours, par NOM de carte — voir fetchCommanderImage. */
const cardImages = new Map()

function pickImageUrl(card, size = 'normal') {
  const uris = card.image_uris || card.card_faces?.[0]?.image_uris
  if (!uris) return null
  return uris[size] || uris.normal || uris.small
}

/** Scryfall: legendary creatures, planeswalkers « can be your commander », backgrounds, etc. */
const COMMANDER_ELIGIBILITY_FILTER = 'is:commander -is:token'

function cardOracleText(card) {
  if (card.oracle_text) return card.oracle_text
  if (card.card_faces?.length) {
    return card.card_faces.map((face) => face.oracle_text || '').join('\n')
  }
  return ''
}

function cardTypeLine(card) {
  if (card.type_line) return card.type_line
  if (card.card_faces?.length) {
    return card.card_faces.map((face) => face.type_line || '').join(' ')
  }
  return ''
}

/** Filet de sécurité si Scryfall renvoie une carte hors commandant. */
export function isCommanderEligible(card) {
  const typeLine = cardTypeLine(card)
  const oracleText = cardOracleText(card)
  const keywords = card.keywords || []

  if (typeLine.includes('Background')) return true

  if (typeLine.includes('Legendary')) {
    if (
      typeLine.includes('Creature') ||
      typeLine.includes('Planeswalker') ||
      typeLine.includes('Artifact') ||
      typeLine.includes('Enchantment') ||
      typeLine.includes('Battle')
    ) {
      return true
    }
  }

  if (/can be your commander/i.test(oracleText)) return true

  if (keywords.some((k) => /partner|friends forever|doctor'?s companion/i.test(k))) {
    return true
  }

  return /partner with|friends forever|choose a background|doctor'?s companion/i.test(
    oracleText,
  )
}

function mapSearchCard(card) {
  const oracleText = cardOracleText(card)
  return {
    name: card.name,
    imageUrl: pickImageUrl(card, 'small'),
    keywords: card.keywords || [],
    oracleText,
    isPartner: hasPartnerAbility({ keywords: card.keywords || [], oracleText }),
  }
}

function hasPartnerAbility({ keywords, oracleText }) {
  if (keywords.some((k) => /partner|friends forever|background|doctor'?s companion/i.test(k))) {
    return true
  }
  return /partner|friends forever|choose a background|doctor'?s companion/i.test(oracleText)
}

function commanderSearchRank(name, query) {
  const n = name.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return 3
  if (n.startsWith(q)) return 0
  if (n.split(',')[0].trim().startsWith(q)) return 1
  if (n.includes(q)) return 2
  return 3
}

function sortCommanderResults(cards, query) {
  return [...cards].sort((a, b) => {
    const rankDiff = commanderSearchRank(a.name, query) - commanderSearchRank(b.name, query)
    if (rankDiff !== 0) return rankDiff
    return a.name.localeCompare(b.name)
  })
}

/**
 * `commandersOnly` : le sélecteur de commandant ne veut que des cartes
 * éligibles, les carrousels acceptent n'importe quelle carte. Le filtre est
 * donc un paramètre et non une règle du transport.
 */
async function fetchCardSearch(queryString, { commandersOnly = true } = {}) {
  const q = encodeURIComponent(queryString)
  const url = `https://api.scryfall.com/cards/search?q=${q}&unique=cards&order=name`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (res.status === 404) return []
  if (!res.ok) throw new Error('Recherche Scryfall impossible')
  const json = await res.json()
  const cards = commandersOnly ? json.data.filter(isCommanderEligible) : json.data
  return cards.map(mapSearchCard)
}

function buildCommanderSearchQuery(userTerms) {
  return `${userTerms} ${COMMANDER_ELIGIBILITY_FILTER}`.trim()
}

export function searchCommanders(query) {
  const trimmed = query.trim()
  if (trimmed.length < 2) return Promise.resolve([])

  return enqueue(async () => {
    const cards = await fetchCardSearch(buildCommanderSearchQuery(trimmed))
    return sortCommanderResults(cards, trimmed).slice(0, 15)
  })
}

/**
 * Recherche de cartes, sans le filtre d'éligibilité au commandement : les
 * carrousels d'un deck contiennent n'importe quelle carte. On passe par la même
 * file d'attente que les autres appels, Scryfall demandant de les espacer.
 */
export function searchCards(query) {
  const trimmed = query.trim()
  if (trimmed.length < 2) return Promise.resolve([])

  return enqueue(async () => {
    const cards = await fetchCardSearch(trimmed, { commandersOnly: false })
    return sortCommanderResults(cards, trimmed).slice(0, 12)
  })
}

export function searchPartnerCommanders(query, excludeName = '') {
  return enqueue(async () => {
    const terms = [COMMANDER_ELIGIBILITY_FILTER]
    if (query.trim()) terms.unshift(query.trim())
    terms.push(
      '(keyword:partner OR o:"partner with" OR o:"friends forever" OR o:"choose a background")',
    )
    if (excludeName) terms.push(`-name:"${excludeName}"`)

    const cards = await fetchCardSearch(terms.join(" "))
    return sortCommanderResults(cards, query.trim()).slice(0, 15)
  })
}

function mapPrinting(card) {
  return {
    id: card.id,
    name: card.name,
    setName: card.set_name,
    setCode: card.set.toUpperCase(),
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    releasedAt: card.released_at,
    imageUrl: pickImageUrl(card, 'large') || pickImageUrl(card, 'normal'),
    scryfallUri: card.scryfall_uri,
    promo: card.promo,
    lang: card.lang,
  }
}

export function fetchAllPrintings(cardName) {
  return enqueue(async () => {
    const headers = { Accept: 'application/json' }
    let res = await fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`,
      { headers },
    )
    if (res.status === 404) {
      res = await fetch(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`,
        { headers },
      )
    }
    if (!res.ok) throw new Error('Carte introuvable sur Scryfall')

    const ref = await res.json()
    const printings = []
    let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`oracle_id:${ref.oracle_id}`)}&unique=prints&order=released&dir=asc`

    while (url) {
      const pageRes = await fetch(url, { headers })
      if (pageRes.status === 404) break
      if (!pageRes.ok) throw new Error('Impossible de charger les versions')
      const json = await pageRes.json()
      printings.push(...json.data.map(mapPrinting))
      url = json.has_more ? json.next_page : null
    }

    return printings
  })
}

/**
 * Illustration d'une carte, dans la taille demandée.
 *
 * La clé du cache est le NOM SEUL, plus le couple nom+taille comme
 * auparavant : une réponse de Scryfall contient toutes les tailles à la fois,
 * si bien que demander la même carte en « small » puis en « normal » lançait
 * deux appels pour une donnée déjà reçue. Sur le tableau de bord, où le roster
 * veut des vignettes et les parties des images moyennes, cela doublait le
 * nombre de requêtes.
 */
export function fetchCommanderImage(name, size = 'normal') {
  const known = storedImages[name]
  if (known) {
    // Une taille manquante ne doit pas relancer un appel : la réponse est déjà
    // connue, on retombe sur la plus proche.
    const url = known[size] || known.normal || known.small
    if (url) return Promise.resolve(url)
  }

  if (!cardImages.has(name)) {
    cardImages.set(name, enqueue(async () => {
      const headers = { Accept: 'application/json' }
      const exactUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
      let res = await fetch(exactUrl, { headers })

      if (res.status === 404) {
        const fuzzyUrl = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`
        res = await fetch(fuzzyUrl, { headers })
      }

      if (!res.ok) throw new Error(`Scryfall: ${name}`)

      const card = await res.json()
      const urls = {
        small: pickImageUrl(card, 'small'),
        normal: pickImageUrl(card, 'normal'),
        large: pickImageUrl(card, 'large'),
      }
      if (!urls.normal && !urls.small) throw new Error(`No image: ${name}`)
      rememberImages(name, urls)
      return urls
    }).catch((err) => {
      // Un échec ne doit pas se figer dans le cache : la prochaine visite
      // retentera au lieu de rendre un trou définitif.
      cardImages.delete(name)
      throw err
    }))
  }

  return cardImages.get(name).then((urls) => {
    const url = urls[size] || urls.normal || urls.small
    if (!url) throw new Error(`No image: ${name}`)
    return url
  })
}
