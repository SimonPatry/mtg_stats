import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createApp } from '../../server/app.js'
import { pool } from '../../server/db.js'

/**
 * Service du front par Express.
 *
 * En production il n'y a qu'un processus : la même application sert l'API et
 * les fichiers du build. Ce qui doit tenir, et que ces tests épinglent :
 *   — une route /api inconnue répond en JSON, jamais par la page d'accueil ;
 *   — les routes du front (/, /admin, /deck/x) rendent toutes index.html ;
 *   — les assets empreintés sont mis en cache, index.html jamais.
 *
 * On monte un faux dossier de build : la logique testée est celle du routage,
 * pas celle de Vite, et un `npm run build` dans une suite de tests coûterait
 * plusieurs secondes pour ne rien prouver de plus.
 */
const HTML = '<!doctype html><html><head><title>MagicAddicts</title></head><body><div id="app"></div></body></html>'

let dir
let server
let base

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'mtg-dist-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), HTML)
  writeFileSync(join(dir, 'assets', 'index-abcd1234.js'), 'console.log(1)\n')
  writeFileSync(join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')

  server = createApp({ clientDir: dir }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server?.close()
  rmSync(dir, { recursive: true, force: true })
  await pool.end()
})

const get = (path, headers) => fetch(`${base}${path}`, { headers })

describe('routes du front', () => {
  test('la racine rend index.html', async () => {
    const res = await get('/')
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /text\/html/)
    assert.match(await res.text(), /id="app"/)
  })

  test('les routes profondes rendent la même page', async () => {
    for (const path of ['/admin', '/admin/joueurs', '/deck/1234']) {
      const res = await get(path)
      assert.equal(res.status, 200, `${path} devrait rendre le front`)
      assert.match(await res.text(), /id="app"/)
    }
  })

  test('index.html n’est jamais mis en cache', async () => {
    const res = await get('/')
    assert.match(res.headers.get('cache-control') ?? '', /no-store/)
  })

  test('un fichier réel est servi tel quel, pas remplacé par index.html', async () => {
    const res = await get('/favicon.svg')
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /svg/)
  })
})

describe('assets', () => {
  test('les fichiers empreintés sont immuables et cachés un an', async () => {
    const res = await get('/assets/index-abcd1234.js')
    assert.equal(res.status, 200)
    const cache = res.headers.get('cache-control') ?? ''
    assert.match(cache, /immutable/)
    assert.match(cache, /max-age=31536000/)
  })

  test('un asset absent est un 404, pas la page d’accueil', async () => {
    // Un bundle disparu doit se voir : rendre index.html à la place produirait
    // un « Unexpected token < » au lieu d'une erreur lisible.
    const res = await get('/assets/inexistant-0000.js')
    assert.equal(res.status, 404)
    assert.doesNotMatch(await res.text(), /id="app"/)
  })
})

describe('l’API garde la priorité', () => {
  test('la santé répond toujours en JSON', async () => {
    const res = await get('/api/health')
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true })
  })

  test('une route /api inconnue répond en JSON, jamais par la page d’accueil', async () => {
    // 401 et non 404 : le garde d'authentification est monté sur /api avant le
    // 404, et une route inconnue demandée sans session est d'abord un accès
    // refusé. Ce qui compte ici, c'est que la réponse reste du JSON.
    const res = await get('/api/nawak')
    assert.ok([401, 404].includes(res.status), `statut inattendu : ${res.status}`)
    assert.match(res.headers.get('content-type') ?? '', /application\/json/)
    assert.doesNotMatch(await res.text(), /id="app"/)
  })

  test('aucun chemin sous /api ne retombe sur le front', async () => {
    // Y compris sous un préfixe public : ce qui n'est pas servi par un routeur
    // traverse le garde d'authentification et se referme en 401 JSON. Le 404
    // « Route inconnue » ne se voit donc qu'avec une session — c'est voulu,
    // une route inconnue ne s'énumère pas depuis l'extérieur.
    for (const path of ['/api/showcase/nawak', '/api/', '/api/decks/x/y/z']) {
      const res = await get(path)
      assert.ok(res.status >= 400, `${path} devrait échouer, statut ${res.status}`)
      assert.doesNotMatch(await res.text(), /id="app"/, `${path} rend le front`)
    }
  })

  test('une route protégée reste protégée, sans fallback HTML', async () => {
    const res = await get('/api/games')
    assert.equal(res.status, 401)
    assert.match(res.headers.get('content-type') ?? '', /application\/json/)
  })
})

describe('sans build', () => {
  test('l’application démarre quand même et ne sert que l’API', async () => {
    // C'est le cas du développement : Vite sert le front, Express l'API.
    const app = createApp({ clientDir: join(dir, 'absent') })
    const dev = app.listen(0)
    await new Promise((resolve) => dev.once('listening', resolve))
    const devBase = `http://127.0.0.1:${dev.address().port}`
    try {
      const health = await fetch(`${devBase}/api/health`)
      assert.equal(health.status, 200)
      const root = await fetch(`${devBase}/`)
      assert.equal(root.status, 404)
    } finally {
      dev.close()
    }
  })
})

describe('le build réel, s’il existe', () => {
  test('index.html et ses assets sont servis depuis dist/', async (t) => {
    const dist = new URL('../../dist/', import.meta.url).pathname
    if (!existsSync(join(dist, 'index.html'))) {
      return t.skip('pas de build : lance `npm run build` d’abord')
    }
    const app = createApp({ clientDir: dist })
    const real = app.listen(0)
    await new Promise((resolve) => real.once('listening', resolve))
    try {
      const res = await fetch(`http://127.0.0.1:${real.address().port}/admin`)
      assert.equal(res.status, 200)
      const html = await res.text()
      assert.match(html, /<script[^>]+src="\/assets\//)
    } finally {
      real.close()
    }
  })
})
