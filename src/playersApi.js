import initialPlayers from './data/players.json'

export async function loadPlayers(fallback = initialPlayers) {
  try {
    const res = await fetch('/api/players')
    if (!res.ok) throw new Error('load failed')
    return await res.json()
  } catch {
    return fallback
  }
}

export async function savePlayers(players) {
  const res = await fetch('/api/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(players),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Impossible de sauvegarder le mapping joueurs')
  }
}
