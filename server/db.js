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
    await runSqlFile(connection, 'seed.sql')
  } finally {
    await connection.end()
  }
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
