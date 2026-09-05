import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { installSessionStorage, users, decks, games } from './helpers.js'

installSessionStorage()

const { buildGamesExport } = await import('../src/exportGames.js')

// C'est la charge utile commune à l'export JSON et à l'export Excel : elle doit
// survivre au passage en base de données sans changer de forme.
const payload = buildGamesExport(games, users, decks)

describe('charge utile de l’export', () => {
  test('en-tête : horodatage et nombre de parties', () => {
    assert.match(payload.exportedAt, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(payload.gameCount, games.length)
    assert.equal(payload.games.length, games.length)
  })

  test('aucun identifiant technique ne fuit dans l’export', () => {
    const json = JSON.stringify(payload)
    assert.equal(json.includes('"deckId"'), false)
    assert.equal(json.includes('"userId"'), false)
    assert.equal(json.includes('"id"'), false)
  })

  test('chaque partie porte les colonnes attendues', () => {
    for (const game of payload.games) {
      for (const field of [
        'date', 'turns', 'tableBracket', 'boardWipes', 'winnerProtectedVictory',
        'lastPlayer', 'notes', 'winnerPlayer', 'winnerCommanders', 'decks',
      ]) {
        assert.ok(field in game, `champ « ${field} » manquant`)
      }
    }
  })

  test('les decks d’une partie sont triés par siège', () => {
    for (const game of payload.games) {
      const seats = game.decks.map((d) => d.seat)
      assert.deepEqual(seats, [...seats].sort((a, b) => a - b))
    }
  })

  test('le gagnant annoncé correspond au deck marqué « win »', () => {
    for (const game of payload.games) {
      const winner = game.decks.find((d) => d.result === 'win')
      assert.equal(game.winnerPlayer, winner?.player ?? '')
      assert.equal(game.winnerCommanders, winner?.commanders ?? '')
    }
  })

  test('chaque siège porte ses deux winrates, en pourcentage et en « x/y »', () => {
    for (const game of payload.games) {
      for (const deck of game.decks) {
        assert.equal(typeof deck.winrateTotalPct, 'number')
        assert.match(deck.winrateTotal, /^\d+\/\d+$/)
        assert.match(deck.winrateVersion, /^\d+\/\d+$/)
        const [wins, played] = deck.winrateTotal.split('/').map(Number)
        assert.ok(wins <= played, `${deck.player} : ${deck.winrateTotal}`)
        if (played > 0) {
          assert.equal(deck.winrateTotalPct, Math.round((wins / played) * 100))
        }
      }
    }
  })

  test('le winrate d’une version ne dépasse jamais celui de la lignée', () => {
    for (const game of payload.games) {
      for (const deck of game.decks) {
        const [, totalPlayed] = deck.winrateTotal.split('/').map(Number)
        const [, versionPlayed] = deck.winrateVersion.split('/').map(Number)
        assert.ok(versionPlayed <= totalPlayed,
          `${deck.player} : version ${deck.winrateVersion} > total ${deck.winrateTotal}`)
      }
    }
  })

  test('sur un jeu vide, l’export reste valide', () => {
    const empty = buildGamesExport([], users, decks)
    assert.equal(empty.gameCount, 0)
    assert.deepEqual(empty.games, [])
  })
})
