/**
 * Import unique des données JSON de mtg_stats vers MariaDB.
 *
 *   node scripts/import-json.mjs                     # src/data/*.json
 *   node scripts/import-json.mjs --test              # src/data/*_test.json
 *   node scripts/import-json.mjs --dir /chemin       # un dossier quelconque
 *   node scripts/import-json.mjs --database mtg_test # base cible
 *
 * Idempotent : la table import_map retient la correspondance ancien
 * identifiant JSON → identifiant en base, donc relancer le script met à jour
 * au lieu de dupliquer.
 *
 * Le point délicat est le versionnement. Dans le JSON, une version de deck est
 * une LIGNE de plus, chaînée par previousDeckId, et les reclassements de
 * niveau vivent dans un tableau `history` sur cette ligne. En base, une lignée
 * est une ligne de `decks` et chaque état successif une ligne de
 * `deck_versions`.
 *
 * Un siège est rattaché PAR LA STRUCTURE : on part de la ligne JSON que
 * désigne son `deckId`, et la date ne sert qu'à départager les reclassements
 * internes à cette ligne. Se fier à la date seule serait fragile — certaines
 * chaînes du jeu de données ont des `createdAt` non monotones, une version
 * « courante » pouvant porter une date antérieure à celle qu'elle remplace.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

import { dbConfig } from '../server/env.js'
import { migrate } from '../server/db.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

// ─── Options de ligne de commande ─────────────────────────────────────────
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const option = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const useTestData = flag('test')
const dataDir = resolve(option('dir', join(root, 'src', 'data')))
const suffix = useTestData ? '_test' : ''
const database = option('database', dbConfig.database)

const uuid = () => crypto.randomUUID()

function readJson(name) {
  const path = join(dataDir, `${name}${suffix}.json`)
  if (!existsSync(path)) throw new Error(`Fichier introuvable : ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

// ─── Lecture des niveaux ──────────────────────────────────────────────────
/** 'B3 - low' → { bracket: 3, variation: 'low' } ; tolère 'B2', null, ''. */
function parseLevel(value) {
  if (value == null) return { bracket: null, variation: null }
  const match = String(value).match(/B?(\d)\s*(?:-\s*(low|high))?/i)
  if (!match) return { bracket: null, variation: null }
  return {
    bracket: Number(match[1]),
    variation: match[2] ? match[2].toLowerCase() : null,
  }
}

const asList = (com) => (Array.isArray(com) ? com : [com]).filter(Boolean)
const commandersKey = (com) => [...asList(com)].sort().join(' / ')

// ─── Lignées : reconstruire les chaînes previousDeckId ────────────────────
function buildLineages(decks) {
  const byId = new Map(decks.map((d) => [d.id, d]))
  const hasChild = new Set(decks.map((d) => d.previousDeckId).filter(Boolean))

  // Une racine est un deck dont le parent n'existe pas dans le jeu de données.
  const roots = decks.filter((d) => !d.previousDeckId || !byId.has(d.previousDeckId))

  const lineages = []
  const seen = new Set()
  for (const root of roots) {
    const chain = [root]
    seen.add(root.id)
    let current = root
    while (true) {
      const next = decks.find((d) => d.previousDeckId === current.id && !seen.has(d.id))
      if (!next) break
      chain.push(next)
      seen.add(next.id)
      current = next
    }
    lineages.push(chain)
  }

  // Sécurité : un cycle laisserait des decks orphelins, on les rattache seuls.
  for (const deck of decks) {
    if (!seen.has(deck.id)) lineages.push([deck])
  }
  return { lineages, hasChild }
}

/**
 * États successifs d'une ligne JSON : sa création, puis chaque reclassement
 * consigné dans `history`. Rendus dans l'ordre chronologique.
 */
