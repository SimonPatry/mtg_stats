import { randomUUID } from 'node:crypto'

/**
 * Lecture et écriture des decks.
 *
 * Rappel du modèle : une ligne de `decks` est une LIGNÉE (« mon Atraxa »), qui
 * porte l'identité, l'appartenance à un joueur et le contenu de la vitrine.
 * Ce qui change dans le temps — bracket, URL — vit dans `deck_versions`.
 */

const SEP = '|~|'

function commandersOf(row) {
  return row.commanders ? String(row.commanders).split(SEP) : []
}

const DECK_SELECT = `
  SELECT d.*, u.name AS player,
         cur.id AS version_id, cur.version_number, cur.bracket,
         cur.bracket_variation, cur.deck_url, cur.started_on,
         (SELECT GROUP_CONCAT(c.name ORDER BY c.position SEPARATOR '|~|')
            FROM deck_commanders c WHERE c.deck_id = d.id) AS commanders,
         (SELECT GROUP_CONCAT(t.label ORDER BY t.label SEPARATOR '|~|')
            FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id
           WHERE dt.deck_id = d.id) AS tags
    FROM decks d
    JOIN users u ON u.id = d.user_id
    LEFT JOIN deck_versions cur
      ON cur.deck_id = d.id
     AND cur.version_number = (SELECT MAX(v.version_number)
                                 FROM deck_versions v WHERE v.deck_id = d.id)
`

/** Forme rendue par l'API pour un deck, vitrine comprise. */
function shapeDeck(row, commanders = null) {
  const names = commandersOf(row)
  return {
    id: row.id,
    user_id: row.user_id,
    player: row.player,
    name: row.name || '',
    description: row.description || '',
    showcase: Boolean(row.showcase),
    active: Boolean(row.active),
    archived: Boolean(row.archived),
    created_on: row.created_on,
    // Objets { name, set_code, collector_number, image_url } quand fournis ; sinon noms seuls.
    commanders: commanders ?? names.map((name) => ({
      name,
      set_code: '',
      collector_number: '',
      image_url: '',
    })),
    tags: row.tags ? row.tags.split(SEP) : [],
    current_version: row.version_id
      ? {
          id: row.version_id,
          version_number: Number(row.version_number),
          bracket: row.bracket,
          bracket_variation: row.bracket_variation,
          deck_url: row.deck_url || '',
          started_on: row.started_on,
        }
      : null,
  }
}

async function loadCommandersByDeck(cx, deckIds) {
  const byDeck = new Map()
  if (!deckIds.length) return byDeck
  const placeholders = deckIds.map(() => '?').join(',')
  const [rows] = await cx.query(
    `SELECT deck_id, name, set_code, collector_number, image_url
       FROM deck_commanders
      WHERE deck_id IN (${placeholders})
      ORDER BY deck_id, position`,
    deckIds,
  )
  for (const row of rows) {
    if (!byDeck.has(row.deck_id)) byDeck.set(row.deck_id, [])
    byDeck.get(row.deck_id).push({
      name: row.name,
      set_code: row.set_code || '',
      collector_number: row.collector_number || '',
      image_url: row.image_url || '',
    })
  }
  return byDeck
}

export async function listDecks(cx, {
  activeOnly = false,
  withVersions = false,
  includeArchived = false,
} = {}) {
  const where = []
  if (activeOnly) where.push('d.active = TRUE')
  if (!includeArchived) where.push('d.archived = FALSE')
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [rows] = await cx.query(
    `${DECK_SELECT} ${clause} ORDER BY u.name, d.created_on, d.id`)
  const commandersByDeck = await loadCommandersByDeck(cx, rows.map((r) => r.id))
  const decks = rows.map((row) => shapeDeck(row, commandersByDeck.get(row.id) ?? null))
  if (!withVersions) return decks

  // Toutes les versions d'un coup plutôt qu'une requête par deck : la liste
  // complète sert au catalogue de l'administration, qui raisonne sur les
  // lignées ET leurs états successifs.
  const [versions] = await cx.query(
    `SELECT id, deck_id, version_number, bracket, bracket_variation, deck_url, cause, started_on
       FROM deck_versions ORDER BY deck_id, version_number`)
  const byDeck = new Map()
  for (const version of versions) {
    if (!byDeck.has(version.deck_id)) byDeck.set(version.deck_id, [])
    byDeck.get(version.deck_id).push(version)
  }
  return decks.map((deck) => ({ ...deck, versions: byDeck.get(deck.id) ?? [] }))
}

