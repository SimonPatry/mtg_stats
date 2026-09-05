import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { installSessionStorage } from './helpers.js'

// tempGame lit sessionStorage dès l'import de certaines fonctions : on l'installe avant.
installSessionStorage()

const {
  createTempGame, playerNames, isPlayerAlive, livingPlayers, emptyPlayerMap,
  addWipeEvent, addManaEvent, addDeathEvent, turnFromManaRule,
  tempGameToAddGameInitial, mergeTempGameIntoFinalGame,
  saveLiveGamesStore, loadLiveGamesStore, listTempGames, removeTempGameFromStore,
  saveTempGame, loadTempGame, clearTempGame, tempGameSummary,
  KILL_STYLES, WIN_STYLES, styleLabel,
} = await import('../src/tempGame.js')

const PLAYERS = [
  { seatOrder: 2, userId: 'u2', player: 'Alex' },
  { seatOrder: 1, userId: 'u1', player: ' Simon ' },
  { seatOrder: 3, userId: 'u3', player: 'Jordan' },
]

describe('création d’une partie en direct', () => {
  test('les joueurs sont triés par siège et les noms nettoyés', () => {
    const g = createTempGame(PLAYERS)
    assert.deepEqual(g.players.map((p) => p.seatOrder), [1, 2, 3])
    assert.deepEqual(playerNames(g), ['Simon', 'Alex', 'Jordan'])
  })

  test('une partie neuve démarre au tour 1, sans aucun événement', () => {
    const g = createTempGame(PLAYERS)
    assert.equal(g.currentTurn, 1)
    assert.deepEqual(g.wipeEvents, [])
    assert.deepEqual(g.manaEvents, [])
    assert.deepEqual(g.deathEvents, [])
    assert.ok(g.id)
    assert.ok(g.createdAt)
  })

  test('emptyPlayerMap produit une entrée par joueur', () => {
    const g = createTempGame(PLAYERS)
    assert.deepEqual(emptyPlayerMap(g), { Simon: 0, Alex: 0, Jordan: 0 })
    assert.deepEqual(emptyPlayerMap(g, null).Simon, null)
  })
})

describe('événements', () => {
  test('les ajouts ne mutent pas la partie et posent un identifiant', () => {
    const g = createTempGame(PLAYERS)
    const withWipe = addWipeEvent(g, { player: 'Simon', turn: 3 })
    assert.equal(g.wipeEvents.length, 0, 'la partie source a été mutée')
    assert.equal(withWipe.wipeEvents.length, 1)
    assert.ok(withWipe.wipeEvents[0].id)
    assert.equal(withWipe.wipeEvents[0].player, 'Simon')
  })

  test('le tour d’un relevé de mana est déduit de la règle T4/T5', () => {
    assert.equal(turnFromManaRule('T4'), 4)
    assert.equal(turnFromManaRule('T5'), 5)
    assert.equal(turnFromManaRule('autre'), null)

    const g = createTempGame(PLAYERS)
    const withMana = addManaEvent(g, { manaRule: 'T5', manaByPlayer: { Simon: 6 } })
    assert.equal(withMana.manaEvents[0].turn, 5)
  })

  test('sans règle connue, le tour fourni est conservé', () => {
    const g = createTempGame(PLAYERS)
    const withMana = addManaEvent(g, { manaRule: 'X', turn: 9, manaByPlayer: {} })
    assert.equal(withMana.manaEvents[0].turn, 9)
  })

  test('un joueur mort n’est plus vivant, et disparaît des joueurs en vie', () => {
    let g = createTempGame(PLAYERS)
    assert.equal(isPlayerAlive(g, 'Alex'), true)
    g = addDeathEvent(g, { turn: 4, victims: ['Alex'], killer: 'Simon' })
    assert.equal(isPlayerAlive(g, 'Alex'), false)
    assert.deepEqual(livingPlayers(g).map((p) => p.player), ['Simon', 'Jordan'])
  })

  test('un même événement peut tuer plusieurs joueurs', () => {
    let g = createTempGame(PLAYERS)
    g = addDeathEvent(g, { turn: 6, victims: ['Alex', 'Jordan'], killer: 'Simon' })
    assert.deepEqual(livingPlayers(g).map((p) => p.player), ['Simon'])
  })
})

