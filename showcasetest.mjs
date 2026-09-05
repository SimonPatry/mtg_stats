/**
 * La fusion des deux gestions de deck, de bout en bout.
 *
 * On crée un deck vitrine depuis le roster, on vérifie qu'il apparaît sur le
 * site public avec son habillage, puis on le rouvre pour ajouter un carrousel
 * et on le retire de la vitrine. Ce sont les deux faces du même deck : la face
 * statistiques ne doit jamais bouger quand on touche à la face vitrine.
 */
import { chromium } from 'playwright'

const BASE = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '')
const PASSWORD = process.env.ADMIN_PASSWORD || 'mot-de-passe-de-test'
const CARD = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="500" height="700" fill="#2a3b52"/></svg>').toString('base64')

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
page.setDefaultTimeout(15000)

const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

/**
 * Scryfall est simulé : le sélecteur de commandant filtre les résultats sur le
 * type de carte, il faut donc une carte plausible et non un objet vide.
 */
const FAKE_CARD = {
  name: 'Atraxa, Praetors’ Voice',
  type_line: 'Legendary Creature — Phyrexian Angel Horror',
  oracle_text: 'Flying, vigilance, deathtouch, lifelink',
  keywords: [],
  image_uris: { small: CARD, normal: CARD, large: CARD },
  scryfall_uri: 'https://scryfall.com/card/x/1',
  set: 'c16',
  collector_number: '28',
  set_name: 'Commander 2016',
  id: 'fake-atraxa',
  oracle_id: 'fake-oracle',
}
await page.route('**://api.scryfall.com/cards/autocomplete**', (r) => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ data: ['Sol Ring', 'Solemn Simulacrum'] }) }))
await page.route('**://api.scryfall.com/**', (r) => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ ...FAKE_CARD, data: [FAKE_CARD] }) }))

