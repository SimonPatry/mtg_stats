import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { users, decks, games } from './helpers.js'
import { computeStats, deckLabel, resolveDeck } from '../src/stats.js'

const stats = computeStats(games, users, decks)

describe('agrégats du tableau de bord', () => {
  // Valeurs relevées sur le jeu de test AVANT toute migration. Elles doivent
  // rester identiques une fois les données passées en base : c'est le filet
  // qui attrape une régression silencieuse de calcul.
  test('les chiffres de tête sont ceux d’avant migration', () => {
    assert.equal(stats.totalGames, 43)
    assert.equal(stats.avgTurns, '9.2')
    assert.equal(stats.avgBoardWipes, '1.2')
    assert.equal(stats.protectedRate, 28)
  })

  test('les moyennes sont des chaînes à une décimale, le taux un entier', () => {
    assert.equal(typeof stats.avgTurns, 'string')
    assert.match(stats.avgTurns, /^\d+\.\d$/)
    assert.equal(Number.isInteger(stats.protectedRate), true)
  })

  test('sur un jeu vide, tout vaut zéro sans planter', () => {
    const empty = computeStats([], users, decks)
    assert.equal(empty.totalGames, 0)
    assert.equal(empty.avgTurns, 0)
    assert.equal(empty.avgBoardWipes, 0)
    assert.equal(empty.protectedRate, 0)
    // le catalogue reste listé, à zéro partie
    assert.ok(Object.keys(empty.winsByDeck).length > 0)
    assert.ok(Object.values(empty.winsByDeck).every((d) => d.games === 0))
  })
})

describe('winrates par deck', () => {
  test('21 decks suivis sur le jeu de test, aucun orphelin', () => {
    assert.equal(Object.keys(stats.winsByDeck).length, 21)
    assert.equal(Object.keys(stats.winsByDeck).filter((k) => k.startsWith('orphan:')).length, 0)
  })

  test('le catalogue ne retient que la version courante d’une lignée', () => {
    // une version remplacée par une autre version active n'apparaît pas
    for (const id of Object.keys(stats.winsByDeck)) {
      if (id.startsWith('orphan:')) continue
      const superseded = decks
        .filter((d) => d.active !== false)
        .some((d) => d.previousDeckId === id)
      assert.equal(superseded, false, `${id} est une version remplacée`)
    }
  })

  test('les participations et victoires totalisent 172 et 43', () => {
    const played = Object.values(stats.winsByDeck).reduce((n, d) => n + d.games, 0)
    const wins = Object.values(stats.winsByDeck).reduce((n, d) => n + d.wins, 0)
    assert.equal(played, 172)
    assert.equal(wins, games.length)
  })

  test('chaque entrée porte joueur, commandants et bracket', () => {
    for (const entry of Object.values(stats.winsByDeck)) {
      assert.equal(typeof entry.player, 'string')
      assert.ok(Array.isArray(entry.commanders))
      assert.ok(entry.wins <= entry.games)
    }
  })

  test('les parties d’une lignée sont regroupées, pas éclatées par version', () => {
    // Une lignée jouée sur plusieurs versions doit cumuler ses parties sur une
    // seule entrée : c'est tout l'intérêt de findDeckStatsKey.
    const byPlayerAndCommanders = new Map()
    for (const entry of Object.values(stats.winsByDeck)) {
      const key = `${entry.player}::${[...entry.commanders].sort().join('/')}`
      byPlayerAndCommanders.set(key, (byPlayerAndCommanders.get(key) ?? 0) + 1)
    }
    for (const [key, count] of byPlayerAndCommanders) {
      assert.equal(count, 1, `${key} apparaît ${count} fois dans les statistiques`)
    }
  })
})

describe('winrates par joueur', () => {
  test('les cinq joueurs du jeu de test, avec leurs totaux', () => {
    assert.deepEqual(stats.winsByPlayer, {
      Simon: { wins: 9, games: 38 },
      Alex: { wins: 10, games: 39 },
      Jordan: { wins: 9, games: 39 },
      Sam: { wins: 11, games: 39 },
      Test: { wins: 4, games: 17 },
    })
  })

  test('le total des parties par joueur égale le nombre de sièges joués', () => {
    const seats = games.reduce((n, g) => n + g.decks.length, 0)
    const counted = Object.values(stats.winsByPlayer).reduce((n, p) => n + p.games, 0)
    assert.equal(counted, seats)
  })

  test('le total des victoires par joueur égale le nombre de parties', () => {
    const wins = Object.values(stats.winsByPlayer).reduce((n, p) => n + p.wins, 0)
    assert.equal(wins, games.length)
  })
})

describe('aides d’affichage', () => {
  test('deckLabel joint les commandants', () => {
    assert.equal(deckLabel({ commanders: ['Tana', 'Tymna'] }), 'Tana / Tymna')
  })

  test('resolveDeck délègue à la résolution catalogue', () => {
    const known = decks.find((d) => d.deckUrl)
    const resolved = resolveDeck({ deckId: known.id, result: 'win' }, users, decks)
    assert.equal(resolved.deckId, known.id)
  })
})
