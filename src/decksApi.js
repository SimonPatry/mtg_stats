import initialDecks from './data/decks.json'

export async function loadDecks(fallback = initialDecks) {
  try {
    const res = await fetch('/api/decks')
    if (!res.ok) throw new Error('load failed')
    return await res.json()
  } catch {
    return fallback
  }
}

export async function saveDecks(decks) {
  const res = await fetch('/api/decks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decks),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Impossible de sauvegarder les decks')
  }
}
