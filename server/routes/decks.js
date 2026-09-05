import { Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db.js'
import { deckInput, deckVersionInput } from '../../shared/schemas.js'
import {
  listDecks, getDeck, createDeck, updateDeck, deleteDeck, addVersion, updateVersion,
} from '../decks-repo.js'
import { handler, parseBody, invalid } from '../http.js'

const router = Router()

router.get('/', handler(async (req, res) => {
  res.json(await listDecks(pool, {
    activeOnly: req.query.active === '1',
    withVersions: req.query.versions === '1',
  }))
}))

router.get('/:id', handler(async (req, res) => {
  const deck = await getDeck(pool, req.params.id)
  if (!deck) return res.status(404).json({ error: 'Deck introuvable' })
  res.json(deck)
}))

// Un deck naît avec sa première version : créer une lignée sans état initial
// n'aurait aucun sens, et laisserait des sièges impossibles à rattacher.
const createInput = z.object({
  deck: deckInput,
  version: deckVersionInput.partial({ started_on: true }).optional(),
})

router.post('/', handler(async (req, res) => {
  const input = parseBody(createInput, req, res)
  if (!input) return undefined
  const id = await withTransaction((cx) => createDeck(cx, input.deck, input.version ?? {}))
  res.status(201).json(await getDeck(pool, id))
}))

router.put('/:id', handler(async (req, res) => {
  const input = parseBody(deckInput, req, res)
  if (!input) return undefined
  const ok = await withTransaction((cx) => updateDeck(cx, req.params.id, input))
  if (!ok) return res.status(404).json({ error: 'Deck introuvable' })
  res.json(await getDeck(pool, req.params.id))
}))

/** Nouvelle version d'une lignée : nouveau bracket, nouvelle liste, nouvelle URL. */
router.post('/:id/versions', handler(async (req, res) => {
  const input = parseBody(deckVersionInput, req, res)
  if (!input) return undefined
  const deck = await getDeck(pool, req.params.id)
  if (!deck) return res.status(404).json({ error: 'Deck introuvable' })
  const version = await withTransaction((cx) => addVersion(cx, req.params.id, input))
  res.status(201).json(version)
}))

router.put('/:id/versions/:versionId', handler(async (req, res) => {
  const input = parseBody(deckVersionInput, req, res)
  if (!input) return undefined
  const ok = await withTransaction((cx) =>
    updateVersion(cx, req.params.id, req.params.versionId, input))
  if (!ok) return res.status(404).json({ error: 'Version introuvable' })
  res.json({ id: req.params.versionId, ...input })
}))

/**
 * Suppression refusée dès qu'une partie référence une version du deck :
 * amputer l'historique est pire que garder une ligne inutile. L'interface
 * propose alors de désactiver la lignée.
 */
router.delete('/:id', handler(async (req, res) => {
  const { deleted, used } = await withTransaction((cx) => deleteDeck(cx, req.params.id))
  if (!deleted && used > 0) {
    return res.status(409).json({
      error: 'Ce deck a été joué',
      game_count: used,
      hint: 'Le désactiver plutôt que le supprimer.',
    })
  }
  if (!deleted) return res.status(404).json({ error: 'Deck introuvable' })
  res.status(204).end()
}))

export default router
