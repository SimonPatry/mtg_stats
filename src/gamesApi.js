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

export const BACKUP_REASON = {
  MANUAL_EDIT: 'manual-edit',
  ROLLBACK: 'rollback',
  ADD_GAME: 'add-game',
}

export async function backupGames(games, reason = BACKUP_REASON.MANUAL_EDIT) {
  const res = await fetch('/api/games/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ games, reason }),
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

export async function loadBackup(name) {
  const res = await fetch(`/backups/${encodeURIComponent(name)}`)
  if (!res.ok) {
    throw new Error('Sauvegarde introuvable')
  }
  const data = await res.json()
  if (!Array.isArray(data)) {
    throw new Error('La sauvegarde doit être un tableau de parties')
  }
  return data
}

export async function rollbackToBackup(name, currentGames) {
  const restored = await loadBackup(name)
  const result = await saveGames(restored, currentGames, {
    reason: BACKUP_REASON.ROLLBACK,
  })
  return { restored, backupFile: result.backupFile }
}

export async function saveGames(newGames, previousGames, { reason } = {}) {
  let backupFile
  if (previousGames !== undefined) {
    const backup = await backupGames(
      previousGames,
      reason ?? BACKUP_REASON.MANUAL_EDIT,
    )
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

/** Dernier joueur à avoir joué un tour (chaîne vide si absent). */
export function getLastPlayer(game) {
  return typeof game?.lastPlayer === 'string' ? game.lastPlayer.trim() : ''
}

export function getLastSeatOrder(game) {
  const seat = game?.lastSeatOrder
  return typeof seat === 'number' && seat >= 1 && seat <= 4 ? seat : null
}

/** Un seul deck peut être « last » — par siège si dispo, sinon par nom unique. */
export function isLastDeck(game, deck) {
  const seat = getLastSeatOrder(game)
  if (seat != null) return deck.seatOrder === seat
  const name = getLastPlayer(game)
  if (!name) return false
  const player = (deck.player ?? '').trim()
  if (player !== name) return false
  const sameName = game.decks.filter(
    (d) => (d.player ?? '').trim() === name,
  ).length
  return sameName === 1
}

export function getLastPlayerLabel(game) {
  const seat = getLastSeatOrder(game)
  const name = getLastPlayer(game)
  if (!name) return '—'
  if (seat != null) return `${name} (#${seat})`
  return name
}

/** Nombre de board wipes (compat legacy `hadWipe` booléen). */
export function getBoardWipes(game) {
  if (typeof game.boardWipes === 'number' && !Number.isNaN(game.boardWipes)) {
    return Math.max(0, game.boardWipes)
  }
  if (typeof game.hadWipe === 'boolean') {
    return game.hadWipe ? 1 : 0
  }
  return Math.max(0, Number(game.boardWipes) || 0)
}
