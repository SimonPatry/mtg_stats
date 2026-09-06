import { Router } from 'express'
import { pool } from '../db.js'
import { tagInput } from '../../shared/schemas.js'
import {
  listTags, createTag, updateTag, deleteTag, findTagByLabel, countDecksForTag,
} from '../catalog-repo.js'
import { handler, parseBody } from '../http.js'
import { requireAdmin, requireAuth } from '../auth.js'

const router = Router()

router.get('/', handler(async (req, res) => res.json(await listTags(pool))))

router.post('/', requireAuth, handler(async (req, res) => {
  const input = parseBody(tagInput, req, res)
  if (!input) return undefined
  if (await findTagByLabel(pool, input.label)) {
    return res.status(409).json({ error: 'Ce tag existe déjà' })
  }
  const id = await createTag(pool, input.label)
  res.status(201).json({ id, label: input.label, deck_count: 0 })
}))

router.put('/:id', requireAdmin, handler(async (req, res) => {
  const input = parseBody(tagInput, req, res)
  if (!input) return undefined
  const clash = await findTagByLabel(pool, input.label)
  if (clash && clash.id !== req.params.id) {
    return res.status(409).json({ error: 'Ce tag existe déjà' })
  }
  if (!(await updateTag(pool, req.params.id, input.label))) {
    return res.status(404).json({ error: 'Tag introuvable' })
  }
  res.json({ id: req.params.id, label: input.label })
}))

/**
 * Suppression immédiate : détache le tag des decks puis le retire.
 */
router.delete('/:id', requireAdmin, handler(async (req, res) => {
  const used = await countDecksForTag(pool, req.params.id)
  if (!(await deleteTag(pool, req.params.id))) {
    return res.status(404).json({ error: 'Tag introuvable' })
  }
  res.json({ deleted: true, detached_from: used })
}))

export default router
