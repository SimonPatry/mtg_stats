import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { SignJWT, jwtVerify } from 'jose'

const scryptAsync = promisify(scrypt)

const KEYLEN = 64
export const COOKIE_NAME = 'mtg_session'
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60

/**
 * Un compte unique, partagé, dont le seul rôle est de fermer la porte de
 * l'administration. Aucun utilisateur en base : les joueurs sont des données.
 *
 * Format du hash : "sel_hex:hash_hex". scrypt vient de Node, donc aucune
 * dépendance native à compiler.
 */
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
  // Comparaison à temps constant : une comparaison naïve fuit le préfixe correct.
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

function secret() {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) {
    throw new Error('JWT_SECRET manquant ou trop court (32 caractères minimum)')
  }
  return new TextEncoder().encode(value)
}

export async function issueToken(subject = 'admin') {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
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
 * Le jeton voyage dans un cookie httpOnly, jamais dans le localStorage : un
 * script injecté dans la page ne peut alors pas le lire.
 */
export async function currentUser(req) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    return { sub: payload.sub, role: payload.role }
  } catch {
    return null
  }
}

export async function requireAuth(req, res, next) {
  const user = await currentUser(req)
  if (!user) return res.status(401).json({ error: 'Authentification requise' })
  req.user = user
  next()
}
