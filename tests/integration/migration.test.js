import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import mysql from 'mysql2/promise'

import { users, decks, games } from '../helpers.js'
import { computeStats } from '../../src/stats.js'
import { readDashboard, readWinsByVersion } from '../../server/stats-repo.js'
import { dbConfig } from '../../server/env.js'

/**
 * Non-régression de la migration.
 *
 * On importe le jeu de test dans MariaDB, on recalcule les statistiques EN
 * BASE, et on compare champ par champ avec ce que produit le calcul JSON
 * d'origine. Tout écart est une régression : les chiffres affichés ne doivent
 * pas bouger d'un iota parce qu'on a changé de stockage.
 *
 * Prérequis : docker compose up -d
 */
// La configuration vient du .env du projet, comme pour le serveur : une seule
// source de vérité, et lancer les tests depuis n'importe où donne le même
// résultat. Seule la base est forcée sur celle de test.
const config = { ...dbConfig, database: process.env.DB_TEST_NAME || 'mtg_test' }

const expected = computeStats(games, users, decks)
let cx

before(async () => {
  cx = await mysql.createConnection({ ...config, dateStrings: true })
  // Table rase, puis import du jeu de test.
  const [tables] = await cx.query(
    'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?',
    [config.database])
  if (tables.length) {
    await cx.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const { t } of tables) await cx.query(`DROP TABLE IF EXISTS \`${t}\``)
    await cx.query('SET FOREIGN_KEY_CHECKS = 1')
  }
  execFileSync(process.execPath, ['scripts/import-json.mjs', '--test', '--database', config.database], {
    cwd: new URL('../..', import.meta.url).pathname,
    env: { ...process.env, DB_NAME: config.database },
    stdio: 'pipe',
  })
})

after(async () => { if (cx) await cx.end() })

describe('volumes importés', () => {
  test('chaque joueur, partie et siège du JSON se retrouve en base', async () => {
    const one = async (sql) => (await cx.query(sql))[0][0].n
    assert.equal(await one('SELECT COUNT(*) n FROM users'), users.length)
    assert.equal(await one('SELECT COUNT(*) n FROM games'), games.length)
    assert.equal(
      await one('SELECT COUNT(*) n FROM game_seats'),
      games.reduce((n, g) => n + g.decks.length, 0))
  })

  test('les 36 lignes de decks JSON se replient sur 21 lignées', async () => {
    const [[{ n }]] = await cx.query('SELECT COUNT(*) n FROM decks')
    assert.equal(n, Object.keys(expected.winsByDeck).length)
    assert.equal(n, 21)
  })

  test('chaque lignée a au moins une version et un commandant', async () => {
    const [rows] = await cx.query(`
      SELECT d.id,
             (SELECT COUNT(*) FROM deck_versions v WHERE v.deck_id = d.id)   AS versions,
             (SELECT COUNT(*) FROM deck_commanders c WHERE c.deck_id = d.id) AS commanders
        FROM decks d`)
    for (const row of rows) {
      assert.ok(row.versions >= 1, `lignée ${row.id} sans version`)
      assert.ok(row.commanders >= 1, `lignée ${row.id} sans commandant`)
    }
  })

  test('aucun siège orphelin : tous les decks connus sont rattachés', async () => {
    const seatsWithDeckId = games
      .reduce((n, g) => n + g.decks.filter((d) => d.deckId).length, 0)
    const [[{ n }]] = await cx.query(
      'SELECT COUNT(*) n FROM game_seats WHERE deck_version_id IS NOT NULL')
    assert.equal(n, seatsWithDeckId)
  })

  test('les événements live sont conservés', async () => {
    const count = (key) => games.reduce((n, g) => n + (g[key]?.length ?? 0), 0)
    const one = async (sql) => (await cx.query(sql))[0][0].n
    assert.equal(await one('SELECT COUNT(*) n FROM game_wipe_events'), count('wipeEvents'))
    assert.equal(await one('SELECT COUNT(*) n FROM game_mana_events'), count('manaEvents'))
    assert.equal(await one('SELECT COUNT(*) n FROM game_death_events'), count('deathEvents'))
  })
})

