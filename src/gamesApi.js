import { v4 as uuidv4 } from 'uuid'
import { loadDataSource, sourceQuery } from './dataSource'
import {
  BACKUP_REASON,
  createBackup,
  listBackups,
  loadBackupFile,
} from './backupApi'

export { BACKUP_REASON }

function gamesUrl(path = '') {
  return `/api/games${path}${sourceQuery(loadDataSource())}`
}

export async function loadGames(fallback, source = loadDataSource()) {
  try {
    const res = await fetch(`/api/games${sourceQuery(source)}`)
    if (!res.ok) throw new Error('load failed')
    return await res.json()
  } catch {
    return fallback
  }
}

export async function backupGames(games, reason = BACKUP_REASON.MANUAL_EDIT) {
  return createBackup('games', games, reason)
}

export async function listGameBackups() {
  return listBackups('games')
}

export async function loadBackup(name) {
  return loadBackupFile(name)
}

export async function rollbackToBackup(name, currentGames) {
  const restored = await loadBackupFile(name)
  const result = await saveGames(restored, currentGames, {
    reason: BACKUP_REASON.ROLLBACK,
  })
  return { restored, backupFile: result.backupFile }
}

export async function saveGames(newGames, previousGames, { reason } = {}) {
  let backupFile
  if (previousGames !== undefined) {
    const backup = await createBackup(
      'games',
      previousGames,
      reason ?? BACKUP_REASON.MANUAL_EDIT,
    )
    backupFile = backup.filename
  }

  const res = await fetch(gamesUrl(), {
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

/** Supprime une partie (mot de passe admin requis côté serveur). */
export async function deleteGame(gameId, password) {
  const res = await fetch(gamesUrl('/delete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: gameId, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Suppression impossible (HTTP ${res.status})`)
  }
  return res.json()
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
  return typeof seat === 'number' && seat >= 1 && seat <= 5 ? seat : null
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
