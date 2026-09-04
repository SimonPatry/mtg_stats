import initialUsers from './data/users.json'
import { loadDataSource, sourceQuery } from './dataSource'
import {
  BACKUP_REASON,
  createBackup,
  listBackups,
  loadBackupFile,
} from './backupApi'

function usersUrl() {
  return `/api/users${sourceQuery(loadDataSource())}`
}

export async function loadUsers(fallback = initialUsers, source = loadDataSource()) {
  try {
    const res = await fetch(`/api/users${sourceQuery(source)}`)
    if (!res.ok) throw new Error('load failed')
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) throw new Error('not json')
    return await res.json()
  } catch {
    return fallback
  }
}

export async function listUserBackups() {
  return listBackups('users')
}

export async function rollbackUsersBackup(name, currentUsers) {
  const restored = await loadBackupFile(name)
  const result = await saveUsers(restored, currentUsers, {
    reason: BACKUP_REASON.ROLLBACK,
  })
  return { restored, backupFile: result.backupFile }
}

export async function saveUsers(users, previousUsers, { reason } = {}) {
  let backupFile
  if (previousUsers !== undefined) {
    const backup = await createBackup(
      'users',
      previousUsers,
      reason ?? BACKUP_REASON.MANUAL_EDIT,
    )
    backupFile = backup.filename
  }

  const res = await fetch(usersUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(users),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Impossible de sauvegarder les joueurs')
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('L’API joueurs ne répond pas (le serveur a renvoyé une page HTML).')
  }
  return { backupFile }
}
