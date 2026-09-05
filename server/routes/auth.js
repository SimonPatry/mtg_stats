import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { verifyPassword, issueToken, cookieOptions, COOKIE_NAME, currentUser } from '../auth.js'
import { handler } from '../http.js'

const router = Router()

// Un compte unique et partagé est une cible de bruteforce idéale : sans
// limitation, c'est le maillon faible de toute l'authentification.
// Le plafond est réglable pour les suites navigateur, qui se connectent à
// chaque exécution et épuisaient les dix tentatives en trois lancements. Le mot
// de passe reste exigé quoi qu'il arrive : c'est une soupape, pas une porte.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans quelques minutes.' },
})

router.post('/login', loginLimiter, handler(async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!(await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH))) {
    return res.status(401).json({ error: 'Mot de passe incorrect' })
  }
  res.cookie(COOKIE_NAME, await issueToken(), cookieOptions())
  res.json({ authenticated: true })
}))

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined })
  res.json({ authenticated: false })
})

router.get('/me', handler(async (req, res) => {
  const user = await currentUser(req)
  res.json({ authenticated: Boolean(user), user })
}))

export default router
