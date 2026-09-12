import mysql from 'mysql2/promise'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dbConfig } from './env.js'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = join(here, '..', 'db')

/**
 * Accès MariaDB. Un pool, pas une connexion : les requêtes concurrentes d'une
 * page de statistiques ne doivent pas se sérialiser.
 *
 * `namedPlaceholders` permet d'écrire :contenu dans le SQL plutôt que des ?
 * positionnels — sur des insertions à quinze colonnes, ça évite les décalages
 * silencieux.
 */
export function createPool(overrides = {}) {
  return mysql.createPool({
    ...dbConfig,
    ...overrides,
    namedPlaceholders: true,
    dateStrings: true, // les DATE restent des 'YYYY-MM-DD', pas des objets Date
    charset: 'utf8mb4',
    connectionLimit: 10,
  })
}

export const pool = createPool()

/** Exécute un fichier .sql du dossier db/ (plusieurs instructions). */
export async function runSqlFile(connection, filename) {
  const sql = readFileSync(join(dbDir, filename), 'utf8')
  await connection.query({ sql, multipleStatements: true })
}

/**
 * Crée les tables si besoin, puis garantit les référentiels.
 * Idempotent : appelé au démarrage du serveur comme au début des tests.
 */
export async function migrate(target = pool) {
  const connection = await mysql.createConnection({
    ...target.config?.connectionConfig ?? dbConfig,
    multipleStatements: true,
  })
  try {
    await runSqlFile(connection, 'schema.sql')
    await ensureUsersAccountLink(connection)
    await ensureDecksArchivedColumn(connection)
    await ensureSliderCardsPrintColumns(connection)
    await ensureCardImageUrlColumns(connection)
    await ensureDeckInspirationsTable(connection)
    await runSqlFile(connection, 'seed.sql')
  } finally {
    await connection.end()
  }
}

/** Bases créées avant la table des liens d'inspiration vitrine. */
async function ensureDeckInspirationsTable(connection) {
  const [rows] = await connection.query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'deck_inspirations'
  `)
  if (rows.length > 0) return
  await connection.query(`
    CREATE TABLE deck_inspirations (
      id       CHAR(36)     NOT NULL PRIMARY KEY,
      deck_id  CHAR(36)     NOT NULL,
      url      VARCHAR(500) NOT NULL,
      label    VARCHAR(120) NOT NULL DEFAULT '',
      position INT          NOT NULL,
      CONSTRAINT fk_deck_inspirations_deck FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
      KEY idx_deck_inspirations_deck (deck_id, position)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

/**
 * Bases déjà créées avant image_url sur deck_commanders / slider_cards.
 * Sans cette colonne, la vitrine rappelle Scryfall à chaque visite.
 */
async function ensureCardImageUrlColumns(connection) {
  for (const table of ['deck_commanders', 'slider_cards']) {
    const [cols] = await connection.query(
      `
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = 'image_url'
    `,
      [table],
    )
    if (cols.length > 0) continue
    const after = table === 'slider_cards' ? 'collector_number' : 'collector_number'
    await connection.query(
      `ALTER TABLE ${table}
         ADD COLUMN image_url VARCHAR(500) NOT NULL DEFAULT '' AFTER ${after}`,
    )
  }
}

/** Bases déjà créées avant set_code / collector_number sur slider_cards. */
async function ensureSliderCardsPrintColumns(connection) {
  const [cols] = await connection.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'slider_cards'
       AND COLUMN_NAME IN ('set_code', 'collector_number')
  `)
  const have = new Set(cols.map((c) => c.COLUMN_NAME))
  if (!have.has('set_code')) {
    await connection.query(
      "ALTER TABLE slider_cards ADD COLUMN set_code VARCHAR(10) NOT NULL DEFAULT '' AFTER name",
    )
  }
  if (!have.has('collector_number')) {
    await connection.query(
      "ALTER TABLE slider_cards ADD COLUMN collector_number VARCHAR(20) NOT NULL DEFAULT '' AFTER set_code",
    )
  }
}

/** Bases déjà créées avant la colonne decks.archived. */
async function ensureDecksArchivedColumn(connection) {
  const [cols] = await connection.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'decks'
       AND COLUMN_NAME = 'archived'
  `)
  if (cols.length > 0) return
  await connection.query(
    'ALTER TABLE decks ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE AFTER active',
  )
}

/** Bases déjà créées avant le lien comptes↔joueurs. */
async function ensureUsersAccountLink(connection) {
  const [cols] = await connection.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'account_id'
  `)
  if (cols.length > 0) return

  await connection.query('ALTER TABLE users ADD COLUMN account_id CHAR(36) NULL')
  await connection.query('ALTER TABLE users ADD UNIQUE KEY uq_users_account (account_id)')
  await connection.query(`
    ALTER TABLE users
      ADD CONSTRAINT fk_users_account
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  `)
}

/** Helper de transaction : commit si tout passe, rollback à la première erreur. */
export async function withTransaction(fn, target = pool) {
  const connection = await target.getConnection()
  try {
    await connection.beginTransaction()
    const result = await fn(connection)
    await connection.commit()
    return result
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}
