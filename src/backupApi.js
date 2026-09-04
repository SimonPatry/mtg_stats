import { loadDataSource, sourceQuery } from './dataSource'

export const BACKUP_REASON = {
  MANUAL_EDIT: 'manual-edit',
  ROLLBACK: 'rollback',
  ADD_GAME: 'add-game',
}

export const BACKUP_KINDS = ['games', 'users', 'decks']

function apiUrl(kind, path = '') {
  return `/api/${kind}${path}${sourceQuery(loadDataSource())}`
}

function backupFileUrl(name) {
  const params = new URLSearchParams({ name })
  const source = loadDataSource()
  if (source === 'fake') params.set('source', 'fake')
  return `/api/backup-file?${params.toString()}`
}

/** Crée un backup du contenu actuel avant écriture. */
export async function createBackup(kind, data, reason = BACKUP_REASON.MANUAL_EDIT) {
  if (!BACKUP_KINDS.includes(kind)) {
    throw new Error(`Kind de backup invalide: ${kind}`)
  }
  const res = await fetch(apiUrl(kind, '/backup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, reason }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Impossible de créer la sauvegarde ${kind}`)
  }
  return res.json()
}

/** Liste les backups d’un kind (games | users | decks). */
export async function listBackups(kind) {
  try {
    const res = await fetch(apiUrl(kind, '/backup'))
    if (!res.ok) throw new Error('list failed')
    return await res.json()
  } catch {
    return []
  }
}

/** Charge le contenu d’un fichier de backup. */
export async function loadBackupFile(name) {
  const res = await fetch(backupFileUrl(name))
  if (!res.ok) {
    throw new Error('Sauvegarde introuvable')
  }
  const data = await res.json()
  if (!Array.isArray(data)) {
    throw new Error('La sauvegarde doit être un tableau')
  }
  return data
}
