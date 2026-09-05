import { Router } from 'express'
import { pool } from '../db.js'
import { readDashboard, readWinsByVersion } from '../stats-repo.js'
import { handler } from '../http.js'

const router = Router()

router.get('/dashboard', handler(async (req, res) => {
  res.json(await readDashboard(pool))
}))

router.get('/versions', handler(async (req, res) => {
  res.json(await readWinsByVersion(pool))
}))

export default router
