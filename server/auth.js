import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { SignJWT, jwtVerify } from 'jose'
import { findAccountById } from './accounts-repo.js'

const scryptAsync = promisify(scrypt)

const KEYLEN = 64
export const COOKIE_NAME = 'mtg_session'
export const MAX_AGE_SECONDS = 7 * 24 * 60 * 60

/** Format stocké : "sel_hex:hash_hex" (scrypt). */
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password, salt, KEYLEN)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [saltHex, hashHex] = stored.split(':')
  const expected = Buffer.from(hashHex, 'hex')
  const derived = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

function secret() {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) {
    throw new Error('JWT_SECRET manquant ou trop court (32 caractères minimum)')
  }
  return new TextEncoder().encode(value)
}

/**
 * Jeton de session. `sub` = id du compte ; claims `role` + `username`.
 */
export async function issueToken({ id, username, role }) {
  if (role !== 'admin' && role !== 'user') {
    throw new Error(`Rôle inconnu: ${role}`)
  }
  return new SignJWT({ role, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret())
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.SECURE_COOKIES === '1',
    path: '/',
    maxAge: MAX_AGE_SECONDS * 1000,
  }
}

/**
 * Session depuis le cookie. Ne consulte pas encore la base : les middlewares
 * et /me rappellent `resolveAccount` pour invalider un compte supprimé et
 * rafraîchir le rôle.
 */
export async function currentUser(req) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    const role = payload.role === 'admin' || payload.role === 'user' ? payload.role : null
    if (!role || !payload.sub) return null
    return {
      id: String(payload.sub),
      sub: String(payload.sub),
      username: typeof payload.username === 'string' ? payload.username : null,
      role,
    }
  } catch {
    return null
  }
}

/** Recharge le compte en base (source de vérité pour le rôle). */
export async function resolveAccount(session) {
  if (!session?.id) return null
  const row = await findAccountById(session.id)
  if (!row) return null
  return {
    id: row.id,
    sub: row.id,
    username: row.username,
    role: row.role,
  }
}

export async function requireAuth(req, res, next) {
  const session = await currentUser(req)
  const user = await resolveAccount(session)
  if (!user) return res.status(401).json({ error: 'Authentification requise' })
  req.user = user
  next()
}

export async function requireAdmin(req, res, next) {
  const session = await currentUser(req)
  const user = await resolveAccount(session)
  if (!user) return res.status(401).json({ error: 'Authentification requise' })
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé à l’administration' })
  }
  req.user = user
  next()
}
