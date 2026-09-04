import initialDecks from './data/decks.json'
import { loadDataSource, sourceQuery } from './dataSource'
import {
  BACKUP_REASON,
  createBackup,
  listBackups,
  loadBackupFile,
} from './backupApi'

function decksUrl() {
  return `/api/decks${sourceQuery(loadDataSource())}`
}

export async function loadDecks(fallback = initialDecks, source = loadDataSource()) {
  try {
    const res = await fetch(`/api/decks${sourceQuery(source)}`)
    if (!res.ok) throw new Error('load failed')
    return await res.json()
  } catch {
    return fallback
  }
}

export async function listDeckBackups() {
  return listBackups('decks')
}

export async function rollbackDecksBackup(name, currentDecks) {
  const restored = await loadBackupFile(name)
  const result = await saveDecks(restored, currentDecks, {
    reason: BACKUP_REASON.ROLLBACK,
  })
  return { restored, backupFile: result.backupFile }
}

export async function saveDecks(decks, previousDecks, { reason } = {}) {
  let backupFile
  if (previousDecks !== undefined) {
    const backup = await createBackup(
      'decks',
      previousDecks,
      reason ?? BACKUP_REASON.MANUAL_EDIT,
    )
    backupFile = backup.filename
  }

  const res = await fetch(decksUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decks),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Impossible de sauvegarder les decks')
  }
  return { backupFile }
}
