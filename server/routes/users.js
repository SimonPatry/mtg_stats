import { Router } from 'express'
import { pool } from '../db.js'
import { userInput } from '../../shared/schemas.js'
import { listUsers, updateUser, deleteUser, findUserByName } from '../catalog-repo.js'
import { handler, parseBody } from '../http.js'
import { requireAdmin } from '../auth.js'

const router = Router()

router.get('/', handler(async (req, res) => {
  res.json(await listUsers(pool))
}))

/** Plus de création manuelle : les joueurs naissent à l'inscription. */
router.post('/', requireAdmin, handler(async (_req, res) => {
  res.status(403).json({
    error: 'Les joueurs se créent via l’inscription. Impossible d’en ajouter ici.',
  })
}))

router.put('/:id', requireAdmin, handler(async (req, res) => {
  const input = parseBody(userInput, req, res)
  if (!input) return undefined
  const clash = await findUserByName(pool, input.name)
  if (clash && clash.id !== req.params.id) {
    return res.status(409).json({ error: `Le joueur « ${input.name} » existe déjà` })
  }
  if (!(await updateUser(pool, req.params.id, input))) {
    return res.status(404).json({ error: 'Joueur introuvable' })
  }
  res.json({ id: req.params.id, ...input })
}))

/**
 * Suppression refusée si le joueur possède des decks : son historique de
 * parties en dépend. L'interface propose alors de le désactiver.
 */
router.delete('/:id', requireAdmin, handler(async (req, res) => {
  const { deleted, decks } = await deleteUser(pool, req.params.id)
  if (!deleted && decks > 0) {
    return res.status(409).json({
      error: 'Ce joueur possède des decks',
      deck_count: decks,
      hint: 'Le désactiver plutôt que le supprimer.',
    })
  }
  if (!deleted) return res.status(404).json({ error: 'Joueur introuvable' })
  res.status(204).end()
}))

export default router
