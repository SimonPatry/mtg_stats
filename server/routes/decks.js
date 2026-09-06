import { Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db.js'
import { deckInput, deckVersionInput } from '../../shared/schemas.js'
import {
  listDecks, getDeck, createDeck, updateDeck, deleteDeck, addVersion, updateVersion,
} from '../decks-repo.js'
import { findUserByAccountId } from '../catalog-repo.js'
import { handler, parseBody } from '../http.js'
import { requireAdmin } from '../auth.js'

const router = Router()

async function rosterPlayerId(accountId) {
  const player = await findUserByAccountId(pool, accountId)
  return player?.id ?? null
}

/** Admin : tout. Membre : uniquement ses lignées. */
async function assertCanWriteDeck(req, res, deckId) {
  const deck = await getDeck(pool, deckId)
  if (!deck) {
    res.status(404).json({ error: 'Deck introuvable' })
    return null
  }
  if (req.user.role === 'admin') return deck
  const playerId = await rosterPlayerId(req.user.id)
  if (!playerId || deck.user_id !== playerId) {
    res.status(403).json({ error: 'Tu ne peux modifier que tes propres decks' })
    return null
  }
  return deck
}

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

const createInput = z.object({
  deck: deckInput,
  version: deckVersionInput.partial({ started_on: true }).optional(),
})

router.post('/', handler(async (req, res) => {
  const input = parseBody(createInput, req, res)
  if (!input) return undefined

  // Un membre ne crée que pour lui-même ; l'admin peut viser n'importe quel joueur.
  if (req.user.role !== 'admin') {
    const playerId = await rosterPlayerId(req.user.id)
    if (!playerId) {
      return res.status(403).json({ error: 'Aucun joueur associé à ce compte' })
    }
    input.deck.user_id = playerId
  }

  const id = await withTransaction((cx) => createDeck(cx, input.deck, input.version ?? {}))
  res.status(201).json(await getDeck(pool, id))
}))

router.put('/:id', handler(async (req, res) => {
  const existing = await assertCanWriteDeck(req, res, req.params.id)
  if (!existing) return undefined

  const input = parseBody(deckInput, req, res)
  if (!input) return undefined

  // Empêche de reassigner le deck à un autre joueur.
  if (req.user.role !== 'admin') {
    input.user_id = existing.user_id
  }

  const ok = await withTransaction((cx) => updateDeck(cx, req.params.id, input))
  if (!ok) return res.status(404).json({ error: 'Deck introuvable' })
  res.json(await getDeck(pool, req.params.id))
}))

router.post('/:id/versions', handler(async (req, res) => {
  const existing = await assertCanWriteDeck(req, res, req.params.id)
  if (!existing) return undefined

  const input = parseBody(deckVersionInput, req, res)
  if (!input) return undefined
  const version = await withTransaction((cx) => addVersion(cx, req.params.id, input))
  res.status(201).json(version)
}))

router.put('/:id/versions/:versionId', handler(async (req, res) => {
  const existing = await assertCanWriteDeck(req, res, req.params.id)
  if (!existing) return undefined

  const input = parseBody(deckVersionInput, req, res)
  if (!input) return undefined
  const ok = await withTransaction((cx) =>
    updateVersion(cx, req.params.id, req.params.versionId, input))
  if (!ok) return res.status(404).json({ error: 'Version introuvable' })
  res.json({ id: req.params.versionId, ...input })
}))

router.delete('/:id', requireAdmin, handler(async (req, res) => {
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
