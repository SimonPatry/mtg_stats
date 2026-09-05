import { randomUUID } from 'node:crypto'

/**
 * Lecture et écriture des parties.
 *
 * Une partie est un agrégat : ses sièges et ses événements n'existent pas sans
 * elle. Les écritures passent donc toujours par une transaction, et les
 * collections sont réécrites en bloc plutôt que réconciliées ligne à ligne —
 * plus simple, et sans état intermédiaire incohérent.
 */

const parseJson = (value, fallback) => {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

function shapeGame(row, seats, events) {
  return {
    id: row.id,
    played_on: row.played_on,
    turns: row.turns,
    bracket: row.bracket,
    bracket_variation: row.bracket_variation,
    board_wipes: Number(row.board_wipes),
    winner_protected_victory: Boolean(row.winner_protected_victory),
    last_player: row.last_player,
    last_seat_order: row.last_seat_order,
    win_style: row.win_style,
    notes: row.notes,
    seats,
    ...events,
  }
}

async function readSeats(cx, gameIds) {
  if (gameIds.length === 0) return new Map()
  const [rows] = await cx.query(`
    SELECT s.*, d.id AS deck_id, d.name AS deck_name, v.version_number,
           (SELECT GROUP_CONCAT(c.name ORDER BY c.position SEPARATOR '|~|')
              FROM deck_commanders c WHERE c.deck_id = d.id) AS deck_commanders
      FROM game_seats s
      LEFT JOIN deck_versions v ON v.id = s.deck_version_id
      LEFT JOIN decks d ON d.id = v.deck_id
     WHERE s.game_id IN (?)
     ORDER BY s.game_id, s.seat_order`, [gameIds])

  const byGame = new Map()
  for (const row of rows) {
    const seat = {
      id: row.id,
      seat_order: row.seat_order,
      deck_version_id: row.deck_version_id,
      deck_id: row.deck_id ?? null,
      deck_name: row.deck_name ?? '',
      version_number: row.version_number ?? null,
      user_id: row.user_id,
      player_name: row.player_name,
      result: row.result,
      bracket: row.bracket,
      bracket_variation: row.bracket_variation,
      // Photographie prise le jour de la partie : c'est elle qui fait foi à
      // l'affichage, pas l'état actuel du deck.
      commanders: parseJson(row.commanders, []),
    }
    if (!byGame.has(row.game_id)) byGame.set(row.game_id, [])
    byGame.get(row.game_id).push(seat)
  }
  return byGame
}

async function readEvents(cx, gameIds) {
  const empty = () => ({ wipe_events: [], mana_events: [], death_events: [] })
  if (gameIds.length === 0) return new Map()

  const byGame = new Map(gameIds.map((id) => [id, empty()]))

  const [wipes] = await cx.query(
    'SELECT * FROM game_wipe_events WHERE game_id IN (?) ORDER BY turn, id', [gameIds])
  for (const row of wipes) {
    byGame.get(row.game_id)?.wipe_events.push({
      id: row.id, turn: row.turn, player: row.player,
      countered: Boolean(row.countered), countered_by: row.countered_by,
      protected: parseJson(row.protected, []),
      partially_protected: parseJson(row.partially_protected, []),
    })
  }

  const [manas] = await cx.query(
    'SELECT * FROM game_mana_events WHERE game_id IN (?) ORDER BY turn, id', [gameIds])
  for (const row of manas) {
    byGame.get(row.game_id)?.mana_events.push({
      id: row.id, mana_rule: row.mana_rule, turn: row.turn,
      mana_by_player: parseJson(row.mana_by_player, {}),
    })
  }

  const [deaths] = await cx.query(
    'SELECT * FROM game_death_events WHERE game_id IN (?) ORDER BY turn, id', [gameIds])
  for (const row of deaths) {
    byGame.get(row.game_id)?.death_events.push({
      id: row.id, turn: row.turn, victims: parseJson(row.victims, []),
      killer: row.killer, kill_style: row.kill_style,
    })
  }

  return byGame
}

export async function listGames(cx, { limit = 500 } = {}) {
  const [rows] = await cx.query(
    'SELECT * FROM games ORDER BY played_on DESC, created_at DESC LIMIT ?', [limit])
  const ids = rows.map((r) => r.id)
  const [seats, events] = await Promise.all([readSeats(cx, ids), readEvents(cx, ids)])
  return rows.map((row) => shapeGame(row, seats.get(row.id) ?? [], events.get(row.id) ?? {
    wipe_events: [], mana_events: [], death_events: [],
  }))
}

export async function getGame(cx, id) {
  const [rows] = await cx.query('SELECT * FROM games WHERE id = ?', [id])
  if (rows.length === 0) return null
  const [seats, events] = await Promise.all([readSeats(cx, [id]), readEvents(cx, [id])])
  return shapeGame(rows[0], seats.get(id) ?? [], events.get(id))
}

async function writeChildren(cx, gameId, input) {
  await cx.execute('DELETE FROM game_seats WHERE game_id = ?', [gameId])
  for (const seat of input.seats) {
    await cx.execute(
      `INSERT INTO game_seats (id, game_id, seat_order, deck_version_id, user_id,
                               player_name, result, bracket, bracket_variation, commanders)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), gameId, seat.seat_order, seat.deck_version_id, seat.user_id,
       seat.player_name, seat.result, seat.bracket, seat.bracket_variation,
       JSON.stringify(seat.commanders ?? [])])
  }

  for (const table of ['game_wipe_events', 'game_mana_events', 'game_death_events']) {
    await cx.execute(`DELETE FROM ${table} WHERE game_id = ?`, [gameId])
  }
  for (const e of input.wipe_events ?? []) {
    await cx.execute(
      `INSERT INTO game_wipe_events (id, game_id, turn, player, countered, countered_by,
                                     protected, partially_protected)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), gameId, e.turn, e.player, e.countered, e.countered_by,
       JSON.stringify(e.protected ?? []), JSON.stringify(e.partially_protected ?? [])])
  }
  for (const e of input.mana_events ?? []) {
    await cx.execute(
      `INSERT INTO game_mana_events (id, game_id, mana_rule, turn, mana_by_player)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), gameId, e.mana_rule, e.turn, JSON.stringify(e.mana_by_player ?? {})])
  }
  for (const e of input.death_events ?? []) {
    await cx.execute(
      `INSERT INTO game_death_events (id, game_id, turn, victims, killer, kill_style)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), gameId, e.turn, JSON.stringify(e.victims ?? []), e.killer, e.kill_style])
  }
}

const GAME_COLUMNS = (input) => [
  input.played_on, input.turns, input.bracket, input.bracket_variation,
  input.board_wipes, input.winner_protected_victory, input.last_player,
  input.last_seat_order, input.win_style, input.notes,
]

export async function createGame(cx, input) {
  const id = randomUUID()
  await cx.execute(
    `INSERT INTO games (id, played_on, turns, bracket, bracket_variation, board_wipes,
                        winner_protected_victory, last_player, last_seat_order, win_style, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ...GAME_COLUMNS(input)])
  await writeChildren(cx, id, input)
  return id
}

export async function updateGame(cx, id, input) {
  const [result] = await cx.execute(
    `UPDATE games SET played_on = ?, turns = ?, bracket = ?, bracket_variation = ?,
                      board_wipes = ?, winner_protected_victory = ?, last_player = ?,
                      last_seat_order = ?, win_style = ?, notes = ?
      WHERE id = ?`,
    [...GAME_COLUMNS(input), id])
  if (result.affectedRows === 0) return false
  await writeChildren(cx, id, input)
  return true
}

export async function deleteGame(cx, id) {
  const [result] = await cx.execute('DELETE FROM games WHERE id = ?', [id])
  return result.affectedRows > 0
}
