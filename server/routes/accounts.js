import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db.js'
import {
  findAccountById,
  updateAccount,
  countAdmins,
  publicAccount,
} from '../accounts-repo.js'
import { handler } from '../http.js'
import { requireAdmin } from '../auth.js'

const router = Router()

const accountUpdate = z.object({
  role: z.enum(['admin', 'user']),
})

/**
 * Mise à jour du rôle d'un compte. Réservé aux admins.
 * On refuse de rétrograder le dernier administrateur.
 */
router.put('/:id', requireAdmin, handler(async (req, res) => {
  const parsed = accountUpdate.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ error: 'Rôle invalide (admin ou user)' })
  }
  const { role } = parsed.data
  const account = await findAccountById(req.params.id)
  if (!account) return res.status(404).json({ error: 'Compte introuvable' })

  if (account.role === 'admin' && role !== 'admin') {
    const n = await countAdmins(pool)
    if (n <= 1) {
      return res.status(409).json({
        error: 'Impossible de retirer le dernier administrateur',
      })
    }
  }

  if (!(await updateAccount(account.id, { role }))) {
    return res.status(404).json({ error: 'Compte introuvable' })
  }

  const updated = await findAccountById(account.id)
  res.json(publicAccount(updated))
}))

export default router
