import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

import { createApp } from '../../server/app.js'
import { pool, migrate } from '../../server/db.js'
import { hashPassword } from '../../server/auth.js'
import { bootstrapAdminAccount } from '../../server/routes/auth.js'
import { computeStats } from '../../src/stats.js'
import { users as jsonUsers, decks as jsonDecks, games as jsonGames } from '../helpers.js'

/**
 * Tests de l'API sur une vraie base.
 *
 * Prérequis : docker compose up -d
 *
 * On monte l'application sur un port éphémère et on l'interroge par HTTP :
 * c'est la seule façon de vérifier ce qui compte vraiment ici — les codes de
 * statut, le cookie de session, et le fait que les routes protégées le soient.
 */
const PASSWORD = 'mot-de-passe-de-test'
const expected = computeStats(jsonGames, jsonUsers, jsonDecks)

let server
let base
let cookie = ''

/** fetch avec le cookie de session, et lecture JSON tolérante. */
async function call(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  const session = setCookie.find((c) => c.startsWith('mtg_session='))
  if (session) cookie = session.split(';')[0]

  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: res.status, body, setCookie }
}

before(async () => {
  process.env.JWT_SECRET = 'secret-de-test-suffisamment-long-pour-passer-la-verification'
  process.env.ADMIN_USERNAME = 'admin'
  process.env.ADMIN_PASSWORD_HASH = await hashPassword(PASSWORD)

  await migrate()
  await bootstrapAdminAccount()
  execFileSync(process.execPath, ['scripts/import-json.mjs', '--test'], {
    cwd: new URL('../..', import.meta.url).pathname,
    env: process.env,
    stdio: 'pipe',
  })

  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server?.close()
  await pool.end()
})

describe('ce qui est ouvert, et ce qui ne l’est pas', () => {
  test('la santé de l’API répond sans authentification', async () => {
    const { status, body } = await call('/api/health')
    assert.equal(status, 200)
    assert.deepEqual(body, { ok: true })
  })

  test('la vitrine est publique', async () => {
    const { status, body } = await call('/api/showcase/decks')
    assert.equal(status, 200)
    assert.ok(Array.isArray(body))
  })

  test('la vitrine ne divulgue ni id joueur ni statistique', async () => {
    const { body } = await call('/api/showcase/decks')
    const json = JSON.stringify(body)
    // « author » (nom public) est volontaire ; on refuse les champs internes.
    for (const leak of ['player', 'user_id', 'wins', 'bracket', 'version']) {
      assert.equal(json.includes(`"${leak}"`), false, `la vitrine expose « ${leak} »`)
    }
  })

  test('tout le reste exige d’être authentifié, statistiques comprises', async () => {
    for (const path of ['/api/stats/dashboard', '/api/games', '/api/decks',
                        '/api/users', '/api/tags', '/api/reference']) {
      const { status } = await call(path)
      assert.equal(status, 401, `${path} devrait être protégée`)
    }
  })
})

describe('authentification', () => {
  test('un mauvais mot de passe est refusé', async () => {
    const { status } = await call('/api/auth/login', {
      method: 'POST', body: { username: 'admin', password: 'incorrect' },
    })
    assert.equal(status, 401)
  })

  test('le bon mot de passe ouvre une session dans un cookie httpOnly', async () => {
    const { status, body, setCookie } = await call('/api/auth/login', {
      method: 'POST', body: { username: 'admin', password: PASSWORD },
    })
    assert.equal(status, 200)
    assert.equal(body.authenticated, true)
    assert.equal(body.user.role, 'admin')
    assert.equal(body.user.username, 'admin')
    const session = setCookie.find((c) => c.startsWith('mtg_session='))
    assert.match(session, /HttpOnly/i)
    assert.match(session, /SameSite=Strict/i)
  })

  test('la session est reconnue', async () => {
    const { body } = await call('/api/auth/me')
    assert.equal(body.authenticated, true)
    assert.equal(body.user.role, 'admin')
    assert.equal(body.user.username, 'admin')
  })
})