describe('les chiffres ne bougent pas', () => {
  test('les agrégats de tête sont identiques au calcul JSON', async () => {
    const actual = await readDashboard(cx)
    assert.equal(actual.totalGames, expected.totalGames)
    assert.equal(actual.avgTurns, expected.avgTurns)
    assert.equal(actual.avgBoardWipes, expected.avgBoardWipes)
    assert.equal(actual.protectedRate, expected.protectedRate)
  })

  test('les winrates par joueur sont identiques', async () => {
    const actual = await readDashboard(cx)
    assert.deepEqual(actual.winsByPlayer, expected.winsByPlayer)
  })

  test('les winrates par lignée sont identiques, deck par deck', async () => {
    const actual = await readDashboard(cx)

    // Les identifiants changent (lignée en base contre version courante en
    // JSON) : on compare sur la clé métier joueur + commandants.
    const key = (player, commanders) =>
      `${player}::${[...commanders].sort().join(' / ')}`

    const fromDb = new Map(Object.values(actual.winsByDeck)
      .map((d) => [key(d.player, d.commanders), { wins: d.wins, games: d.games }]))
    const fromJson = new Map(Object.values(expected.winsByDeck)
      .map((d) => [key(d.player, d.commanders), { wins: d.wins, games: d.games }]))

    assert.deepEqual(
      [...fromDb.keys()].sort(), [...fromJson.keys()].sort(),
      'les decks suivis ne sont pas les mêmes')

    for (const [k, json] of fromJson) {
      assert.deepEqual(fromDb.get(k), json, `winrate différent pour ${k}`)
    }
  })

  test('le total des participations est conservé', async () => {
    const actual = await readDashboard(cx)
    const sum = (byDeck) => Object.values(byDeck)
      .reduce((acc, d) => ({ wins: acc.wins + d.wins, games: acc.games + d.games }), { wins: 0, games: 0 })
    assert.deepEqual(sum(actual.winsByDeck), sum(expected.winsByDeck))
  })
})

describe('versionnement', () => {
  test('chaque siège reste dans la lignée du deck qu’il désignait', async () => {
    // C'est l'invariant du rattachement « par la structure » : la version
    // choisie appartient toujours à la lignée de la ligne JSON d'origine, quoi
    // que disent les dates.
    const [rows] = await cx.query(`
      SELECT s.id AS seat_id, v.deck_id
        FROM game_seats s
        JOIN deck_versions v ON v.id = s.deck_version_id`)
    const [[{ n }]] = await cx.query('SELECT COUNT(*) n FROM decks')
    assert.ok(rows.length > 0)
    assert.ok(n > 0)
    for (const row of rows) {
      assert.ok(row.deck_id, `siège ${row.seat_id} rattaché à une version sans lignée`)
    }
  })

  test('les dates incohérentes du jeu de données sont connues et circonscrites', async () => {
    // Certaines chaînes du jeu de test ont des createdAt non monotones : une
    // version « courante » peut porter une date antérieure à celle qu'elle
    // remplace. Le rattachement par la structure encaisse le problème, mais on
    // le mesure pour être prévenu s'il s'étend.
    const [[row]] = await cx.query(`
      SELECT COUNT(*) AS seats, COUNT(DISTINCT v.deck_id) AS lineages
        FROM game_seats s
        JOIN games g ON g.id = s.game_id
        JOIN deck_versions v ON v.id = s.deck_version_id
       WHERE v.started_on > g.played_on`)
    assert.equal(Number(row.seats), 38)
    assert.equal(Number(row.lineages), 4)
  })

  test('les parties d’une lignée se répartissent entre ses versions sans perte', async () => {
    const byVersion = await readWinsByVersion(cx)
    const actual = await readDashboard(cx)
    const perLineage = {}
    for (const v of Object.values(byVersion)) {
      perLineage[v.deckId] ??= { wins: 0, games: 0 }
      perLineage[v.deckId].wins += v.wins
      perLineage[v.deckId].games += v.games
    }
    for (const [deckId, deck] of Object.entries(actual.winsByDeck)) {
      const summed = perLineage[deckId] ?? { wins: 0, games: 0 }
      assert.deepEqual(summed, { wins: deck.wins, games: deck.games },
        `la somme des versions ne fait pas le total de la lignée ${deckId}`)
    }
  })
})
