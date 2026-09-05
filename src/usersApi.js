import { api } from './lib/api.js'
import { userFromApi, userToApi, diffById } from './lib/adapters.js'

/** Accès aux joueurs. Même principe que gamesApi : tableau complet en entrée,
 *  appels par entité en sortie. */

export async function loadUsers(fallback = []) {
  try {
    return (await api.listUsers()).map(userFromApi)
  } catch {
    return fallback
  }
}

export async function saveUsers(nextUsers, previousUsers) {
  const { created, updated, removed } = diffById(previousUsers, nextUsers)

  for (const user of removed) {
    // Un joueur qui possède des decks n'est pas supprimable : l'API renvoie
    // 409, et la désactivation est le bon geste. On ne fait pas échouer tout
    // l'enregistrement pour autant.
    try { await api.deleteUser(user.id) } catch { /* conservé, désactivé */ }
  }
  for (const user of updated) await api.updateUser(user.id, userToApi(user))

  const createdIds = new Map()
  for (const user of created) {
    const saved = await api.createUser(userToApi(user))
    createdIds.set(user.id, saved.id)
  }
  return { createdIds }
}
