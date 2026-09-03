import initialUsers from './data/users.json'
import { loadDataSource, sourceQuery } from './dataSource'

function usersUrl() {
  return `/api/users${sourceQuery(loadDataSource())}`
}

export async function loadUsers(fallback = initialUsers, source = loadDataSource()) {
  try {
    const res = await fetch(`/api/users${sourceQuery(source)}`)
    if (!res.ok) throw new Error('load failed')
    return await res.json()
  } catch {
    return fallback
  }
}

export async function saveUsers(users) {
  const res = await fetch(usersUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(users),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Impossible de sauvegarder les joueurs')
  }
}