function statesForRow(row, isFirstOfLineage) {
  const history = [...(row.history ?? [])]
    .filter((h) => h?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  const start = row.createdAt ?? history[0]?.date ?? null
  const initial = history.length
    ? parseLevel(history[0].previousValue)
    : { bracket: row.bracket ?? null, variation: row.bracketVariation ?? null }

  const states = [{
    bracket: initial.bracket ?? row.bracket ?? null,
    variation: initial.variation ?? null,
    startedOn: start,
    cause: isFirstOfLineage ? 'initial' : 'newVersion',
  }]

  for (const entry of history) {
    const level = parseLevel(entry.newValue)
    states.push({
      bracket: level.bracket ?? entry.bracket ?? null,
      variation: level.variation ?? entry.bracketVariation ?? null,
      startedOn: entry.date,
      cause: entry.cause || 'levelAdjustment',
    })
  }

  // Le dernier état doit refléter la ligne telle qu'elle est aujourd'hui.
  const last = states[states.length - 1]
  if (row.bracket != null) {
    last.bracket = row.bracket
    last.variation = row.bracketVariation ?? null
  }
  return states
}

// ─── Import ───────────────────────────────────────────────────────────────
async function main() {
  const users = readJson('users')
  const decks = readJson('decks')
  const games = readJson('games')

  console.log(`Source : ${dataDir}${suffix ? ` (jeu de test)` : ''}`)
  console.log(`Cible  : ${dbConfig.host}:${dbConfig.port}/${database}`)
  console.log(`Lu     : ${users.length} joueurs, ${decks.length} decks, ${games.length} parties\n`)

  await migrate({ config: { connectionConfig: { ...dbConfig, database } } })

  const cx = await mysql.createConnection({ ...dbConfig, database, namedPlaceholders: true, dateStrings: true })
  await cx.beginTransaction()

  try {
    const mapped = async (kind, legacyId) => {
      const [rows] = await cx.execute(
        'SELECT new_id FROM import_map WHERE kind = ? AND legacy_id = ?', [kind, legacyId])
      return rows[0]?.new_id ?? null
    }
    const remember = (kind, legacyId, newId) => cx.execute(
      `INSERT INTO import_map (kind, legacy_id, new_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE new_id = VALUES(new_id)`, [kind, legacyId, newId])

    // ── Joueurs ───────────────────────────────────────────────────────────
    const userIdByLegacy = new Map()
    for (const user of users) {
      const id = (await mapped('user', user.id)) ?? user.id
      await cx.execute(
        `INSERT INTO users (id, name, active) VALUES (:id, :name, :active)
         ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active)`,
        { id, name: user.name, active: user.active !== false })
      await remember('user', user.id, id)
      userIdByLegacy.set(user.id, id)
    }

    // ── Decks : lignées, versions, commandants ────────────────────────────
    const { lineages } = buildLineages(decks)
    const versionsByRow = new Map()       // id JSON de ligne → [{id, startedOn}]
    const lineageByLegacyDeck = new Map() // id JSON de ligne → deckId en base

    for (const chain of lineages) {
      const head = chain[0]
      const tail = chain[chain.length - 1]
      const lineageId = (await mapped('deck', head.id)) ?? uuid()

      await cx.execute(
        `INSERT INTO decks (id, user_id, name, description, showcase, active, created_on)
         VALUES (:id, :userId, :name, :description, :showcase, :active, :createdOn)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), active = VALUES(active),
                                 created_on = VALUES(created_on)`,
        {
          id: lineageId,
          userId: userIdByLegacy.get(tail.userId) ?? tail.userId,
          name: '',
          description: null,
          // L'affichage sur la vitrine se décide à la main, deck par deck :
          // rien n'est publié automatiquement par l'import.
          showcase: false,
          active: tail.active !== false,
          createdOn: head.createdAt ?? null,
        })
      await remember('deck', head.id, lineageId)

      // Commandants : portés par la lignée, pris sur la dernière version.
      await cx.execute('DELETE FROM deck_commanders WHERE deck_id = ?', [lineageId])
      const commanders = asList(tail.com)
      for (const [index, name] of commanders.entries()) {
        await cx.execute(
          `INSERT INTO deck_commanders (deck_id, position, name, set_code, collector_number)
           VALUES (:deckId, :position, :name, :setCode, :collectorNumber)`,
          {
            deckId: lineageId,
            position: index + 1,
            name,
            // comPrint ne concerne que le commandant principal aujourd'hui.
            setCode: index === 0 ? (tail.comPrint?.set ?? '') : '',
            collectorNumber: index === 0 ? String(tail.comPrint?.collector_number ?? '') : '',
          })
      }

      // Versions : un état par création de ligne et par reclassement.
      //
      // On ne SUPPRIME pas les versions existantes avant de les réécrire : des
      // sièges de parties les référencent, et la contrainte de clé étrangère
      // ferait échouer un second import. On réutilise donc l'identifiant de la
      // version de même rang quand elle existe déjà — c'est ce qui rend le
      // script réellement rejouable sur une base déjà peuplée.
      const [existingVersions] = await cx.execute(
        'SELECT id, version_number FROM deck_versions WHERE deck_id = ?', [lineageId])
      const versionIdByNumber = new Map(
        existingVersions.map((v) => [Number(v.version_number), v.id]))

      let number = 0
      for (const [rowIndex, row] of chain.entries()) {
        const rowVersions = []
        for (const state of statesForRow(row, rowIndex === 0)) {
          number += 1
          const versionId = versionIdByNumber.get(number) ?? uuid()
          const values = {
            id: versionId, deckId: lineageId, number,
            bracket: state.bracket, variation: state.variation,
            url: row.deckUrl ?? '',
            cause: state.cause,
            startedOn: state.startedOn ?? head.createdAt ?? '1970-01-01',
          }
          await cx.execute(
            `INSERT INTO deck_versions
               (id, deck_id, version_number, bracket, bracket_variation, deck_url, cause, started_on)
             VALUES (:id, :deckId, :number, :bracket, :variation, :url, :cause, :startedOn)
             ON DUPLICATE KEY UPDATE
               bracket = VALUES(bracket), bracket_variation = VALUES(bracket_variation),
               deck_url = VALUES(deck_url), cause = VALUES(cause),
               started_on = VALUES(started_on)`,
            values)
          rowVersions.push({ id: versionId, startedOn: state.startedOn ?? '1970-01-01' })
        }
        versionsByRow.set(row.id, rowVersions)
        lineageByLegacyDeck.set(row.id, lineageId)
        await remember('deckRow', row.id, lineageId)
      }

      // Versions en trop d'un import précédent (le JSON a raccourci) : on les
      // retire, sauf si une partie s'y accroche encore.
      for (const [existingNumber, existingId] of versionIdByNumber) {
        if (existingNumber <= number) continue
        const [[{ used }]] = await cx.query(
          'SELECT COUNT(*) AS used FROM game_seats WHERE deck_version_id = ?', [existingId])
        if (Number(used) === 0) {
          await cx.execute('DELETE FROM deck_versions WHERE id = ?', [existingId])
        }
      }
    }

    /**
     * Version jouée par un siège. On reste DANS la ligne JSON que le siège
     * désigne : la date ne départage que les reclassements internes à cette
     * ligne, jamais le choix de la ligne elle-même.
     */
    function versionForSeat(legacyRowId, date) {
      const versions = versionsByRow.get(legacyRowId) ?? []
      if (versions.length === 0) return null
      const eligible = versions.filter((v) => String(v.startedOn) <= String(date))
      return (eligible.length ? eligible[eligible.length - 1] : versions[0]).id
    }

    // ── Parties ───────────────────────────────────────────────────────────
    for (const game of games) {
      const gameId = (await mapped('game', game.id)) ?? uuid()
      const level = { bracket: game.bracket ?? null, variation: game.bracketVariation ?? null }

      await cx.execute(
        `INSERT INTO games (id, played_on, turns, bracket, bracket_variation, board_wipes,
                            winner_protected_victory, last_player, last_seat_order, win_style, notes)
         VALUES (:id, :playedOn, :turns, :bracket, :variation, :boardWipes,
                 :protectedVictory, :lastPlayer, :lastSeatOrder, :winStyle, :notes)
         ON DUPLICATE KEY UPDATE
           played_on = VALUES(played_on), turns = VALUES(turns), bracket = VALUES(bracket),
           bracket_variation = VALUES(bracket_variation), board_wipes = VALUES(board_wipes),
           winner_protected_victory = VALUES(winner_protected_victory),
           last_player = VALUES(last_player), last_seat_order = VALUES(last_seat_order),
           win_style = VALUES(win_style), notes = VALUES(notes)`,
        {
          id: gameId,
          playedOn: game.date,
          turns: game.turns ?? null,
          bracket: level.bracket,
          variation: level.variation,
          boardWipes: game.boardWipes ?? 0,
          protectedVictory: Boolean(game.winnerProtectedVictory),
          lastPlayer: game.lastPlayer ?? null,
          lastSeatOrder: game.lastSeatOrder ?? null,
          winStyle: game.winStyle || null,
          notes: game.notes ?? null,
        })
      await remember('game', game.id, gameId)

      // Sièges — réécrits en bloc, les événements suivent par cascade.
      await cx.execute('DELETE FROM game_seats WHERE game_id = ?', [gameId])
      for (const seat of game.decks ?? []) {
        const lineageId = seat.deckId ? lineageByLegacyDeck.get(seat.deckId) ?? null : null
        const versionId = seat.deckId ? versionForSeat(seat.deckId, game.date) : null
        const owner = decks.find((d) => d.id === seat.deckId)
        await cx.execute(
          `INSERT INTO game_seats (id, game_id, seat_order, deck_version_id, user_id,
                                   player_name, result, bracket, bracket_variation, commanders)
           VALUES (:id, :gameId, :seat, :versionId, :userId, :player, :result,
                   :bracket, :variation, :commanders)`,
          {
            id: uuid(), gameId, seat: seat.seatOrder, versionId,
            userId: owner ? (userIdByLegacy.get(owner.userId) ?? null) : null,
            player: seat.player,
            result: seat.result === 'win' ? 'win' : 'loss',
            bracket: seat.bracket ?? null,
            variation: seat.bracketVariation ?? null,
            commanders: JSON.stringify(asList(seat.commanders)),
          })
      }

      for (const table of ['game_wipe_events', 'game_mana_events', 'game_death_events']) {
        await cx.execute(`DELETE FROM ${table} WHERE game_id = ?`, [gameId])
      }
      for (const w of game.wipeEvents ?? []) {
        await cx.execute(
          `INSERT INTO game_wipe_events (id, game_id, turn, player, countered, countered_by,
                                         protected, partially_protected)
           VALUES (:id, :gameId, :turn, :player, :countered, :counteredBy, :protected, :partial)`,
          {
            id: uuid(), gameId, turn: w.turn, player: w.player,
            countered: Boolean(w.countered), counteredBy: w.counteredBy ?? null,
            protected: JSON.stringify(w.protected ?? []),
            partial: JSON.stringify(w.partiallyProtected ?? []),
          })
      }
      for (const m of game.manaEvents ?? []) {
        await cx.execute(
          `INSERT INTO game_mana_events (id, game_id, mana_rule, turn, mana_by_player)
           VALUES (:id, :gameId, :rule, :turn, :mana)`,
          {
            id: uuid(), gameId, rule: m.manaRule, turn: m.turn ?? null,
            mana: JSON.stringify(m.manaByPlayer ?? {}),
          })
      }
      for (const d of game.deathEvents ?? []) {
        await cx.execute(
          `INSERT INTO game_death_events (id, game_id, turn, victims, killer, kill_style)
           VALUES (:id, :gameId, :turn, :victims, :killer, :style)`,
          {
            id: uuid(), gameId, turn: d.turn,
            victims: JSON.stringify(d.victims ?? []),
            killer: d.killer ?? null, style: d.killStyle || null,
          })
      }
    }

    await cx.commit()

    const count = async (table) => {
      const [rows] = await cx.query(`SELECT COUNT(*) AS n FROM ${table}`)
      return rows[0].n
    }
    console.log('Import terminé :')
    for (const table of ['users', 'decks', 'deck_versions', 'deck_commanders', 'games',
                         'game_seats', 'game_wipe_events', 'game_mana_events', 'game_death_events']) {
      console.log(`  ${String(await count(table)).padStart(5)}  ${table}`)
    }
  } catch (err) {
    await cx.rollback()
    throw err
  } finally {
    await cx.end()
  }
}

main().catch((err) => {
  console.error('\nImport interrompu :', err.message)
  process.exitCode = 1
})
