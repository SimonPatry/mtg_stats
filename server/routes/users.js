import { Router } from 'express'
import { pool } from '../db.js'
import { userInput } from '../../shared/schemas.js'
import { listUsers, createUser, updateUser, deleteUser, findUserByName } from '../catalog-repo.js'
import { handler, parseBody } from '../http.js'

const router = Router()

router.get('/', handler(async (req, res) => {
  res.json(await listUsers(pool))
}))

router.post('/', handler(async (req, res) => {
  const input = parseBody(userInput, req, res)
  if (!input) return undefined
  if (await findUserByName(pool, input.name)) {
    return res.status(409).json({ error: `Le joueur « ${input.name} » existe déjà` })
  }
  const id = await createUser(pool, input)
  res.status(201).json({ id, ...input })
}))

router.put('/:id', handler(async (req, res) => {
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
router.delete('/:id', handler(async (req, res) => {
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
