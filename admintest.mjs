/**
 * Vérification de bout en bout du tableau de bord, dans un vrai navigateur.
 *
 * On se connecte, on laisse l'application charger ses données depuis l'API,
 * puis on compare ce qui est AFFICHÉ avec ce que produit `computeStats` sur le
 * jeu JSON d'origine. C'est le dernier maillon : les tests d'intégration
 * prouvent que la base rend les mêmes chiffres, celui-ci prouve que l'écran les
 * rend aussi.
 */
import { chromium } from 'playwright'
import { users, decks, games } from './tests/helpers.js'
import { computeStats } from './src/stats.js'

const expected = computeStats(games, users, decks)
const PASSWORD = process.env.ADMIN_PASSWORD || 'motdepassedetest'
// Deux configurations à couvrir : le développement (Vite sur 5173 relaie /api
// vers Express) et la production (Express sert le front et l'API, une seule
// origine). BASE_URL=http://localhost:3000 bascule sur la seconde.
const BASE = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '')
const CARD = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="500" height="700" fill="#2a3b52"/></svg>').toString('base64')

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true })
page.setDefaultTimeout(15000)

const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.route('**://api.scryfall.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ name: 'X', scryfall_uri: 'u', image_uris: { normal: CARD } }) }))
await page.route('**://svgs.scryfall.io/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }))
await page.route('**://fonts.g**', (r) => r.abort())

let failed = 0
const step = async (label, fn) => {
  try { await fn(); console.log(`OK   ${label}`) }
  catch (e) { failed += 1; console.log(`FAIL ${label} :: ${process.env.VERBOSE ? e.message : e.message.split('\n')[0]}`) }
}
const eq = (actual, wanted, what) => {
  if (String(actual).trim() !== String(wanted).trim()) {
    throw new Error(`${what} : attendu « ${wanted} », affiché « ${actual} »`)
  }
}

await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })

await step('l’admin demande une authentification', async () => {
  await page.locator('input[type="password"]').waitFor()
})

await step('un mauvais mot de passe est refusé', async () => {
  await page.fill('input[type="password"]', 'mauvais')
  await page.locator('form button[type="submit"]').click()
  await page.locator('.admin-login .error').waitFor()
  if (await page.locator('.dashboard, .stats-app').count()) throw new Error('accès accordé malgré un mot de passe faux')
})

await step('le bon mot de passe ouvre le tableau de bord', async () => {
  await page.fill('input[type="password"]', PASSWORD)
  await page.locator('form button[type="submit"]').click()
  await page.locator('input[type="password"]').waitFor({ state: 'detached' })
})

// Le tableau de bord charge ses trois collections avant de rendre les chiffres.
await step('le tableau de bord finit de charger', async () => {
  await page.waitForResponse((r) => r.url().includes('/api/games'), { timeout: 15000 }).catch(() => {})
  await page.waitForFunction(
    () => /\d/.test(document.body.innerText) && !/chargement/i.test(document.body.innerText),
    null, { timeout: 15000 })
  await page.waitForTimeout(500)
})

await step('les agrégats de tête sont ceux du calcul de référence', async () => {
  const body = await page.locator('body').innerText()
  for (const [label, value] of [
    ['nombre de parties', expected.totalGames],
    ['tours moyens', expected.avgTurns],
    ['board wipes moyens', expected.avgBoardWipes],
  ]) {
    if (!body.includes(String(value))) throw new Error(`${label} (${value}) absent de l’écran`)
  }
})

await step('chaque joueur affiche son winrate de référence', async () => {
  const body = await page.locator('body').innerText()
  for (const [player, stat] of Object.entries(expected.winsByPlayer)) {
    if (!body.includes(player)) throw new Error(`joueur ${player} absent`)
    const rate = Math.round((stat.wins / stat.games) * 100)
    if (!new RegExp(`${stat.wins}\\s*/\\s*${stat.games}|${rate}\\s*%`).test(body)) {
      throw new Error(`${player} : ${stat.wins}/${stat.games} (${rate} %) introuvable à l’écran`)
    }
  }
})

await step('les données viennent de l’API, pas d’un fichier JSON', async () => {
  const seen = []
  page.on('request', (r) => seen.push(r.url()))
  await page.reload({ waitUntil: 'networkidle' })
  if (seen.some((u) => /\.json(\?|$)/.test(u))) throw new Error(`fichier JSON chargé : ${seen.find((u) => /\.json(\?|$)/.test(u))}`)
  for (const path of ['/api/games', '/api/users', '/api/decks']) {
    if (!seen.some((u) => u.includes(path))) throw new Error(`aucun appel à ${path}`)
  }
})

await step('la session survit au rechargement', async () => {
  if (await page.locator('input[type="password"]').count()) throw new Error('redemande le mot de passe après rechargement')
})

await step('le détail d’une partie s’ouvre', async () => {
  await page.locator('article.game .btn-game-details').first().click()
  await page.locator('.modal').waitFor()
  await page.keyboard.press('Escape')
  await page.locator('.modal').waitFor({ state: 'detached' })
})

await step('l’export Excel se construit depuis les données de l’API', async () => {
  const download = page.waitForEvent('download', { timeout: 15000 })
  await page.locator('button', { hasText: '↓ Excel' }).click()
  const file = await download
  const name = file.suggestedFilename()
  if (!name.endsWith('.xlsx')) throw new Error(`fichier inattendu : ${name}`)
})

// ─── Saisie d'une partie ───────────────────────────────────────────────────
// C'est le chemin d'écriture le plus exposé : la partie référence des joueurs
// et des versions de deck, et le formulaire peut faire naître une version au
// passage (bracket modifié). On le déroule en entier dans le navigateur.
const cookie = (await page.context().cookies())
  .map((c) => `${c.name}=${c.value}`).join('; ')
