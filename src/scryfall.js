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
