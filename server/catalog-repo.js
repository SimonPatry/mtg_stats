import { randomUUID } from 'node:crypto'

/** Joueurs, tags et référentiels — les petites tables du catalogue. */

export async function listUsers(cx) {
  const [rows] = await cx.query(`
    SELECT u.id, u.name, u.active, u.account_id,
           a.username AS account_username, a.role AS account_role,
           (SELECT COUNT(*) FROM decks d WHERE d.user_id = u.id) AS deck_count
      FROM users u
      LEFT JOIN accounts a ON a.id = u.account_id
     ORDER BY u.name`)
  return rows.map((r) => ({
    ...r,
    active: Boolean(r.active),
    deck_count: Number(r.deck_count),
  }))
}

export async function createUser(cx, input) {
  const id = randomUUID()
  await cx.execute(
    'INSERT INTO users (id, name, active, account_id) VALUES (?, ?, ?, ?)',
    [id, input.name, input.active !== false, input.account_id ?? null],
  )
  return id
}

/** Crée (ou réactive) le joueur roster pour un compte d'auth. */
export async function ensurePlayerForAccount(cx, { accountId, username }) {
  const [existing] = await cx.query(
    'SELECT id, name, active FROM users WHERE account_id = ? LIMIT 1',
    [accountId],
  )
  if (existing[0]) {
    if (!existing[0].active) {
      await cx.execute('UPDATE users SET active = TRUE WHERE id = ?', [existing[0].id])
    }
    return existing[0].id
  }

  // Nom d'affichage = username ; collision rare → suffixe.
  let name = username
  const clash = await findUserByName(cx, name)
  if (clash && clash.account_id !== accountId) {
    name = `${username}-${accountId.slice(0, 8)}`
  }

  return createUser(cx, { name, active: true, account_id: accountId })
}

export async function findUserByAccountId(cx, accountId) {
  const [rows] = await cx.query('SELECT * FROM users WHERE account_id = ? LIMIT 1', [accountId])
  return rows[0] ?? null
}

export async function updateUser(cx, id, input) {
  const [result] = await cx.execute('UPDATE users SET name = ?, active = ? WHERE id = ?',
    [input.name, input.active, id])
  return result.affectedRows > 0
}

export async function findUserByName(cx, name) {
  const [rows] = await cx.query('SELECT * FROM users WHERE name = ?', [name])
  return rows[0] ?? null
}

/** Un joueur n'est jamais supprimé s'il possède des decks : on le désactive. */
export async function deleteUser(cx, id) {
  const [[{ decks }]] = await cx.query('SELECT COUNT(*) AS decks FROM decks WHERE user_id = ?', [id])
  if (Number(decks) > 0) return { deleted: false, decks: Number(decks) }
  const [result] = await cx.execute('DELETE FROM users WHERE id = ?', [id])
  return { deleted: result.affectedRows > 0, decks: 0 }
}

export async function listTags(cx) {
  const [rows] = await cx.query(`
    SELECT t.id, t.label,
           (SELECT COUNT(*) FROM deck_tags dt WHERE dt.tag_id = t.id) AS deck_count
      FROM tags t ORDER BY t.label`)
  return rows.map((r) => ({ ...r, deck_count: Number(r.deck_count) }))
}

export async function createTag(cx, label) {
  const id = randomUUID()
  await cx.execute('INSERT INTO tags (id, label) VALUES (?, ?)', [id, label])
  return id
}

export async function updateTag(cx, id, label) {
  const [result] = await cx.execute('UPDATE tags SET label = ? WHERE id = ?', [label, id])
  return result.affectedRows > 0
}

export async function findTagByLabel(cx, label) {
  const [rows] = await cx.query('SELECT * FROM tags WHERE label = ?', [label])
  return rows[0] ?? null
}

export async function countDecksForTag(cx, id) {
  const [[{ n }]] = await cx.query('SELECT COUNT(*) AS n FROM deck_tags WHERE tag_id = ?', [id])
  return Number(n)
}

/** Le détachement des decks se fait par ON DELETE CASCADE sur deck_tags. */
export async function deleteTag(cx, id) {
  const [result] = await cx.execute('DELETE FROM tags WHERE id = ?', [id])
  return result.affectedRows > 0
}

/**
 * Référentiels lus par les listes déroulantes du front : couleurs, styles de
 * victoire et de mort. Une seule requête au chargement plutôt que des
 * constantes dupliquées dans le code.
 */
export async function readReference(cx) {
  const [colors] = await cx.query('SELECT code, label FROM colors ORDER BY position')
  const [winStyles] = await cx.query('SELECT id, label FROM win_styles ORDER BY position')
  const [killStyles] = await cx.query('SELECT id, label FROM kill_styles ORDER BY position')
  return { colors, win_styles: winStyles, kill_styles: killStyles }
}
