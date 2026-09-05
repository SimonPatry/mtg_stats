import { chromium } from 'playwright'
const CARD = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="500" height="700" fill="#2a3b52"/></svg>').toString('base64')

// Même script pour les deux configurations : Vite en développement, Express
// seul en production (BASE_URL=http://localhost:3000).
const BASE = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
const PASSWORD = process.env.ADMIN_PASSWORD || 'motdepasse-test'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.setDefaultTimeout(10000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.route('**://api.scryfall.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ name: 'X', scryfall_uri: 'https://scryfall.com/card/x/1', image_uris: { normal: CARD } }) }))
await page.route('**://svgs.scryfall.io/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }))
await page.route('**://fonts.g**', (r) => r.abort())

const requests = []
page.on('request', (r) => requests.push(r.url()))
let failed = 0
const step = async (label, fn) => {
  try { await fn(); console.log(`OK   ${label}`) }
  catch (e) { failed += 1; console.log(`FAIL ${label} :: ${e.message.split('\n')[0]}`) }
}

/**
 * La vitrine ne montre que les decks marqués `showcase`, et le jeu de test
 * importé n'en a aucun : c'est une décision de création, pas une donnée de
 * partie. Le test fabrique donc ses propres decks vitrine puis les retire, ce
 * qui le rend rejouable quel que soit le contenu de la base.
 */
const API = (process.env.API_URL || BASE).replace(/\/$/, '')
let session = ''
const api = async (path, options = {}) => {
  const res = await fetch(`${API}/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(session ? { cookie: session } : {}), ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const set = res.headers.getSetCookie?.().find((c) => c.startsWith('mtg_session='))
  if (set) session = set.split(';')[0]
  const text = await res.text()
  if (!res.ok) throw new Error(`${options.method ?? 'GET'} ${path} → ${res.status} ${text.slice(0, 120)}`)
  return text ? JSON.parse(text) : null
}

await api('/auth/login', { method: 'POST', body: { password: PASSWORD } })
const [owner] = await api('/users')
const fixtures = []
for (const [i, name] of ['Deck 1', 'Deck 2', 'Deck 3'].entries()) {
  const deck = await api('/decks', {
    method: 'POST',
    body: {
      deck: {
        user_id: owner.id,
        name,
        description: `Un deck de démonstration autour de [Sol Ring] et [Mana Crypt].`,
        showcase: true,
        colors: ['U', 'B'],
        commanders: [{ name: `Commandant ${i + 1}` }],
        slider: [{ title: 'Pièces maîtresses', cards: [{ name: 'Sol Ring' }] }],
      },
      version: { bracket: 3, started_on: '2026-01-01' },
    },
  })
  fixtures.push(deck.id)
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })

await step('la vitrine affiche les decks marqués showcase', async () => {
  await page.locator('.deck-band').first().waitFor()
  const n = await page.locator('.deck-band').count()
  if (n !== 3) throw new Error(`attendu 3 bandes, obtenu ${n}`)
})

await step('les données viennent bien de l’API', async () => {
  if (!requests.some((u) => u.includes('/api/showcase/decks'))) throw new Error('aucun appel à /api/showcase/decks')
})

await step('aucune requête d’authentification sur la vitrine', async () => {
  if (requests.some((u) => u.includes('/api/auth/me'))) throw new Error('la vitrine interroge l’authentification')
})

await step('le code de l’admin n’est pas chargé', async () => {
  if (requests.some((u) => /AdminApp|index\.css\?/i.test(u) && !u.includes('site'))) {
    const bad = requests.find((u) => /AdminApp/i.test(u))
    if (bad) throw new Error('module admin chargé : ' + bad)
  }
})

await step('la référence [Sol Ring] devient un élément survolable', async () => {
  const n = await page.locator('.deck-banner__card-ref').count()
  if (n === 0) throw new Error('aucune référence de carte rendue')
  const text = await page.locator('.deck-banner__card-ref').first().textContent()
  if (text.includes('[')) throw new Error('crochets non retirés')
})

await step('aperçu au survol', async () => {
  await page.locator('.deck-banner__card-ref').first().hover()
  await page.locator('.deck-card-preview').waitFor({ state: 'visible' })
  await page.mouse.move(0, 0)
})

await step('menu burger : ouverture et filtre', async () => {
  await page.locator('.site-header__menu-toggle').click()
  await page.locator('.deck-menu.is-open').waitFor()
  if ((await page.locator('.deck-menu__link').count()) !== 3) throw new Error('3 liens attendus')
  await page.locator('.deck-menu__search-input').fill('Deck 2')
  await page.waitForTimeout(200)
  if ((await page.locator('.deck-menu__link').count()) !== 1) throw new Error('filtre inopérant')
  await page.locator('.deck-menu__close').click()
})

await step('le bouton Admin de la vitrine mène à la connexion', async () => {
  // Sans rechargement, et sans avoir chargé le paquet admin avant le clic.
  if (requests.some((u) => /AdminApp/i.test(u))) {
    throw new Error('le module admin était déjà chargé avant le clic')
  }
  await page.locator('.site-header__admin').click()
  await page.locator('.admin-login').waitFor()
  if (new URL(page.url()).pathname !== '/admin') {
    throw new Error(`URL après clic : ${page.url()}`)
  }
})

await step('la page de connexion ramène à la vitrine', async () => {
  await page.locator('.admin-login__back').click()
  await page.locator('.deck-band').first().waitFor()
  if (new URL(page.url()).pathname !== '/') {
    throw new Error(`URL après retour : ${page.url()}`)
  }
})

await step('/admin charge l’administration à la demande et demande le mot de passe', async () => {
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type=password]').waitFor()
  if (!requests.some((u) => /AdminApp/i.test(u))) throw new Error('le module admin n’a pas été chargé')
})

await step('connexion puis affichage du tableau de bord', async () => {
  await page.locator('input[type=password]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrer' }).click()
  await page.waitForTimeout(1500)
  const body = await page.locator('body').innerText()
  if (/Mot de passe incorrect/.test(body)) throw new Error('connexion refusée')
})

for (const id of fixtures) {
  await api(`/decks/${id}`, { method: 'DELETE' }).catch(() => {})
}

console.log(errors.length ? `\nErreurs JS :\n${errors.slice(0, 5).join('\n')}` : '\nAucune erreur JS.')
await browser.close()
console.log(failed ? `${failed} échec(s)` : 'tout passe')
process.exit(failed ? 1 : 0)
