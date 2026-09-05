import { v4 as uuidv4 } from 'uuid'
import { api } from './lib/api.js'
import { gameFromApi, gameToApi, diffById } from './lib/adapters.js'

/**
 * Accès aux parties.
 *
 * Les fonctions de lecture et d'écriture parlent désormais à l'API ; les
 * helpers purs en bas du fichier n'ont pas bougé. Les composants continuent de
 * manipuler des tableaux complets — c'est `saveGames` qui traduit la
 * différence entre l'ancien et le nouveau tableau en appels par entité.
 *
 * Les sauvegardes horodatées ont disparu avec les fichiers JSON : la base est
 * transactionnelle, et il n'y a plus de tableau global à écraser par mégarde.
 */

export async function loadGames(fallback = []) {
  try {
    return (await api.listGames()).map(gameFromApi)
  } catch {
    return fallback
  }
}

/**
 * Enregistre le nouveau tableau de parties. Les créations, modifications et
 * suppressions sont déduites par comparaison avec le tableau précédent.
 */
export async function saveGames(nextGames, previousGames, { userIdByName } = {}) {
  const { created, updated, removed } = diffById(previousGames, nextGames)
  // Le siège ne porte que le nom du joueur ; on rattache l'identifiant quand on
  // le connaît, pour que la base garde le lien vers la fiche joueur.
  const options = userIdByName
    ? { userIdBySeat: (seat) => seat.userId ?? userIdByName.get(seat.player) ?? null }
    : undefined

  for (const game of removed) await api.deleteGame(game.id)
  for (const game of updated) await api.updateGame(game.id, gameToApi(game, options))

  // Une partie créée localement porte un identifiant provisoire ; c'est
  // l'identifiant rendu par l'API qui fait foi ensuite.
  const createdIds = new Map()
  for (const game of created) {
    const saved = await api.createGame(gameToApi(game, options))
    createdIds.set(game.id, saved.id)
  }
  return { createdIds }
}

export async function deleteGame(gameId) {
  await api.deleteGame(gameId)
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