export async function getDeck(cx, id) {
  const [rows] = await cx.query(`${DECK_SELECT} WHERE d.id = ?`, [id])
  if (rows.length === 0) return null

  const deck = shapeDeck(rows[0])
  const [versions] = await cx.query(
    `SELECT id, version_number, bracket, bracket_variation, deck_url, cause, started_on
       FROM deck_versions WHERE deck_id = ? ORDER BY version_number`, [id])
  const [commanders] = await cx.query(
    `SELECT name, set_code, collector_number, image_url FROM deck_commanders
      WHERE deck_id = ? ORDER BY position`, [id])
  const [colors] = await cx.query(
    `SELECT c.code FROM deck_colors dc JOIN colors c ON c.code = dc.color_code
      WHERE dc.deck_id = ? ORDER BY c.position`, [id])
  const [tags] = await cx.query(
    `SELECT t.id, t.label FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id
      WHERE dt.deck_id = ? ORDER BY t.label`, [id])

  return {
    ...deck,
    commanders: commanders.map((c) => ({ ...c })),
    versions,
    colors: colors.map((c) => c.code),
    tags: tags.map((t) => t.label),
    tag_ids: tags.map((t) => t.id),
    slider: await readSlider(cx, id),
    inspirations: await readInspirations(cx, id),
  }
}

async function readInspirations(cx, deckId) {
  const [rows] = await cx.query(
    `SELECT url, label FROM deck_inspirations
      WHERE deck_id = ? ORDER BY position`,
    [deckId],
  )
  return rows.map((r) => ({
    url: r.url || '',
    label: r.label || '',
  }))
}

async function readSlider(cx, deckId) {
  const [sections] = await cx.query(
    'SELECT id, title FROM slider_sections WHERE deck_id = ? ORDER BY position', [deckId])
  const out = []
  for (const section of sections) {
    const [cards] = await cx.query(
      `SELECT name, set_code, collector_number, image_url
         FROM slider_cards WHERE section_id = ? ORDER BY position`, [section.id])
    out.push({
      title: section.title,
      cards: cards.map((c) => ({
        name: c.name,
        set_code: c.set_code || '',
        collector_number: c.collector_number || '',
        image_url: c.image_url || '',
      })),
    })
  }
  return out
}

/** Écrit commandants, couleurs, tags et carrousels — réécriture en bloc. */
async function writeRelations(cx, deckId, input) {
  await cx.execute('DELETE FROM deck_commanders WHERE deck_id = ?', [deckId])
  for (const [index, commander] of input.commanders.entries()) {
    await cx.execute(
      `INSERT INTO deck_commanders
         (deck_id, position, name, set_code, collector_number, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [deckId, index + 1, commander.name,
       String(commander.set_code ?? '').toLowerCase(),
       commander.collector_number ?? '',
       String(commander.image_url ?? '').slice(0, 500)])
  }

  await cx.execute('DELETE FROM deck_colors WHERE deck_id = ?', [deckId])
  for (const code of new Set(input.colors ?? [])) {
    await cx.execute('INSERT INTO deck_colors (deck_id, color_code) VALUES (?, ?)', [deckId, code])
  }

  await cx.execute('DELETE FROM deck_tags WHERE deck_id = ?', [deckId])
  for (const tagId of new Set(input.tag_ids ?? [])) {
    await cx.execute('INSERT INTO deck_tags (deck_id, tag_id) VALUES (?, ?)', [deckId, tagId])
  }

  // Les cartes suivent les sections par ON DELETE CASCADE.
  await cx.execute('DELETE FROM slider_sections WHERE deck_id = ?', [deckId])
  for (const [si, section] of (input.slider ?? []).entries()) {
    const sectionId = randomUUID()
    await cx.execute(
      'INSERT INTO slider_sections (id, deck_id, title, position) VALUES (?, ?, ?, ?)',
      [sectionId, deckId, section.title, si])
    for (const [ci, card] of section.cards.entries()) {
      await cx.execute(
        `INSERT INTO slider_cards
           (id, section_id, name, set_code, collector_number, image_url, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          sectionId,
          card.name,
          String(card.set_code ?? '').toLowerCase(),
          card.collector_number ?? '',
          String(card.image_url ?? '').slice(0, 500),
          ci,
        ])
    }
  }

  await cx.execute('DELETE FROM deck_inspirations WHERE deck_id = ?', [deckId])
  for (const [index, item] of (input.inspirations ?? []).entries()) {
    const url = String(item.url ?? '').trim()
    if (!url) continue
    await cx.execute(
      `INSERT INTO deck_inspirations (id, deck_id, url, label, position)
       VALUES (?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        deckId,
        url.slice(0, 500),
        String(item.label ?? '').trim().slice(0, 120),
        index,
      ],
    )
  }
}

export async function createDeck(cx, input, firstVersion) {
  const id = randomUUID()

  const archived = Boolean(input.archived)
  const showcase = archived ? false : Boolean(input.showcase)
  await cx.execute(
    `INSERT INTO decks (id, user_id, name, description, showcase, active, archived, created_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.user_id, input.name, input.description, showcase,
     input.active, archived, input.created_on])
  await writeRelations(cx, id, input)

  await addVersion(cx, id, {
    ...firstVersion,
    cause: 'initial',
    started_on: firstVersion?.started_on ?? input.created_on ?? new Date().toISOString().slice(0, 10),
  })
  return id
}

