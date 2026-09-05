import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { diffById, remapGameIds, decksFromApi, gameFromApi, gameToApi } from '../src/lib/adapters.js'

describe('diffById', () => {
  test('classe créations, modifications et suppressions', () => {
    const before = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }]
    const after = [{ id: 'a', n: 1 }, { id: 'b', n: 9 }, { id: 'c', n: 3 }]
    const { created, updated, removed } = diffById(before, after)
    assert.deepEqual(created.map((i) => i.id), ['c'])
    assert.deepEqual(updated.map((i) => i.id), ['b'])
    assert.deepEqual(removed.map((i) => i.id), [])
  })

  test('une entité inchangée ne produit aucun appel', () => {
    const same = [{ id: 'a', n: 1, sub: { x: 1 } }]
    const { created, updated, removed } = diffById(same, structuredClone(same))
    assert.deepEqual([created, updated, removed], [[], [], []])
  })

  test('un tableau absent vaut tableau vide', () => {
    assert.deepEqual(diffById(undefined, undefined), { created: [], updated: [], removed: [] })
    assert.deepEqual(diffById(null, [{ id: 'a' }]).created.length, 1)
  })
})

describe('remapGameIds', () => {
  // C'est le filet du formulaire de saisie : une partie peut référencer un
  // deck créé au même moment, qui porte encore son identifiant local. Sans
  // cette substitution, la clé étrangère `game_seats.deck_version_id` refuse.
  const game = {
    id: 'g1',
    decks: [
      { seatOrder: 1, player: 'Simon', deckId: 'local-1' },
      { seatOrder: 2, player: 'Alex', deckId: 'deja-en-base' },
      { seatOrder: 3, player: 'Sam' },
    ],
  }

  test('remplace les identifiants locaux par ceux rendus par l’API', () => {
    const out = remapGameIds(game, new Map([['local-1', 'uuid-serveur']]))
    assert.equal(out.decks[0].deckId, 'uuid-serveur')
    assert.equal(out.decks[1].deckId, 'deja-en-base')
    assert.equal(out.decks[2].deckId, undefined)
  })

  test('ne touche pas à la partie d’origine', () => {
    remapGameIds(game, new Map([['local-1', 'uuid-serveur']]))
    assert.equal(game.decks[0].deckId, 'local-1')
  })

  test('sans deck créé, la partie passe telle quelle', () => {
    assert.equal(remapGameIds(game, new Map()), game)
    assert.equal(remapGameIds(game, undefined), game)
  })
})

describe('decksFromApi', () => {
  const lineage = {
    id: 'L1', user_id: 'U1', active: true, created_on: '2026-01-01',
    commanders: [{ name: 'Thrasios' }, { name: 'Tymna' }],
    versions: [
      { id: 'V2', version_number: 2, bracket: 4, started_on: '2026-03-01', cause: 'newVersion' },
      { id: 'V1', version_number: 1, bracket: 3, started_on: '2026-01-01', cause: 'initial' },
    ],
  }

  test('une lignée devient une ligne par version, chaînée et ordonnée', () => {
    const rows = decksFromApi([lineage])
    assert.deepEqual(rows.map((r) => r.id), ['V1', 'V2'])
    assert.equal(rows[0].previousDeckId, undefined)
    assert.equal(rows[1].previousDeckId, 'V1')
  })

  test('seule la dernière version est active', () => {
    const rows = decksFromApi([lineage])
    assert.deepEqual(rows.map((r) => r.active), [false, true])
  })

  test('les partenaires restent une liste, un commandant seul une chaîne', () => {
    const [row] = decksFromApi([lineage])
    assert.deepEqual(row.com, ['Thrasios', 'Tymna'])
    const solo = decksFromApi([{ ...lineage, commanders: [{ name: 'Krenko' }] }])
    assert.equal(solo[0].com, 'Krenko')
  })

  test('une lignée désactivée n’a aucune ligne active', () => {
    const rows = decksFromApi([{ ...lineage, active: false }])
    assert.ok(rows.every((r) => r.active === false))
  })
})

describe('aller-retour d’une partie', () => {
  const apiGame = {
    id: 'g1', played_on: '2026-05-01', turns: 9, bracket: 3, bracket_variation: 'high',
    board_wipes: 2, winner_protected_victory: 1, last_player: 'Sam', last_seat_order: 3,
    win_style: 'combat', notes: 'note',
    seats: [
      { seat_order: 1, deck_version_id: 'V1', player_name: 'Simon', result: 'win',
        bracket: 3, bracket_variation: null, commanders: ['Atraxa'] },
      { seat_order: 2, deck_version_id: null, player_name: 'Alex', result: 'loss',
        bracket: null, bracket_variation: null, commanders: [] },
    ],
    wipe_events: [{ id: 'w1', turn: 4, player: 'Sam', countered: 0, countered_by: null,
      protected: ['Simon'], partially_partial: [], partially_protected: [] }],
    mana_events: [{ id: 'm1', mana_rule: 'T4', turn: 4, mana_by_player: { Simon: 5 } }],
    death_events: [{ id: 'd1', turn: 6, victims: ['Alex'], killer: 'Simon', kill_style: 'combat' }],
  }

  test('la forme historique se reconstitue sans perte', () => {
    const legacy = gameFromApi(apiGame)
    assert.equal(legacy.date, '2026-05-01')
    assert.equal(legacy.winnerProtectedVictory, true)
    assert.equal(legacy.decks[0].deckId, 'V1')
    assert.equal(legacy.decks[1].deckId, undefined)
    assert.equal(legacy.manaEvents[0].manaRule, 'T4')
  })

  test('et retraverse vers l’API à l’identique', () => {
    const back = gameToApi(gameFromApi(apiGame))
    assert.equal(back.played_on, apiGame.played_on)
    assert.equal(back.winner_protected_victory, true)
    assert.equal(back.last_seat_order, 3)
    assert.deepEqual(back.seats.map((s) => s.deck_version_id), ['V1', null])
    assert.deepEqual(back.seats.map((s) => s.result), ['win', 'loss'])
    assert.equal(back.mana_events[0].mana_by_player.Simon, 5)
    assert.equal(back.death_events[0].kill_style, 'combat')
  })

  test('le nom du joueur peut se résoudre en identifiant', () => {
    const back = gameToApi(gameFromApi(apiGame), {
      userIdBySeat: (seat) => (seat.player === 'Simon' ? 'U-simon' : null),
    })
    assert.deepEqual(back.seats.map((s) => s.user_id), ['U-simon', null])
  })
})