describe('référentiels', () => {
  test('couleurs et styles sont servis au front', async () => {
    const { status, body } = await call('/api/reference')
    assert.equal(status, 200)
    assert.equal(body.colors.length, 5)
    assert.ok(body.win_styles.length >= 5)
    assert.ok(body.kill_styles.length >= 5)
    assert.deepEqual(body.colors.map((c) => c.code), ['W', 'U', 'B', 'R', 'G'])
  })
})

describe('statistiques', () => {
  test('le tableau de bord rend exactement les chiffres attendus', async () => {
    const { status, body } = await call('/api/stats/dashboard')
    assert.equal(status, 200)
    assert.equal(body.totalGames, expected.totalGames)
    assert.equal(body.avgTurns, expected.avgTurns)
    assert.equal(body.avgBoardWipes, expected.avgBoardWipes)
    assert.equal(body.protectedRate, expected.protectedRate)
    assert.deepEqual(body.winsByPlayer, expected.winsByPlayer)
  })
})

describe('joueurs', () => {
  test('la liste inclut les joueurs importés et les inscrits', async () => {
    const { body } = await call('/api/users')
    assert.ok(body.length >= jsonUsers.length)
    assert.ok(body.every((u) => typeof u.deck_count === 'number'))
    assert.ok(body.some((u) => u.account_id && u.account_username === 'admin'))
  })

  test('création manuelle refusée — inscription uniquement', async () => {
    const { status, body } = await call('/api/users', {
      method: 'POST', body: { name: 'Nouveau Joueur' },
    })
    assert.equal(status, 403)
    assert.match(body.error, /inscription/i)
  })

  test('un joueur avec des decks ne peut pas être supprimé', async () => {
    const { body: list } = await call('/api/users')
    const owner = list.find((u) => u.deck_count > 0)
    assert.ok(owner, 'au moins un joueur avec deck dans le jeu de test')
    const { status, body } = await call(`/api/users/${owner.id}`, { method: 'DELETE' })
    assert.equal(status, 409)
    assert.ok(body.deck_count > 0)
  })
})

describe('tags', () => {
  // Libellés uniques à chaque exécution : les tags survivent au réimport du
  // jeu de test, et un tag laissé par une session d'essai faisait échouer la
  // création sur un 409 sans que le code y soit pour rien.
  const label = (nom) => `${nom} ${Date.now().toString().slice(-6)}`

  test('création puis suppression protégée par confirmation', async () => {
    const { status, body: tag } = await call('/api/tags', {
      method: 'POST', body: { label: label('Combo') },
    })
    assert.equal(status, 201)

    // sans deck attaché : suppression directe
    const { status: deleted } = await call(`/api/tags/${tag.id}`, { method: 'DELETE' })
    assert.equal(deleted, 200)
  })

  test('un libellé en double est refusé', async () => {
    const nom = label('Aggro')
    const { body: first } = await call('/api/tags', { method: 'POST', body: { label: nom } })
    const { status } = await call('/api/tags', { method: 'POST', body: { label: nom } })
    assert.equal(status, 409)
    await call(`/api/tags/${first.id}`, { method: 'DELETE' })
  })
})

