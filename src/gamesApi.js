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

export async function backupGames(games) {
  const res = await fetch('/api/games/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(games),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Impossible de créer la sauvegarde')
  }
  return res.json()
}

export async function listGameBackups() {
  try {
    const res = await fetch('/api/games/backup')
    if (!res.ok) throw new Error('list failed')
    return await res.json()
  } catch {
    return []
  }
}

export async function saveGames(newGames, previousGames) {
  let backupFile
  if (previousGames !== undefined) {
    const backup = await backupGames(previousGames)
    backupFile = backup.filename
  }

  const res = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newGames),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Impossible de sauvegarder')
  }

  return { backupFile }
}

export function createGameId() {
  return uuidv4()
}
