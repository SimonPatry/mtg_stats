import { createGameId } from './gamesApi'
import { buildGameEventNotes } from './gameDetails'

export const TEMP_GAME_STORAGE_KEY = 'mtg_stats_temp_game'
export const LIVE_GAMES_STORAGE_KEY = 'mtg_stats_live_games'

const EMPTY_LIVE_STORE = { activeId: null, games: {} }

export function normalizeTempGame(raw) {
  if (!raw?.id || !Array.isArray(raw.players) || raw.players.length !== 4) {
    return null
  }
  return {
    ...raw,
    wipeEvents: raw.wipeEvents ?? [],
    manaEvents: raw.manaEvents ?? [],
    deathEvents: raw.deathEvents ?? [],
  }
}

function normalizeLiveStore(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_LIVE_STORE }
  const games = {}
  for (const [id, game] of Object.entries(raw.games ?? {})) {
    const normalized = normalizeTempGame(game)
    if (normalized) games[id] = normalized
  }
  const activeId = raw.activeId && games[raw.activeId] ? raw.activeId : null
  return { activeId, games }
}

export function loadLiveGamesStore() {
  try {
    const raw = sessionStorage.getItem(LIVE_GAMES_STORAGE_KEY)
    if (raw) return normalizeLiveStore(JSON.parse(raw))

    const legacyRaw = sessionStorage.getItem(TEMP_GAME_STORAGE_KEY)
    if (legacyRaw) {
      const game = normalizeTempGame(JSON.parse(legacyRaw))
      if (game) {
        const store = { activeId: game.id, games: { [game.id]: game } }
        saveLiveGamesStore(store)
        sessionStorage.removeItem(TEMP_GAME_STORAGE_KEY)
        return store
      }
    }
    return { ...EMPTY_LIVE_STORE }
  } catch {
    return { ...EMPTY_LIVE_STORE }
  }
}

export function saveLiveGamesStore(store) {
  const normalized = normalizeLiveStore(store)
  if (Object.keys(normalized.games).length === 0) {
    sessionStorage.removeItem(LIVE_GAMES_STORAGE_KEY)
    return
  }
  sessionStorage.setItem(LIVE_GAMES_STORAGE_KEY, JSON.stringify(normalized))
}