describe('decks', () => {
  let deckId

  test('création d’une lignée avec sa première version et ses partenaires', async () => {
    const { body: users } = await call('/api/users')
    const { status, body } = await call('/api/decks', {
      method: 'POST',
      body: {
        deck: {
          user_id: users[0].id,
          name: 'Tana & Tymna',
          showcase: true,
          commanders: [
            { name: 'Tana, the Bloodsower' },
            { name: 'Tymna the Weaver', set_code: 'c16', collector_number: '38' },
          ],
          colors: ['W', 'B', 'R', 'G'],
          slider: [{ title: 'Rampe', cards: [{ name: 'Sol Ring' }] }],
        },
        version: { bracket: 3, deck_url: 'https://moxfield.com/decks/x', started_on: '2026-01-01' },
      },
    })
    assert.equal(status, 201)
    deckId = body.id
    assert.equal(body.commanders.length, 2)
    assert.equal(body.versions.length, 1)
    assert.equal(body.versions[0].cause, 'initial')
    assert.equal(body.versions[0].bracket, 3)
    assert.deepEqual(body.colors, ['W', 'B', 'R', 'G'])
    assert.equal(body.slider[0].cards[0].name, 'Sol Ring')
  })

  test('un deck marqué showcase apparaît sur la vitrine publique', async () => {
    const saved = cookie
    cookie = '' // on interroge la vitrine en visiteur anonyme
    const { body } = await call('/api/showcase/decks')
    cookie = saved
    const deck = body.find((d) => d.name === 'Tana & Tymna')
    assert.ok(deck, 'le deck vitrine est absent de la page publique')
    assert.deepEqual(deck.commanders, ['Tana, the Bloodsower', 'Tymna the Weaver'])
    assert.deepEqual(deck.colors, ['W', 'B', 'R', 'G'])
    assert.equal(typeof deck.author, 'string')
    assert.ok(deck.author.length > 0, 'l’auteur du deck doit être exposé')
  })

  test('trois commandants sont refusés', async () => {
    const { body: users } = await call('/api/users')
    const { status } = await call('/api/decks', {
      method: 'POST',
      body: {
        deck: {
          user_id: users[0].id,
          commanders: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        },
      },
    })
    assert.equal(status, 400)
  })

  test('ajouter une version incrémente le numéro', async () => {
    const { status, body } = await call(`/api/decks/${deckId}/versions`, {
      method: 'POST',
      body: { bracket: 4, cause: 'levelAdjustment', started_on: '2026-03-01' },
    })
    assert.equal(status, 201)
    assert.equal(body.version_number, 2)

    const { body: deck } = await call(`/api/decks/${deckId}`)
    assert.equal(deck.versions.length, 2)
    assert.equal(deck.current_version.bracket, 4)
  })

  test('un deck jamais joué peut être supprimé', async () => {
    const { status } = await call(`/api/decks/${deckId}`, { method: 'DELETE' })
    assert.equal(status, 204)
  })

  test('un deck déjà joué ne peut pas l’être', async () => {
    const { body: decks } = await call('/api/decks')
    const { body: stats } = await call('/api/stats/dashboard')
    const played = decks.find((d) => (stats.winsByDeck[d.id]?.games ?? 0) > 0)
    const { status, body } = await call(`/api/decks/${played.id}`, { method: 'DELETE' })
    assert.equal(status, 409)
    assert.ok(body.game_count > 0)
  })
})