// La recherche répond selon le terme demandé : sans cela le test du
// sélecteur de cartes se contenterait de retrouver Atraxa quoi qu'on tape.
await page.route('**://api.scryfall.com/cards/search**', (r) => {
  const q = decodeURIComponent(new URL(r.request().url()).searchParams.get('q') || '')
  const name = /sol ring/i.test(q) ? 'Sol Ring' : FAKE_CARD.name
  return r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: [{ ...FAKE_CARD, name }] }) })
})
await page.route('**://svgs.scryfall.io/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }))
await page.route('**://api.dicebear.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }))
await page.route('**://fonts.g**', (r) => r.abort())

let failed = 0
const step = async (label, fn) => {
  try { await fn(); console.log(`OK   ${label}`) }
  catch (e) { failed += 1; console.log(`FAIL ${label} :: ${process.env.VERBOSE ? e.message : e.message.split('\n')[0]}`) }
}

const TITLE = 'Le Jardin de Test'
let cookie = ''
const apiGet = async (path) =>
  (await (await fetch(`${API}/api${path}`, { headers: { cookie } })).json())

await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
await page.fill('input[type="password"]', PASSWORD)
await page.locator('form button[type="submit"]').click()
await page.locator('input[type="password"]').waitFor({ state: 'detached' })
await page.waitForTimeout(1500)
cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ')

/**
 * Le test crée des données ; il doit pouvoir tourner deux fois de suite. On
 * efface donc ce qu'une exécution précédente aurait laissé, avant de commencer.
 */
const cleanup = async () => {
  const decks = await apiGet('/decks?versions=1')
  for (const deck of decks.filter((d) => d.name === TITLE)) {
    await fetch(`${API}/api/decks/${deck.id}`, { method: 'DELETE', headers: { cookie } })
  }
  const tags = await apiGet('/tags')
  for (const tag of tags.filter((t) => t.label === 'Test Combo')) {
    await fetch(`${API}/api/tags/${tag.id}?confirm_detach=1`, { method: 'DELETE', headers: { cookie } })
  }
}
await cleanup()
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)

await step('l’onglet Tags existe et l’écran s’ouvre', async () => {
  await page.locator('.top-bar-nav button', { hasText: 'Tags' }).click()
  await page.locator('.tag-admin').waitFor()
  await page.locator('.tag-admin-add input').fill('Test Combo')
  await page.locator('.tag-admin-add button').click()
  await page.locator('.tag-admin-row', { hasText: 'Test Combo' }).waitFor()
})

await step('le bouton de déconnexion est présent', async () => {
  if (await page.locator('.top-bar-logout').count() === 0) {
    throw new Error('aucun bouton de déconnexion dans la barre du haut')
  }
})

await step('le formulaire d’ajout de deck cache la vitrine par défaut', async () => {
  await page.locator('.top-bar-nav button', { hasText: 'Joueurs & decks' }).click()
  await page.locator('.players-manager').waitFor()
  await page.locator('.showcase-fields').first().waitFor()
  if (await page.locator('.showcase-fields-body').count() > 0) {
    throw new Error('les champs vitrine sont dépliés alors que la case est décochée')
  }
})

await step('cocher « afficher sur le site » déplie titre, couleurs et tags', async () => {
  const form = page.locator('.players-form').last()
  await form.locator('.showcase-fields input[type="checkbox"]').check()
  await form.locator('.showcase-fields-body').waitFor()
  await form.locator('.chip', { hasText: 'Bleu' }).waitFor()
  await form.locator('.tag-picker').waitFor()
})

await step('créer un deck vitrine depuis le roster', async () => {
  const form = page.locator('.players-form').last()
  const userSelect = form.locator('select').first()
  const [userId] = await userSelect.evaluate((el) =>
    [...el.options].filter((o) => o.value).map((o) => o.value))
  await userSelect.selectOption(userId)

  // Le commandant se choisit dans la liste Scryfall : taper ne suffit pas.
  await form.locator('input[type="search"]').first().fill('Atraxa')
  // Le sélecteur débounce puis sérialise ses appels : on attend un vrai
  // résultat, pas la ligne « Recherche… ».
  await form.locator('.commander-picker-dropdown .commander-picker-option:not(.muted)')
    .first().click({ timeout: 20000 })
  await form.locator('.showcase-fields input[type="text"]').first().fill(TITLE)
  await form.locator('.showcase-fields textarea').fill('Un deck de test autour de [Sol Ring].')
  await form.locator('.chip', { hasText: 'Bleu' }).click()
  await form.locator('.chip', { hasText: 'Noir' }).click()
  await form.locator('.tag-picker select').selectOption({ label: 'Test Combo' })

  // Deux <select> dans ce formulaire : le joueur, puis le bracket.
  await form.locator('select').nth(1).selectOption('3')

  const submit = form.locator('button[type="submit"]')
  await submit.waitFor()
  if (await submit.isDisabled()) {
    throw new Error('le bouton reste désactivé : un champ requis n’a pas été rempli')
  }
  await submit.click()
  await page.waitForTimeout(2500)

  const decks = await apiGet('/decks?versions=1')
  const created = decks.find((d) => d.name === TITLE)
  if (!created) throw new Error('le deck créé est introuvable dans l’API')
  if (!created.showcase) throw new Error('le deck n’est pas marqué vitrine')

  // Couleurs et tags ne sont pas dans la projection de liste : on les relit sur
  // la fiche complète, celle que sert l'écran d'édition.
  const full = await apiGet(`/decks/${created.id}`)
  if (full.colors.join('') !== 'UB') throw new Error(`couleurs enregistrées : ${full.colors}`)
  if (!full.tags.includes('Test Combo')) throw new Error(`tags enregistrés : ${full.tags}`)
})

await step('le deck apparaît sur la vitrine publique, en tête', async () => {
  const showcase = await (await fetch(`${API}/api/showcase/decks`)).json()
  if (showcase.length === 0) throw new Error('la vitrine est vide')
  if (showcase[0].name !== TITLE) {
    throw new Error(`en tête de vitrine : « ${showcase[0].name} », attendu « ${TITLE} »`)
  }
  if (showcase[0].colors.join('') !== 'UB') {
    throw new Error(`couleurs servies : ${showcase[0].colors}`)
  }
})

await step('la vitrine le rend dans le navigateur', async () => {
  const site = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await site.route('**://api.scryfall.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ name: 'X', scryfall_uri: 'u', image_uris: { normal: CARD } }) }))
  await site.route('**://svgs.scryfall.io/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }))
  await site.route('**://fonts.g**', (r) => r.abort())
  await site.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await site.locator('.deck-band').first().waitFor()
  const text = await site.locator('body').innerText()
  if (!text.includes(TITLE)) throw new Error('le titre n’apparaît pas sur la vitrine')
  await site.close()
})

await step('rouvrir le deck montre ses champs vitrine remplis', async () => {
  await page.locator('.roster-deck-card', { hasText: 'Atraxa' }).first()
    .locator('.roster-deck-edit').click()
  await page.locator('.deck-edit-modal').waitFor()
  await page.locator('.deck-edit-showcase-fields').waitFor()
  const title = await page.locator('.deck-edit-showcase-fields input[type="text"]').first().inputValue()
  if (title !== TITLE) throw new Error(`titre relu : « ${title} »`)
})

await step('ajouter un carrousel depuis l’édition', async () => {
  await page.locator('.slider-editor button', { hasText: '+ Ajouter une section' }).click()
  await page.locator('.slider-section input').first().fill('Rampe')
  // La carte se choisit dans une liste illustrée, comme un commandant.
  const field = page.locator('.slider-card-line .card-picker input').first()
  const option = page.locator('.card-picker-option').first()
  await field.fill('Sol Ring')
  await option.waitFor({ timeout: 20000 })
  if (await option.locator('img').count() === 0) {
    throw new Error('la suggestion n’affiche pas de vignette')
  }

  // Échap, liste ouverte, ne ferme que la liste — pas le modal ni la saisie.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  if (await page.locator('.deck-edit-modal').count() === 0) {
    throw new Error('Échap a refermé le modal au lieu de la seule liste de suggestions')
  }
  if (await page.locator('.card-picker-option').count() !== 0) {
    throw new Error('la liste de suggestions est restée ouverte')
  }

  // Le champ a gardé le focus : c'est le clic qui rouvre la liste.
  await field.click()
  await option.waitFor({ timeout: 20000 })
  await option.click()
  const chosen = await field.inputValue()
  if (chosen !== 'Sol Ring') throw new Error(`carte retenue : « ${chosen} »`)
  await page.locator('.deck-edit-modal button[type="submit"]').click()
  await page.locator('.deck-edit-modal').waitFor({ state: 'detached', timeout: 20000 })
    .catch(async () => {
      const msg = await page.locator('.deck-edit-modal .form-error').first()
        .innerText().catch(() => '(aucun message)')
      const vals = await page.locator('.slider-section input')
        .evaluateAll((els) => els.map((e) => `${e.className}="${e.value}"`))
      throw new Error(`le modal ne se referme pas — ${msg} | champs : ${vals.join(' ; ')}`)
    })
  await page.waitForTimeout(1500)

  const decks = await apiGet('/decks?versions=1')
  const deck = decks.find((d) => d.name === TITLE)
  const full = await apiGet(`/decks/${deck.id}`)
  if (full.slider.length !== 1) throw new Error(`${full.slider.length} section(s) enregistrée(s)`)
  if (full.slider[0].title !== 'Rampe') throw new Error(`titre de section : ${full.slider[0].title}`)
  if (full.slider[0].cards[0]?.name !== 'Sol Ring') {
    throw new Error(`carte enregistrée : ${full.slider[0].cards[0]?.name}`)
  }
})

await step('un tag créé dans le modal est proposé ailleurs sans rechargement', async () => {
  // Le vocabulaire appartient à l'écran, pas au modal : sans cela le
  // formulaire de création gardait la liste qu'il avait chargée à l'ouverture.
  const label = `Test Volatile ${Date.now().toString().slice(-5)}`
  await page.locator('.roster-deck-edit').first().click()
  await page.locator('.deck-edit-modal').waitFor()
  await page.waitForTimeout(1200)
  await page.locator('.deck-edit-showcase input[type="checkbox"]').check()
  await page.locator('.deck-edit-modal .tag-picker input[type="text"]').fill(label)
  await page.locator('.deck-edit-modal .tag-picker button', { hasText: 'Créer' }).click()
  await page.waitForTimeout(1200)
  await page.locator('.deck-edit-modal .btn-icon').click()
  await page.locator('.deck-edit-modal').waitFor({ state: 'detached' })

  // Le bloc vitrine du formulaire de création s'est replié après l'ajout.
  const box = page.locator('.players-form-deck .showcase-fields input[type="checkbox"]')
  if (!(await box.isChecked())) await box.check()
  await page.locator('.players-form-deck .tag-picker').waitFor()

  const offered = await page.locator('.players-form-deck .tag-picker select')
    .evaluate((el) => [...el.options].map((o) => o.textContent))
  if (!offered.some((o) => o.includes(label))) {
    throw new Error(`« ${label} » absent du formulaire de création : ${offered.join(', ')}`)
  }

  // Ménage : ce tag n'a servi qu'à ce test.
  const tags = await apiGet('/tags')
  for (const tag of tags.filter((t) => t.label === label)) {
    await fetch(`${API}/api/tags/${tag.id}?confirm_detach=1`, { method: 'DELETE', headers: { cookie } })
  }
})

await step('la face statistiques n’a pas bougé', async () => {
  const decks = await apiGet('/decks?versions=1')
  const deck = decks.find((d) => d.name === TITLE)
  const current = deck.versions[deck.versions.length - 1]
  if (Number(current.bracket) !== 3) throw new Error(`bracket : ${current.bracket}`)
  if (deck.versions.length !== 1) {
    throw new Error(`${deck.versions.length} versions — éditer la vitrine en a créé une`)
  }
})

await step('aucune erreur JavaScript', async () => {
  const real = errors.filter((e) => !/scryfall|dicebear|favicon|fonts\.g|ERR_FAILED|401|409/i.test(e))
  if (real.length) throw new Error(real.join(' | '))
})

await cleanup()
await browser.close()
console.log(failed ? `\n${failed} échec(s)` : '\ntout passe')
process.exit(failed ? 1 : 0)
