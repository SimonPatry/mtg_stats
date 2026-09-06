import { Router } from 'express'
import { pool, withTransaction } from '../db.js'
import { gameInput } from '../../shared/schemas.js'
import { listGames, getGame, createGame, updateGame, deleteGame } from '../games-repo.js'
import { handler, parseBody } from '../http.js'
import { requireAdmin } from '../auth.js'

const router = Router()

router.get('/', handler(async (req, res) => {
  res.json(await listGames(pool, { limit: Number(req.query.limit) || 500 }))
}))

router.get('/:id', handler(async (req, res) => {
  const game = await getGame(pool, req.params.id)
  if (!game) return res.status(404).json({ error: 'Partie introuvable' })
  res.json(game)
}))

/** Ajout de partie : ouvert aux membres connectés. */
router.post('/', handler(async (req, res) => {
  const input = parseBody(gameInput, req, res)
  if (!input) return undefined
  const id = await withTransaction((cx) => createGame(cx, input))
  res.status(201).json(await getGame(pool, id))
}))

router.put('/:id', requireAdmin, handler(async (req, res) => {
  const input = parseBody(gameInput, req, res)
  if (!input) return undefined
  const ok = await withTransaction((cx) => updateGame(cx, req.params.id, input))
  if (!ok) return res.status(404).json({ error: 'Partie introuvable' })
  res.json(await getGame(pool, req.params.id))
}))

router.delete('/:id', requireAdmin, handler(async (req, res) => {
  if (!(await deleteGame(pool, req.params.id))) {
    return res.status(404).json({ error: 'Partie introuvable' })
  }
  res.status(204).end()
}))

export default router
