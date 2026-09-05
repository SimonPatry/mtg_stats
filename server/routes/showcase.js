import { Router } from 'express'
import { pool } from '../db.js'
import { listShowcase } from '../decks-repo.js'
import { handler } from '../http.js'

/**
 * Route publique de la vitrine. Volontairement seule de son espèce : tout le
 * reste de l'API est authentifié. Elle ne renvoie ni joueur, ni statistique,
 * ni identifiant de version — uniquement ce qui est destiné à être affiché.
 */
const router = Router()

router.get('/decks', handler(async (req, res) => {
  res.json(await listShowcase(pool))
}))

export default router
