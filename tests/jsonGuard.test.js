import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { users, decks, games } from './helpers.js'
import {
  parseJsonText, tryParseJsonText,
  validateGamesEdit, validateUsersEdit, validateDecksEdit,
  validateNewGameDraft, validateCatalogEdits,
} from '../src/jsonGuard.js'

const clone = (x) => JSON.parse(JSON.stringify(x))

describe('lecture de JSON saisi à la main', () => {
  test('parseJsonText rejette un JSON invalide avec un message parlant', () => {
    assert.throws(() => parseJsonText('{oops', 'Parties'), /Parties/)
  })

  test('tryParseJsonText ne lève pas et signale l’échec', () => {
    const ok = tryParseJsonText('[1,2]')
    const ko = tryParseJsonText('{oops')
    // La fonction ne rend pas la valeur parsée, seulement le verdict.
    assert.deepEqual(ok, { ok: true, error: null })
    assert.equal(ko.ok, false)
    assert.match(ko.error, /syntaxe invalide/)
  })
})

describe('garde-fous sur les parties', () => {
  test('le jeu de test est accepté tel quel', () => {
    assert.doesNotThrow(() => validateGamesEdit(games, clone(games)))
  })

  test('une partie ne peut pas disparaître', () => {
    const after = clone(games).slice(1)
    assert.throws(() => validateGamesEdit(games, after))
  })

  test('un deckId existant ne peut pas être retiré d’une partie', () => {
    const after = clone(games)
    const target = after.find((g) => g.decks.some((d) => d.deckId))
    target.decks = target.decks.filter((d) => !d.deckId)
    assert.throws(() => validateGamesEdit(games, after), /deckId/)
  })

  test('une partie ne peut pas dépasser 5 decks', () => {
    const after = clone(games)
    while (after[0].decks.length <= 5) {
      after[0].decks.push({ player: 'Invité', seatOrder: after[0].decks.length + 1, result: 'loss' })
    }
    assert.throws(() => validateGamesEdit(games, after), /entre 2 et 5/)
  })

  test('retirer un deck identifié est refusé avant même le compte de sièges', () => {
    const after = clone(games)
    after[0].decks = after[0].decks.slice(0, 1)
    assert.throws(() => validateGamesEdit(games, after), /deckId/)
  })

  test('un tableau est exigé', () => {
    assert.throws(() => validateGamesEdit(games, { pas: 'un tableau' }), /tableau/)
  })
})

describe('garde-fous sur les joueurs et les decks', () => {
  test('le catalogue de test est accepté', () => {
    assert.doesNotThrow(() => validateUsersEdit(users, clone(users)))
    assert.doesNotThrow(() => validateDecksEdit(decks, clone(decks)))
  })

  test('un joueur ne peut pas être supprimé', () => {
    assert.throws(() => validateUsersEdit(users, clone(users).slice(1)))
  })

  test('un deck ne peut pas changer de propriétaire', () => {
    const after = clone(decks)
    after[0].userId = 'un-autre-joueur'
    assert.throws(() => validateDecksEdit(decks, after), /userId/)
  })

  test('le chaînage des versions ne peut pas être réécrit', () => {
    const after = clone(decks)
    const versioned = after.find((d) => d.previousDeckId)
    versioned.previousDeckId = 'autre-chose'
    assert.throws(() => validateDecksEdit(decks, after), /previousDeckId/)
  })

  test('validateCatalogEdits applique les deux garde-fous', () => {
    assert.doesNotThrow(() =>
      validateCatalogEdits({
        usersBefore: users, usersAfter: clone(users),
        decksBefore: decks, decksAfter: clone(decks),
      }))
  })
})

describe('brouillon de nouvelle partie', () => {
  const draft = {
    id: 'nouvelle',
    date: '2026-03-01',
    decks: [
      { player: 'Simon', seatOrder: 1, result: 'win' },
      { player: 'Alex', seatOrder: 2, result: 'loss' },
    ],
  }

  test('un brouillon complet est accepté', () => {
    assert.doesNotThrow(() => validateNewGameDraft('nouvelle', clone(draft)))
  })

  test('l’identifiant ne peut pas être modifié', () => {
    assert.throws(() => validateNewGameDraft('nouvelle', { ...clone(draft), id: 'autre' }), /id/)
  })

  test('un gagnant est obligatoire', () => {
    const sansGagnant = clone(draft)
    sansGagnant.decks.forEach((d) => { d.result = 'loss' })
    assert.throws(() => validateNewGameDraft('nouvelle', sansGagnant), /gagnant/)
  })

  test('la date est obligatoire', () => {
    const sansDate = clone(draft)
    delete sansDate.date
    assert.throws(() => validateNewGameDraft('nouvelle', sansDate))
  })
})
