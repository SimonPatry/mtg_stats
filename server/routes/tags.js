import { Router } from 'express'
import { pool } from '../db.js'
import { tagInput } from '../../shared/schemas.js'
import {
  listTags, createTag, updateTag, deleteTag, findTagByLabel, countDecksForTag,
} from '../catalog-repo.js'
import { handler, parseBody } from '../http.js'

const router = Router()

router.get('/', handler(async (req, res) => res.json(await listTags(pool))))

router.post('/', handler(async (req, res) => {
  const input = parseBody(tagInput, req, res)
  if (!input) return undefined
  if (await findTagByLabel(pool, input.label)) {
    return res.status(409).json({ error: 'Ce tag existe déjà' })
  }
  const id = await createTag(pool, input.label)
  res.status(201).json({ id, label: input.label, deck_count: 0 })
}))

router.put('/:id', handler(async (req, res) => {
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
 * Suppression autorisée même si le tag est utilisé, mais jamais en silence :
 * sans confirm_detach l'API refuse et renvoie le nombre de decks concernés,
 * que l'interface affiche avant de faire cocher la case de confirmation.
 */
router.delete('/:id', handler(async (req, res) => {
  const used = await countDecksForTag(pool, req.params.id)
  const confirmed = req.query.confirm_detach === '1' || req.body?.confirm_detach === true

  if (used > 0 && !confirmed) {
    return res.status(409).json({
      error: 'Ce tag est utilisé',
      deck_count: used,
      hint: 'Rappeler la requête avec confirm_detach pour le détacher de ces decks.',
    })
  }
  if (!(await deleteTag(pool, req.params.id))) {
    return res.status(404).json({ error: 'Tag introuvable' })
  }
  res.json({ deleted: true, detached_from: used })
}))

export default router