describe('passage de la partie en direct au formulaire de saisie', () => {
  test('le brouillon reprend l’identifiant, les sièges et les événements', () => {
    let g = createTempGame(PLAYERS)
    g = addWipeEvent(g, { player: 'Simon', turn: 3 })
    g = addDeathEvent(g, { turn: 5, victims: ['Jordan'], killer: 'Alex' })
    g = { ...g, currentTurn: 7 }

    const initial = tempGameToAddGameInitial(g)
    assert.equal(initial.gameId, g.id)
    assert.equal(initial.turns, '7')
    assert.equal(initial.boardWipes, 1)
    assert.equal(initial.formDecks.length, 3)
    assert.deepEqual(initial.formDecks.map((d) => d.seatOrder), [1, 2, 3])
    assert.ok(initial.formDecks.every((d) => d.result === null))
    assert.equal(initial.deathEvents.length, 1)
    assert.match(initial.date, /^\d{4}-\d{2}-\d{2}$/)
  })

  test('la fusion n’attache que les listes non vides', () => {
    const g = createTempGame(PLAYERS)
    const merged = mergeTempGameIntoFinalGame(g, { id: 'x' })
    assert.equal(merged.wipeEvents, undefined)
    assert.equal(merged.deathEvents, undefined)

    const withWipe = addWipeEvent(g, { player: 'Simon', turn: 2 })
    const merged2 = mergeTempGameIntoFinalGame(withWipe, { id: 'x' })
    assert.equal(merged2.wipeEvents.length, 1)
  })

  test('sans partie en direct, la partie finale est rendue telle quelle', () => {
    const game = { id: 'x', turns: 5 }
    assert.deepEqual(mergeTempGameIntoFinalGame(null, game), game)
  })
})

describe('persistance en sessionStorage', () => {
  before(() => { globalThis.sessionStorage.clear() })

  test('une partie enregistrée est relue à l’identique', () => {
    const g = createTempGame(PLAYERS)
    saveTempGame(g)
    const loaded = loadTempGame()
    assert.equal(loaded.id, g.id)
    assert.deepEqual(playerNames(loaded), playerNames(g))
  })

  test('clearTempGame vide le stockage', () => {
    saveTempGame(createTempGame(PLAYERS))
    clearTempGame()
    assert.equal(loadTempGame(), null)
  })

  test('plusieurs parties peuvent coexister et être retirées une à une', () => {
    const a = createTempGame(PLAYERS)
    const b = createTempGame(PLAYERS)
    saveLiveGamesStore({ games: { [a.id]: a, [b.id]: b }, activeId: a.id })
    assert.equal(listTempGames(loadLiveGamesStore()).length, 2)

    const store = removeTempGameFromStore(loadLiveGamesStore(), a.id)
    assert.equal(listTempGames(store).length, 1)
    assert.equal(listTempGames(store)[0].id, b.id)
  })

  test('tempGameSummary décrit une partie sans planter sur une partie vide', () => {
    const g = createTempGame(PLAYERS)
    const summary = tempGameSummary(g)
    assert.ok(summary)
    assert.equal(typeof summary, 'object')
  })
})

describe('libellés de styles', () => {
  test('les catalogues de styles ne sont pas vides et ont id + label', () => {
    for (const list of [KILL_STYLES, WIN_STYLES]) {
      assert.ok(list.length > 0)
      assert.ok(list.every((s) => s.id && s.label))
    }
  })

  test('styleLabel rend le libellé, ou l’identifiant s’il est inconnu', () => {
    assert.equal(styleLabel(KILL_STYLES[0].id), KILL_STYLES[0].label)
    assert.equal(styleLabel('inexistant'), 'inexistant')
  })
})
