import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

import { createApp } from '../../server/app.js'
import { pool } from '../../server/db.js'

/**
 * La politique de sécurité couvre-t-elle ce que le front demande vraiment ?
 *
 * Deux bugs identiques se sont déjà produits : une ressource externe ajoutée au
 * front, une CSP qui l'ignore, et un site qui marche sur le serveur de
 * développement (sans CSP) mais pas en production. On ne peut pas tester ça
 * depuis le navigateur sans réseau, mais on peut tester l'invariant qui compte :
 * tout hôte externe cité dans les sources est déclaré dans la politique.
 *
 * `HOSTS` est la table de référence. Ajouter un hôte au front sans l'ajouter
 * ici fait échouer le dernier test, avec son nom dans le message.
 */
const HOSTS = {
  'api.scryfall.com': 'connect-src',      // recherche de cartes
  'cards.scryfall.io': 'img-src',         // illustrations
  'svgs.scryfall.io': 'img-src',          // symboles de mana
  'api.dicebear.com': 'img-src',          // avatars du roster
  'fonts.googleapis.com': 'style-src',    // feuille des polices
  'fonts.gstatic.com': 'font-src',        // fichiers de polices
}

/** Hôtes atteints par un lien classique : aucune directive ne les régit. */
const LINK_ONLY = new Set(['moxfield.com', 'scryfall.com'])

let server
let directives

before(async () => {
  server = createApp({ clientDir: '/dev/null/absent' }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/health`)
  const header = res.headers.get('content-security-policy')
  assert.ok(header, 'aucune CSP servie')

  directives = Object.fromEntries(header.split(';').map((part) => {
    const [name, ...values] = part.trim().split(/\s+/)
    return [name, values]
  }))
})

after(async () => {
  server?.close()
  await pool.end()
})

/** Tous les fichiers de sources du front, index.html compris. */
function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (['.js', '.jsx', '.css'].includes(extname(entry))) out.push(full)
  }
  return out
}

describe('la politique déclare ce dont le front a besoin', () => {
  for (const [host, directive] of Object.entries(HOSTS)) {
    test(`${host} est autorisé par ${directive}`, () => {
      const values = directives[directive]
      assert.ok(values, `directive ${directive} absente de la politique`)
      assert.ok(
        values.includes(`https://${host}`),
        `${host} manque dans ${directive} : ${values.join(' ')}`)
    })
  }

  test('les directives de base restent verrouillées', () => {
    assert.deepEqual(directives['default-src'], ["'self'"])
    assert.deepEqual(directives['script-src'], ["'self'"])
    assert.deepEqual(directives['frame-ancestors'], ["'none'"])
  })
})

describe('aucun hôte externe non déclaré', () => {
  test('tout ce que citent les sources figure dans la table', () => {
    const root = new URL('../../src', import.meta.url).pathname
    const found = new Set()
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/https:\/\/([a-z0-9.-]+)/gi)) {
        found.add(match[1].toLowerCase())
      }
    }

    const unknown = [...found].filter(
      (host) => !(host in HOSTS) && !LINK_ONLY.has(host))
    assert.deepEqual(unknown, [],
      `hôte(s) cité(s) par le front mais absent(s) de la table CSP : ${unknown.join(', ')}`)
  })
})
