import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import {
  verifyPassword,
  hashPassword,
  issueToken,
  cookieOptions,
  COOKIE_NAME,
  currentUser,
  resolveAccount,
} from '../auth.js'
import {
  countAccounts,
  findAccountByUsername,
  createAccount,
  publicAccount,
} from '../accounts-repo.js'
import { ensurePlayerForAccount, findUserByAccountId } from '../catalog-repo.js'
import { pool } from '../db.js'
import { handler } from '../http.js'

/** Compte public + joueur roster lié (pour créer / éditer ses decks). */
async function sessionPayload(account) {
  const player = await findUserByAccountId(pool, account.id)
  return {
    ...publicAccount(account),
    playerId: player?.id ?? null,
  }
}

const router = Router()

const USERNAME_RE = /^[a-z0-9_]{3,32}$/

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().regex(USERNAME_RE, {
    message: 'Identifiant : 3–32 caractères (a-z, 0-9, _)',
  }),
  password: z.string().min(1).max(200),
})

const registerSchema = z.object({
  username: z.string().trim().toLowerCase().regex(USERNAME_RE, {
    message: 'Identifiant : 3–32 caractères (a-z, 0-9, _)',
  }),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(200),
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans quelques minutes.' },
})

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions())
}

async function attachSession(res, account) {
  const token = await issueToken({
    id: account.id,
    username: account.username,
    role: account.role,
  })
  setSessionCookie(res, token)
  return sessionPayload(account)
}

/**
 * Inscription membre uniquement. Jamais de rôle admin via le site :
 * l'admin initial vient du bootstrap .env (ADMIN_USERNAME + ADMIN_PASSWORD_HASH).
 */
router.post('/register', authLimiter, handler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return res.status(400).json({ error: issue?.message || 'Données invalides' })
  }
  const { username, password } = parsed.data

  if (await findAccountByUsername(username)) {
    // Message volontairement neutre : on ne confirme pas l'existence.
    return res.status(409).json({ error: 'Impossible de créer ce compte' })
  }

  if ((await countAccounts()) === 0) {
    return res.status(503).json({
      error: 'Aucun administrateur configuré. Définis ADMIN_USERNAME et ADMIN_PASSWORD_HASH puis redémarre.',
    })
  }

  const passwordHash = await hashPassword(password)
  const account = await createAccount({ username, passwordHash, role: 'user' })
  await ensurePlayerForAccount(pool, { accountId: account.id, username: account.username })
  const user = await attachSession(res, { ...account, password_hash: passwordHash })
  res.status(201).json({ authenticated: true, user })
}))

/**
 * Connexion. Message d'erreur unique (pas de fuite username / mot de passe).
 */
router.post('/login', authLimiter, handler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(401).json({ error: 'Identifiants incorrects' })
  }
  const { username, password } = parsed.data
  const row = await findAccountByUsername(username)
  const ok = row && (await verifyPassword(password, row.password_hash))
  if (!ok) {
    return res.status(401).json({ error: 'Identifiants incorrects' })
  }
  const user = await attachSession(res, row)
  res.json({ authenticated: true, user })
}))

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined })
  res.json({ authenticated: false })
})

/**
 * Session courante. Recharge le compte en base et renouvelle le cookie
 * (session glissante) pour rester connecté tant qu'on revient dans les 7 jours.
 */
router.get('/me', handler(async (req, res) => {
  const session = await currentUser(req)
  const user = await resolveAccount(session)
  if (!user) {
    if (session) {
      res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined })
    }
    return res.json({ authenticated: false, user: null })
  }
  const payload = await attachSession(res, user)
  res.json({ authenticated: true, user: payload })
}))

export default router

/**
 * Si la base n'a aucun compte et qu'un ADMIN_PASSWORD_HASH est fourni,
 * crée le compte admin initial (déploiements Docker / .env).
 * Puis garantit un joueur roster pour chaque compte (y compris existants).
 */
export async function bootstrapAdminAccount() {
  if ((await countAccounts()) === 0) {
    const hash = process.env.ADMIN_PASSWORD_HASH
    if (hash && hash.includes(':')) {
      const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase()
      if (!USERNAME_RE.test(username)) {
        console.warn('ADMIN_USERNAME invalide — bootstrap admin ignoré')
      } else {
        const account = await createAccount({ username, passwordHash: hash, role: 'admin' })
        await ensurePlayerForAccount(pool, { accountId: account.id, username: account.username })
        console.log(`Compte admin initial créé : ${username}`)
      }
    }
  }

  await backfillPlayersForAccounts()
}

/** Comptes déjà créés avant le lien joueur — complète le roster. */
async function backfillPlayersForAccounts() {
  const [rows] = await pool.query('SELECT id, username FROM accounts ORDER BY created_at')
  for (const row of rows) {
    await ensurePlayerForAccount(pool, { accountId: row.id, username: row.username })
  }
}