describe('parties', () => {
  let gameId

  const draft = (overrides = {}) => ({
    played_on: '2026-05-01',
    turns: 8,
    board_wipes: 1,
    seats: [
      { seat_order: 1, player_name: 'Simon', result: 'win', commanders: ['Atraxa'] },
      { seat_order: 2, player_name: 'Alex', result: 'loss', commanders: ['Krenko'] },
    ],
    ...overrides,
  })

  test('la liste reprend les parties importées', async () => {
    const { status, body } = await call('/api/games')
    assert.equal(status, 200)
    assert.equal(body.length, jsonGames.length)
    assert.ok(body[0].seats.length >= 2)
  })

  test('les parties sont rendues de la plus récente à la plus ancienne', async () => {
    const { body } = await call('/api/games')
    const dates = body.map((g) => g.played_on)
    assert.deepEqual(dates, [...dates].sort().reverse())
  })

  test('création avec ses sièges et ses événements', async () => {
    const { status, body } = await call('/api/games', {
      method: 'POST',
      body: draft({
        death_events: [{ turn: 5, victims: ['Alex'], killer: 'Simon', kill_style: 'combat' }],
        mana_events: [{ mana_rule: 'T4', turn: 4, mana_by_player: { Simon: 5, Alex: 4 } }],
      }),
    })
    assert.equal(status, 201)
    gameId = body.id
    assert.equal(body.seats.length, 2)
    assert.equal(body.death_events.length, 1)
    assert.deepEqual(body.mana_events[0].mana_by_player, { Simon: 5, Alex: 4 })
  })

  test('une partie sans gagnant est refusée', async () => {
    const { status, body } = await call('/api/games', {
      method: 'POST',
      body: draft({ seats: [
        { seat_order: 1, player_name: 'Simon', result: 'loss', commanders: [] },
        { seat_order: 2, player_name: 'Alex', result: 'loss', commanders: [] },
      ] }),
    })
    assert.equal(status, 400)
    assert.ok(JSON.stringify(body).includes('gagnant'))
  })

  test('deux joueurs au même siège sont refusés', async () => {
    const { status } = await call('/api/games', {
      method: 'POST',
      body: draft({ seats: [
        { seat_order: 1, player_name: 'Simon', result: 'win', commanders: [] },
        { seat_order: 1, player_name: 'Alex', result: 'loss', commanders: [] },
      ] }),
    })
    assert.equal(status, 400)
  })

  test('une partie à un seul joueur est refusée', async () => {
    const { status } = await call('/api/games', {
      method: 'POST',
      body: draft({ seats: [{ seat_order: 1, player_name: 'Simon', result: 'win', commanders: [] }] }),
    })
    assert.equal(status, 400)
  })

  test('modification : les sièges sont réécrits en bloc', async () => {
    const { status, body } = await call(`/api/games/${gameId}`, {
      method: 'PUT',
      body: draft({
        turns: 12,
        seats: [
          { seat_order: 1, player_name: 'Simon', result: 'loss', commanders: [] },
          { seat_order: 2, player_name: 'Alex', result: 'win', commanders: [] },
          { seat_order: 3, player_name: 'Jordan', result: 'loss', commanders: [] },
        ],
      }),
    })
    assert.equal(status, 200)
    assert.equal(body.turns, 12)
    assert.equal(body.seats.length, 3)
    // les événements de la version précédente ont disparu avec elle
    assert.equal(body.death_events.length, 0)
  })

  test('un siège rattaché à une version de deck inconnue est refusé', async () => {
    // Le cas se produit si le front envoie l'identifiant local d'un deck créé
    // dans le même formulaire au lieu de celui rendu par l'API. Mieux vaut un
    // 400 explicite qu'un siège orphelin.
    const { status } = await call('/api/games', {
      method: 'POST',
      body: draft({ seats: [
        { seat_order: 1, player_name: 'Simon', result: 'win', commanders: [],
          deck_version_id: '00000000-0000-4000-8000-000000000000' },
        { seat_order: 2, player_name: 'Alex', result: 'loss', commanders: [] },
      ] }),
    })
    assert.equal(status, 400)
  })

  test('un siège rattaché à une version existante la référence bien', async () => {
    const { body: allUsers } = await call('/api/users')
    const { body: created } = await call('/api/decks', {
      method: 'POST',
      body: {
        deck: { user_id: allUsers[0].id, name: 'Deck de siège', commanders: [{ name: 'Atraxa' }] },
        version: { bracket: 3, started_on: '2026-05-01' },
      },
    })
    const versionId = created.versions[0].id

    const { status, body } = await call('/api/games', {
      method: 'POST',
      body: draft({ seats: [
        { seat_order: 1, player_name: 'Simon', result: 'win', commanders: ['Atraxa'],
          deck_version_id: versionId },
        { seat_order: 2, player_name: 'Alex', result: 'loss', commanders: [] },
      ] }),
    })
    assert.equal(status, 201)
    assert.equal(body.seats[0].deck_version_id, versionId)
    await call(`/api/games/${body.id}`, { method: 'DELETE' })
    await call(`/api/decks/${created.id}`, { method: 'DELETE' })
  })

  test('suppression', async () => {
    const { status } = await call(`/api/games/${gameId}`, { method: 'DELETE' })
    assert.equal(status, 204)
    const { status: gone } = await call(`/api/games/${gameId}`)
    assert.equal(gone, 404)
  })

  test('le tableau de bord retrouve ses chiffres d’origine après ces allers-retours', async () => {
    const { body } = await call('/api/stats/dashboard')
    assert.equal(body.totalGames, expected.totalGames)
    assert.deepEqual(body.winsByPlayer, expected.winsByPlayer)
  })
})

describe('déconnexion', () => {
  test('après logout, les routes protégées se referment', async () => {
    await call('/api/auth/logout', { method: 'POST' })
    cookie = ''
    const { status } = await call('/api/stats/dashboard')
    assert.equal(status, 401)
  })
})
