/**
 * Traduction entre la forme de l'API et la forme JSON historique.
 *
 * Les vingt composants de l'administration raisonnent en tableaux `games`,
 * `users` et `decks` tels qu'ils étaient stockés dans les fichiers. Plutôt que
 * de les réécrire tous d'un coup, on traduit à la frontière : le reste du code
 * ne voit aucune différence, et on retire l'adaptation flux par flux ensuite.
 *
 * Le seul point subtil est le deck. Dans le JSON, une VERSION est une ligne,
 * chaînée par `previousDeckId`. En base, une lignée est une ligne et ses états
 * successifs vivent dans `deck_versions`. On reconstitue donc une ligne
 * historique par version — ce qui fait tomber juste `getDeckVersionChain`,
 * `getCurrentDeckForCommanders` et le calcul des statistiques, sans y toucher.
 */

// ─── Joueurs ───────────────────────────────────────────────────────────────
export const userFromApi = (user) => ({
  id: user.id,
  name: user.name,
  active: user.active !== false,
  accountId: user.account_id ?? null,
  accountUsername: user.account_username ?? null,
  accountRole: user.account_role ?? null,
})

export const userToApi = (user) => ({
  name: user.name,
  active: user.active !== false,
})

// ─── Decks ─────────────────────────────────────────────────────────────────
const commanderNames = (deck) =>
  (deck.commanders ?? []).map((c) => (typeof c === 'string' ? c : c.name))

/** Reconstruit comPrint depuis les impressions stockées en base. */
function comPrintFromApi(commanders) {
  const print = {}
  for (const c of commanders ?? []) {
    if (typeof c === 'string') continue
    const set = c.set_code || ''
    const collectorNumber = c.collector_number || ''
    if (!set && !collectorNumber) continue
    print[c.name] = { set, collectorNumber, imageUrl: '' }
  }
  return Object.keys(print).length > 0 ? print : undefined
}

/**
 * Une lignée devient N lignes historiques, une par version, chaînées entre
 * elles. Seule la dernière est « active » — c'est la convention qu'appliquait
 * le JSON, et dont dépend `getActiveDecks`.
 */
export function decksFromApi(decks) {
  const rows = []
  for (const deck of decks) {
    const versions = (deck.versions ?? []).slice()
      .sort((a, b) => a.version_number - b.version_number)
    const commanders = commanderNames(deck)
    const comPrint = comPrintFromApi(deck.commanders)

    if (versions.length === 0) {
      rows.push({
        id: deck.id,
        userId: deck.user_id,
        com: commanders.length > 1 ? commanders : (commanders[0] ?? ''),
        bracket: deck.current_version?.bracket ?? null,
        bracketVariation: deck.current_version?.bracket_variation ?? null,
        deckUrl: deck.current_version?.deck_url ?? '',
        active: deck.active !== false,
        archived: Boolean(deck.archived),
        createdAt: deck.created_on ?? null,
        lineageId: deck.id,
        tags: deck.tags ?? [],
        ...(comPrint ? { comPrint } : {}),
      })
      continue
    }

    versions.forEach((version, index) => {
      rows.push({
        id: version.id,
        userId: deck.user_id,
        com: commanders.length > 1 ? commanders : (commanders[0] ?? ''),
        bracket: version.bracket ?? null,
        bracketVariation: version.bracket_variation ?? null,
        deckUrl: version.deck_url ?? '',
        // Seule la dernière version d'une lignée active reste active.
        active: deck.active !== false && index === versions.length - 1,
        archived: Boolean(deck.archived),
        createdAt: version.started_on ?? deck.created_on ?? null,
        previousDeckId: index > 0 ? versions[index - 1].id : undefined,
        // Champs propres à la base, ignorés par les composants mais utiles à
        // l'écriture : ils disent à quelle lignée appartient cette ligne.
        lineageId: deck.id,
        versionNumber: version.version_number,
        cause: version.cause,
        tags: deck.tags ?? [],
        ...(comPrint ? { comPrint } : {}),
      })
    })
  }
  return rows
}

