import { v4 as uuidv4 } from 'uuid'

export async function loadGames(fallback) {
  try {
    const res = await fetch('/api/games')
    if (!res.ok) throw new Error('load failed')
    return await res.json()
  } catch {
    return fallback
  }
}

export async function saveGames(games) {
  const res = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(games),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Impossible de sauvegarder')
  }
}

export function createGameId() {
  return uuidv4()
}
