import { Router } from 'express'
import { pool } from '../db.js'
import { readReference } from '../catalog-repo.js'
import { handler } from '../http.js'

const router = Router()

router.get('/', handler(async (req, res) => {
  res.json(await readReference(pool))
}))

export default router