// ─── Parties ───────────────────────────────────────────────────────────────
export const gameFromApi = (game) => ({
  id: game.id,
  date: game.played_on,
  turns: game.turns,
  bracket: game.bracket,
  bracketVariation: game.bracket_variation,
  boardWipes: game.board_wipes,
  winnerProtectedVictory: Boolean(game.winner_protected_victory),
  lastPlayer: game.last_player ?? '',
  lastSeatOrder: game.last_seat_order ?? undefined,
  winStyle: game.win_style ?? undefined,
  notes: game.notes ?? '',
  decks: (game.seats ?? []).map((seat) => ({
    // `deckId` désigne la VERSION jouée : c'est bien ce que contenait le JSON,
    // dont les identifiants de deck étaient déjà des identifiants de version.
    deckId: seat.deck_version_id ?? undefined,
    player: seat.player_name,
    seatOrder: seat.seat_order,
    result: seat.result,
    bracket: seat.bracket,
    bracketVariation: seat.bracket_variation,
    commanders: seat.commanders ?? [],
  })),
  wipeEvents: (game.wipe_events ?? []).map((e) => ({
    id: e.id, turn: e.turn, player: e.player,
    countered: e.countered, counteredBy: e.countered_by ?? undefined,
    protected: e.protected ?? [], partiallyProtected: e.partially_protected ?? [],
  })),
  manaEvents: (game.mana_events ?? []).map((e) => ({
    id: e.id, manaRule: e.mana_rule, turn: e.turn, manaByPlayer: e.mana_by_player ?? {},
  })),
  deathEvents: (game.death_events ?? []).map((e) => ({
    id: e.id, turn: e.turn, victims: e.victims ?? [],
    killer: e.killer ?? undefined, killStyle: e.kill_style ?? undefined,
  })),
})

export const gameToApi = (game, { userIdBySeat } = {}) => ({
  played_on: game.date,
  turns: game.turns ?? null,
  bracket: game.bracket ?? null,
  bracket_variation: game.bracketVariation ?? null,
  board_wipes: game.boardWipes ?? 0,
  winner_protected_victory: Boolean(game.winnerProtectedVictory),
  last_player: game.lastPlayer || null,
  last_seat_order: game.lastSeatOrder ?? null,
  win_style: game.winStyle || null,
  notes: game.notes || null,
  seats: (game.decks ?? []).map((seat) => ({
    seat_order: seat.seatOrder,
    deck_version_id: seat.deckId ?? null,
    user_id: userIdBySeat?.(seat) ?? seat.userId ?? null,
    player_name: seat.player,
    result: seat.result === 'win' ? 'win' : 'loss',
    bracket: seat.bracket ?? null,
    bracket_variation: seat.bracketVariation ?? null,
    commanders: seat.commanders ?? [],
  })),
  wipe_events: (game.wipeEvents ?? []).map((e) => ({
    turn: e.turn, player: e.player,
    countered: Boolean(e.countered), countered_by: e.counteredBy ?? null,
    protected: e.protected ?? [], partially_protected: e.partiallyProtected ?? [],
  })),
  mana_events: (game.manaEvents ?? []).map((e) => ({
    mana_rule: e.manaRule, turn: e.turn ?? null, mana_by_player: e.manaByPlayer ?? {},
  })),
  death_events: (game.deathEvents ?? []).map((e) => ({
    turn: e.turn, victims: e.victims ?? [],
    killer: e.killer ?? null, kill_style: e.killStyle ?? null,
  })),
})

/**
 * Une partie saisie dans le formulaire peut référencer un deck créé au même
 * moment, qui porte encore son identifiant local. Une fois les decks
 * enregistrés, on remplace ces identifiants provisoires par ceux rendus par
 * l'API — sans quoi la clé étrangère `game_seats.deck_version_id` refuserait
 * la partie.
 */
export function remapGameIds(game, createdDeckIds) {
  if (!createdDeckIds || createdDeckIds.size === 0) return game
  return {
    ...game,
    decks: (game.decks ?? []).map((seat) =>
      seat.deckId && createdDeckIds.has(seat.deckId)
        ? { ...seat, deckId: createdDeckIds.get(seat.deckId) }
        : seat,
    ),
  }
}

/**
 * Compare deux tableaux d'entités par identifiant et rend les trois listes
 * d'opérations. C'est ce qui permet de conserver l'écriture « tableau complet »
 * des composants tout en parlant à une API qui travaille par entité.
 */
export function diffById(previous, next) {
  const before = new Map((previous ?? []).map((item) => [item.id, item]))
  const after = new Map((next ?? []).map((item) => [item.id, item]))

  const created = []
  const updated = []
  const removed = []

  for (const [id, item] of after) {
    const old = before.get(id)
    if (!old) created.push(item)
    else if (JSON.stringify(old) !== JSON.stringify(item)) updated.push(item)
  }
  for (const [id, item] of before) {
    if (!after.has(id)) removed.push(item)
  }
  return { created, updated, removed }
}
