import { randomUUID } from 'node:crypto'
import { pool } from './db.js'

export async function countAccounts(cx = pool) {
  const [rows] = await cx.query('SELECT COUNT(*) AS n FROM accounts')
  return Number(rows[0].n)
}

export async function findAccountByUsername(username, cx = pool) {
  const [rows] = await cx.query(
    'SELECT id, username, password_hash, role, created_at FROM accounts WHERE username = :username LIMIT 1',
    { username },
  )
  return rows[0] ?? null
}

export async function findAccountById(id, cx = pool) {
  const [rows] = await cx.query(
    'SELECT id, username, password_hash, role, created_at FROM accounts WHERE id = :id LIMIT 1',
    { id },
  )
  return rows[0] ?? null
}

export async function createAccount({ username, passwordHash, role = 'user' }, cx = pool) {
  const id = randomUUID()
  await cx.query(
    `INSERT INTO accounts (id, username, password_hash, role)
     VALUES (:id, :username, :password_hash, :role)`,
    { id, username, password_hash: passwordHash, role },
  )
  return { id, username, role }
}

export async function countAdmins(cx = pool) {
  const [rows] = await cx.query(
    `SELECT COUNT(*) AS n FROM accounts WHERE role = 'admin'`,
  )
  return Number(rows[0].n)
}

export async function updateAccount(id, { role }, cx = pool) {
  const [result] = await cx.execute(
    'UPDATE accounts SET role = ? WHERE id = ?',
    [role, id],
  )
  return result.affectedRows > 0
}

/** Compte public (sans hash) pour les réponses API. */
export function publicAccount(row) {
  if (!row) return null
  return { id: row.id, username: row.username, role: row.role }
}