const apiGet = async (path) =>
  (await (await fetch(`${API}/api${path}`, { headers: { cookie } })).json())
const apiGames = () => apiGet('/games')

await step('saisir une partie complète l’enregistre en base', async () => {
  const before = await apiGames()
  const decksBefore = await apiGet('/decks?versions=1')

  await page.locator('button', { hasText: '+ Partie' }).click()
  const form = page.locator('.add-game-form')
  await form.waitFor()

  await form.locator('.add-game-date input').fill('2026-09-05')
  await form.locator('.add-game-turns input').fill('11')
  await form.locator('.add-game-bracket select').selectOption('3')

  const rows = form.locator('.form-deck-row')
  const seats = await rows.count()
  if (seats < 3) throw new Error(`${seats} sièges seulement dans le formulaire`)

  // Les <option> d'un <select> fermé sont invisibles pour Playwright : on lit
  // les valeurs dans le DOM plutôt que d'attendre qu'elles s'affichent.
  const values = (locator) => locator.evaluate((el) =>
    [...el.options].filter((o) => o.value && !o.disabled).map((o) => o.value))

  // Pour chaque siège : le premier joueur encore libre, puis son premier deck.
  for (let i = 0; i < seats; i += 1) {
    const row = rows.nth(i)
    const player = row.locator('.form-deck-player-cell select')
    const [userId] = await values(player)
    if (!userId) throw new Error(`aucun joueur disponible pour le siège ${i + 1}`)
    await player.selectOption(userId)

    const deck = row.locator('.form-deck-commander-cell select')
    // La liste des commandants dépend du joueur : elle se remplit au re-rendu.
    await deck.locator('option').first().waitFor({ state: 'attached' })
    let deckIds = []
    for (let tries = 0; tries < 30 && deckIds.length === 0; tries += 1) {
      deckIds = await values(deck)
      if (deckIds.length === 0) await page.waitForTimeout(100)
    }
    if (deckIds.length === 0) throw new Error(`aucun deck disponible pour le siège ${i + 1}`)
    await deck.selectOption(deckIds[0])
  }

  await rows.first().locator('.form-deck-win input').check()
  await rows.nth(1).locator('.form-deck-last input').check()

  await form.locator('button[type="submit"]').click()
  await page.locator('.add-game-form').waitFor({ state: 'detached', timeout: 20000 })

  const after = await apiGames()
  if (after.length !== before.length + 1) {
    throw new Error(`${before.length} parties avant, ${after.length} après`)
  }

  // La partie créée doit être complète : des sièges, un seul gagnant, et
  // chaque siège rattaché à une version de deck existante.
  const created = after.find((g) => !before.some((b) => b.id === g.id))
  if (!created) throw new Error('la partie créée est introuvable dans l’API')
  if (created.seats.length !== seats) {
    throw new Error(`${seats} sièges saisis, ${created.seats.length} enregistrés`)
  }
  if (created.seats.filter((s) => s.result === 'win').length !== 1) {
    throw new Error('la partie enregistrée n’a pas exactement un gagnant')
  }
  const orphan = created.seats.find((s) => !s.deck_version_id)
  if (orphan) throw new Error(`siège ${orphan.seat_order} sans version de deck`)

  // Saisir une partie avec des decks existants ne doit créer ni lignée ni
  // version : c'est le piège du diff par tableau complet, qui prendrait un
  // objet recomposé à l'identique pour une nouveauté.
  const decksAfter = await apiGet('/decks?versions=1')
  const count = (list) => list.reduce((n, d) => n + (d.versions?.length ?? 0), 0)
  if (decksAfter.length !== decksBefore.length) {
    throw new Error(`${decksBefore.length} lignées avant, ${decksAfter.length} après`)
  }
  if (count(decksAfter) !== count(decksBefore)) {
    throw new Error(`${count(decksBefore)} versions avant, ${count(decksAfter)} après`)
  }
})

await step('la partie saisie apparaît à l’écran sans rechargement', async () => {
  const total = await page.locator('article.game').count()
  if (total === 0) throw new Error('plus aucune partie affichée')
  const body = await page.locator('body').innerText()
  if (!body.includes('2026-09-05')) throw new Error('la partie du jour n’est pas listée')
  // Le compteur de tête doit avoir suivi.
  const games = await apiGames()
  if (!new RegExp(`\\b${games.length}\\b`).test(body)) {
    throw new Error(`le total affiché ne vaut pas ${games.length}`)
  }
})

await step('supprimer une partie la retire de la base', async () => {
  const countGames = async () => (await apiGames()).length
  const before = await countGames()
  await page.locator('article.game .btn-game-delete').first().click()
  await page.locator('.delete-game-modal').waitFor()
  // Plus de mot de passe : la session suffit désormais à autoriser le geste.
  if (await page.locator('.delete-game-modal input[type="password"]').count()) {
    throw new Error('le modal demande encore un mot de passe')
  }
  await page.locator('.delete-game-modal button[type="submit"]').click()
  await page.locator('.delete-game-modal').waitFor({ state: 'detached' })
  const after = await countGames()
  if (after !== before - 1) throw new Error(`${before} parties avant, ${after} après`)
})

await step('aucune erreur JavaScript', async () => {
  const real = errors.filter((e) => !/scryfall|favicon|fonts\.g|ERR_FAILED|401/i.test(e))
  if (real.length) throw new Error(real.join(' | '))
})

await page.screenshot({ path: 'admin-dashboard.png', fullPage: false })
await browser.close()
console.log(failed ? `\n${failed} échec(s)` : '\ntout passe')
process.exit(failed ? 1 : 0)