export async function updateDeck(cx, id, input) {
  const archived = Boolean(input.archived)
  const showcase = archived ? false : Boolean(input.showcase)
  const [result] = await cx.execute(
    `UPDATE decks SET user_id = ?, name = ?, description = ?, showcase = ?,
                      active = ?, archived = ?, created_on = ?
      WHERE id = ?`,
    [input.user_id, input.name, input.description, showcase,
     input.active, archived, input.created_on, id])
  if (result.affectedRows === 0) return false
  await writeRelations(cx, id, input)
  return true
}

export async function deleteDeck(cx, id) {
  // Refusé si des parties référencent une de ses versions : effacer un deck
  // ne doit jamais amputer l'historique. On désactive dans ce cas.
  const [[{ used }]] = await cx.query(
    `SELECT COUNT(*) AS used FROM game_seats s
       JOIN deck_versions v ON v.id = s.deck_version_id WHERE v.deck_id = ?`, [id])
  if (Number(used) > 0) return { deleted: false, used: Number(used) }
  const [result] = await cx.execute('DELETE FROM decks WHERE id = ?', [id])
  return { deleted: result.affectedRows > 0, used: 0 }
}

/** Ajoute une version à une lignée et rend son identifiant. */
export async function addVersion(cx, deckId, input) {
  const [[{ next }]] = await cx.query(
    'SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM deck_versions WHERE deck_id = ?',
    [deckId])
  const id = randomUUID()
  await cx.execute(
    `INSERT INTO deck_versions (id, deck_id, version_number, bracket, bracket_variation,
                                deck_url, cause, started_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, deckId, next, input?.bracket ?? null, input?.bracket_variation ?? null,
     input?.deck_url ?? '', input?.cause ?? 'newVersion', input.started_on])
  return { id, version_number: Number(next) }
}

/** Corrige une version existante (faute de frappe sur un bracket, URL changée). */
export async function updateVersion(cx, deckId, versionId, input) {
  const [result] = await cx.execute(
    `UPDATE deck_versions
        SET bracket = ?, bracket_variation = ?, deck_url = ?, cause = ?, started_on = ?
      WHERE id = ? AND deck_id = ?`,
    [input.bracket ?? null, input.bracket_variation ?? null, input.deck_url ?? '',
     input.cause ?? 'newVersion', input.started_on, versionId, deckId])
  return result.affectedRows > 0
}

/**
 * Decks de la vitrine publique. Aucune donnée de joueur ni de statistique :
 * cette route est ouverte, elle ne renvoie que ce qui est destiné à être vu.
 */
export async function listShowcase(cx) {
  const [rows] = await cx.query(`
    SELECT d.id, d.name, d.description,
           u.name AS author,
           cur.deck_url,
           (SELECT GROUP_CONCAT(c.name ORDER BY c.position SEPARATOR '|~|')
              FROM deck_commanders c WHERE c.deck_id = d.id) AS commanders,
           (SELECT c.set_code
              FROM deck_commanders c WHERE c.deck_id = d.id AND c.position = 1) AS set_code,
           (SELECT c.collector_number
              FROM deck_commanders c WHERE c.deck_id = d.id AND c.position = 1) AS collector_number,
           (SELECT c.image_url
              FROM deck_commanders c WHERE c.deck_id = d.id AND c.position = 1) AS image_url,
           (SELECT GROUP_CONCAT(col.code ORDER BY col.position SEPARATOR '')
              FROM deck_colors dc JOIN colors col ON col.code = dc.color_code
             WHERE dc.deck_id = d.id) AS colors,
           (SELECT GROUP_CONCAT(t.label ORDER BY t.label SEPARATOR '|~|')
              FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id
             WHERE dt.deck_id = d.id) AS tags
      FROM decks d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN deck_versions cur
        ON cur.deck_id = d.id
       AND cur.version_number = (SELECT MAX(v.version_number)
                                   FROM deck_versions v WHERE v.deck_id = d.id)
     WHERE d.showcase = TRUE AND d.active = TRUE AND d.archived = FALSE
     -- Ordre automatique : le plus récent d'abord. C'est ce rang qui donne à
     -- chaque bande sa couleur et son côté d'illustration côté vitrine ; il
     -- n'y a plus de position à régler à la main.
     ORDER BY COALESCE(d.created_on, DATE(d.created_at)) DESC, d.created_at DESC, d.id
  `)

  const out = []
  for (const row of rows) {
    out.push({
      id: row.id,
      name: row.name || commandersOf(row)[0] || 'Deck',
      description: row.description || '',
      author: row.author || '',
      commander: commandersOf(row)[0] ?? '',
      commanders: commandersOf(row),
      set_code: row.set_code || '',
      collector_number: row.collector_number || '',
      image_url: row.image_url || '',
      link: row.deck_url || '',
      colors: row.colors ? row.colors.split('') : [],
      tags: row.tags ? row.tags.split(SEP) : [],
      slider: await readSlider(cx, row.id),
      inspirations: await readInspirations(cx, row.id),
    })
  }
  return out
}
