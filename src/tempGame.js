import { createGameId } from './gamesApi'
import { buildGameEventNotes } from './gameDetails'

export const TEMP_GAME_STORAGE_KEY = 'mtg_stats_temp_game'

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

export function loadTempGame() {
  try {
    const raw = sessionStorage.getItem(TEMP_GAME_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.id || !Array.isArray(parsed.players) || parsed.players.length !== 4) {
      return null
    }
    if (!Array.isArray(parsed.manaEvents)) parsed.manaEvents = []
    return parsed
  } catch {
    return null
  }
}

export function saveTempGame(tempGame) {
  if (!tempGame) {
    sessionStorage.removeItem(TEMP_GAME_STORAGE_KEY)
    return
  }
  sessionStorage.setItem(TEMP_GAME_STORAGE_KEY, JSON.stringify(tempGame))
}

export function clearTempGame() {
  sessionStorage.removeItem(TEMP_GAME_STORAGE_KEY)
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