export function listTempGames(store) {
  return Object.values(store.games).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function tempGameSummary(game) {
  return {
    playerNames: game.players.map((p) => p.player),
    turn: game.currentTurn || 1,
    wipeCount: game.wipeEvents.length,
    manaCount: game.manaEvents?.length ?? 0,
    deathCount: game.deathEvents.length,
    createdAt: game.createdAt,
  }
}

export function removeTempGameFromStore(store, id) {
  const games = { ...store.games }
  delete games[id]
  return {
    activeId: store.activeId === id ? null : store.activeId,
    games,
  }
}

/** @deprecated Utiliser loadLiveGamesStore */
export function loadTempGame() {
  const store = loadLiveGamesStore()
  return store.activeId ? store.games[store.activeId] ?? null : null
}

/** @deprecated Utiliser saveLiveGamesStore */
export function saveTempGame(tempGame) {
  if (!tempGame) {
    sessionStorage.removeItem(LIVE_GAMES_STORAGE_KEY)
    sessionStorage.removeItem(TEMP_GAME_STORAGE_KEY)
    return
  }
  const store = loadLiveGamesStore()
  saveLiveGamesStore({
    activeId: tempGame.id,
    games: { ...store.games, [tempGame.id]: tempGame },
  })
}

/** @deprecated Utiliser removeTempGameFromStore */
export function clearTempGame() {
  sessionStorage.removeItem(LIVE_GAMES_STORAGE_KEY)
  sessionStorage.removeItem(TEMP_GAME_STORAGE_KEY)
}

export const KILL_STYLES = [
  { id: 'combat', label: 'Dégâts de combat' },
  { id: 'nonCombat', label: 'Dégâts non-combat' },
  { id: 'commander', label: 'Dégâts de commandant' },
  { id: 'poison', label: 'Poison' },
  { id: 'mill', label: 'Mill' },
  { id: 'other', label: 'Autre' },
]

export const WIN_STYLES = [
  { id: 'combat', label: 'Dégâts de combat' },
  { id: 'nonCombat', label: 'Dégâts non-combat' },
  { id: 'commander', label: 'Dégâts de commandant' },
  { id: 'combo', label: 'Combo' },
  { id: 'mill', label: 'Mill' },
  { id: 'other', label: 'Autre' },
]

export function styleLabel(id, styles = KILL_STYLES) {
  return styles.find((s) => s.id === id)?.label ?? id
}

export function createTempGame(players) {
  const sorted = [...players].sort((a, b) => a.seatOrder - b.seatOrder)
  return {
    id: createGameId(),
    createdAt: new Date().toISOString(),
    currentTurn: 1,
    players: sorted.map((p) => ({
      seatOrder: p.seatOrder,
      userId: p.userId,
      player: p.player.trim(),
    })),
    wipeEvents: [],
    manaEvents: [],
    deathEvents: [],
  }
}

export function playerNames(tempGame) {
  return tempGame.players.map((p) => p.player)
}

export function isPlayerAlive(tempGame, name) {
  const dead = new Set()
  for (const event of tempGame.deathEvents) {
    for (const victim of event.victims) dead.add(victim)
  }
  return !dead.has(name)
}

export function livingPlayers(tempGame) {
  return tempGame.players.filter((p) => isPlayerAlive(tempGame, p.player))
}

export function emptyPlayerMap(tempGame, defaultValue = 0) {
  return Object.fromEntries(tempGame.players.map((p) => [p.player, defaultValue]))
}

export function addWipeEvent(tempGame, event) {
  return {
    ...tempGame,
    wipeEvents: [...tempGame.wipeEvents, { id: createGameId(), ...event }],
  }
}

export function turnFromManaRule(manaRule) {
  if (manaRule === 'T4') return 4
  if (manaRule === 'T5') return 5
  return null
}

export function addManaEvent(tempGame, event) {
  const turn = turnFromManaRule(event.manaRule) ?? event.turn ?? null
  return {
    ...tempGame,
    manaEvents: [
      ...(tempGame.manaEvents ?? []),
      { id: createGameId(), ...event, turn },
    ],
  }
}

export function addDeathEvent(tempGame, event) {
  return {
    ...tempGame,
    deathEvents: [...tempGame.deathEvents, { id: createGameId(), ...event }],
  }
}

export function tempGameEventsToNotes(tempGame) {
  return buildGameEventNotes(tempGame)
}

/** Pré-remplit AddGameForm à partir d'une temp game. */
export function tempGameToAddGameInitial(tempGame) {
  const today = new Date().toISOString().slice(0, 10)
  return {
    gameId: tempGame.id,
    date: today,
    turns: String(tempGame.currentTurn || ''),
    boardWipes: tempGame.wipeEvents.length,
    notes: tempGameEventsToNotes(tempGame),
    formDecks: tempGame.players.map((p) => ({
      userId: p.userId,
      deckId: '',
      player: p.player,
      seatOrder: p.seatOrder,
      result: null,
    })),
    wipeEvents: tempGame.wipeEvents,
    manaEvents: tempGame.manaEvents ?? [],
    deathEvents: tempGame.deathEvents,
  }
}

/** Fusionne les données live dans le game final. */
export function mergeTempGameIntoFinalGame(tempGame, game) {
  if (!tempGame) return game
  return {
    ...game,
    wipeEvents: tempGame.wipeEvents?.length ? tempGame.wipeEvents : undefined,
    manaEvents: tempGame.manaEvents?.length ? tempGame.manaEvents : undefined,
    deathEvents: tempGame.deathEvents?.length ? tempGame.deathEvents : undefined,
  }
}
