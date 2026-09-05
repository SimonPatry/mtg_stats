import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { installSessionStorage, games } from './helpers.js'

installSessionStorage()

const {
  formatWipeProtection, buildGameEventNotes, composeGameNotes,
  gameHasLiveDetails, buildGameTimeline, manaEventsByRule,
  winStyleLabel, formatManaByPlayer,
} = await import('../src/gameDetails.js')

const LIVE_GAME = {
  id: 'g',
  wipeEvents: [
    { turn: 5, player: 'Simon', countered: false, protected: ['Alex'] },
    { turn: 2, player: 'Alex', countered: true, counteredBy: 'Jordan' },
  ],
  manaEvents: [{ manaRule: 'T4', turn: 4, manaByPlayer: { Simon: 5, Alex: 4 } }],
  deathEvents: [{ turn: 6, victims: ['Jordan'], killer: 'Simon', killStyle: 'combat' }],
}

describe('protection lors d’un board wipe', () => {
  test('un wipe sans protection ni contre ne produit aucun texte', () => {
    assert.equal(formatWipeProtection({ countered: false }), '')
  })

  test('contre, protégés et partiellement protégés sont combinés', () => {
    const text = formatWipeProtection({
      countered: true, counteredBy: 'Jordan',
      protected: ['Alex'], partiallyProtected: ['Sam'],
    })
    assert.match(text, /Contré par Jordan/)
    assert.match(text, /Protégés : Alex/)
    assert.match(text, /Partiellement protégés : Sam/)
  })
})

describe('notes générées depuis les événements', () => {
  test('une ligne par événement, wipes puis mana puis morts', () => {
    const notes = buildGameEventNotes(LIVE_GAME).split('\n')
    assert.equal(notes.length, 4)
    assert.match(notes[0], /^Wipe tour 5 — Simon/)
    assert.match(notes[1], /^Wipe tour 2 — Alex — contré par Jordan/)
    assert.match(notes[2], /^Mana T4 — Simon 5, Alex 4/)
    assert.match(notes[3], /^Mort tour 6: Jordan — tueur: Simon/)
  })

  test('une partie sans événement ne produit aucune note', () => {
    assert.equal(buildGameEventNotes({ id: 'x' }), '')
  })

  test('composeGameNotes concatène le récapitulatif et les notes libres', () => {
    const out = composeGameNotes('Partie serrée.', LIVE_GAME)
    assert.match(out, /Wipe tour 5/)
    assert.match(out, /Partie serrée\./)
  })

  test('le récapitulatif n’est pas dupliqué s’il est déjà dans les notes', () => {
    const recap = buildGameEventNotes(LIVE_GAME)
    assert.equal(composeGameNotes(recap, LIVE_GAME), recap)
  })

  test('sans événement, seules les notes libres subsistent', () => {
    assert.equal(composeGameNotes('  Note libre  ', { id: 'x' }), 'Note libre')
  })
})

describe('détails live', () => {
  test('gameHasLiveDetails distingue une partie enrichie d’une partie nue', () => {
    assert.equal(gameHasLiveDetails(LIVE_GAME), true)
    assert.equal(gameHasLiveDetails({ id: 'x' }), false)
    assert.equal(gameHasLiveDetails({ id: 'x', winStyle: 'combo' }), true)
  })

  test('la frise est triée par tour, puis wipe → mana → mort', () => {
    const timeline = buildGameTimeline(LIVE_GAME)
    assert.deepEqual(timeline.map((e) => [e.turn, e.kind]), [
      [2, 'wipe'], [4, 'mana'], [5, 'wipe'], [6, 'death'],
    ])
  })

  test('un relevé de mana sans tour explicite est placé d’après sa règle', () => {
    const timeline = buildGameTimeline({ manaEvents: [{ manaRule: 'T5', manaByPlayer: {} }] })
    assert.equal(timeline[0].turn, 5)
  })

  test('manaEventsByRule sépare T4 et T5', () => {
    const { t4, t5 } = manaEventsByRule(LIVE_GAME)
    assert.equal(t4.length, 1)
    assert.equal(t5.length, 0)
  })

  test('formatManaByPlayer rend « — » sans donnée', () => {
    assert.equal(formatManaByPlayer(null), '—')
    assert.equal(formatManaByPlayer({ Simon: 5, Alex: 4 }), 'Simon: 5 · Alex: 4')
  })

  test('winStyleLabel rend l’identifiant s’il est inconnu', () => {
    assert.equal(winStyleLabel('inexistant'), 'inexistant')
  })
})

describe('sur le jeu de données de test', () => {
  test('aucune partie ne fait planter la construction des notes ni de la frise', () => {
    for (const game of games) {
      assert.equal(typeof buildGameEventNotes(game), 'string')
      assert.ok(Array.isArray(buildGameTimeline(game)))
    }
  })

  test('les frises sont toujours triées par tour croissant', () => {
    for (const game of games) {
      const turns = buildGameTimeline(game).map((e) => e.turn)
      assert.deepEqual(turns, [...turns].sort((a, b) => a - b), `partie ${game.id}`)
    }
  })
})
