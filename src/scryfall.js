const imageCache = new Map()
let requestChain = Promise.resolve()

function enqueue(task) {
  const next = requestChain
    .then(() => new Promise((resolve) => setTimeout(resolve, 80)))
    .then(task)
  requestChain = next.catch(() => {})
  return next
}

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

async function fetchCommanderSearch(queryString) {
  const q = encodeURIComponent(queryString)
  const url = `https://api.scryfall.com/cards/search?q=${q}&unique=cards&order=name`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (res.status === 404) return []
  if (!res.ok) throw new Error('Recherche Scryfall impossible')
  const json = await res.json()
  return json.data.filter(isCommanderEligible).map(mapSearchCard)
}

function buildCommanderSearchQuery(userTerms) {
  return `${userTerms} ${COMMANDER_ELIGIBILITY_FILTER}`.trim()
}

export function searchCommanders(query) {
  const trimmed = query.trim()
  if (trimmed.length < 2) return Promise.resolve([])

  return enqueue(async () => {
    const cards = await fetchCommanderSearch(buildCommanderSearchQuery(trimmed))
    return sortCommanderResults(cards, trimmed).slice(0, 15)
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

    const cards = await fetchCommanderSearch(terms.join(' '))
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

export function fetchCommanderImage(name, size = 'normal') {
  const key = `${name}::${size}`
  if (imageCache.has(key)) return imageCache.get(key)

  const promise = enqueue(async () => {
    const headers = { Accept: 'application/json' }
    const exactUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
    let res = await fetch(exactUrl, { headers })

    if (res.status === 404) {
      const fuzzyUrl = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`
      res = await fetch(fuzzyUrl, { headers })
    }

    if (!res.ok) throw new Error(`Scryfall: ${name}`)

    const card = await res.json()
    const imageUrl = pickImageUrl(card, size)
    if (!imageUrl) throw new Error(`No image: ${name}`)
    return imageUrl
  })

  imageCache.set(key, promise)
  return promise
}
