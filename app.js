import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, 'dist')
const dataDir = path.resolve(__dirname, 'data')
const backupsDir = path.resolve(__dirname, 'data/backups')

// S'assurer que les dossiers data existent
fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(backupsDir, { recursive: true })

// Fichiers de données (réels en prod)
const DATA_FILES = {
  games: path.join(dataDir, 'games.json'),
  users: path.join(dataDir, 'users.json'),
  decks: path.join(dataDir, 'decks.json'),
}

// Initialise les fichiers s'ils n'existent pas
for (const [, filePath] of Object.entries(DATA_FILES)) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]\n')
  }
}

const app = express()

// Force HSTS
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})

app.use(express.json({ limit: '10mb' }))

// ─── API données ───────────────────────────────────

function backupFilename(reason = 'save') {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const safeReason = String(reason)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '') || 'save'
  return `games_${safeReason}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`
}

// GET /api/games
app.get('/api/games', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(DATA_FILES.games, 'utf-8')))
})

// POST /api/games
app.post('/api/games', (req, res) => {
  const data = req.body
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'games doit être un tableau' })
  }
  fs.writeFileSync(DATA_FILES.games, JSON.stringify(data, null, 2) + '\n')
  res.json({ ok: true })
})

// GET /api/games/backup
app.get('/api/games/backup', (req, res) => {
  try {
    const files = fs
      .readdirSync(backupsDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        const stat = fs.statSync(path.join(backupsDir, name))
        return { name, mtime: stat.mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)
    res.json(files)
  } catch {
    res.json([])
  }
})

// POST /api/games/backup
app.post('/api/games/backup', (req, res) => {
  try {
    const parsed = req.body
    const games = Array.isArray(parsed) ? parsed : parsed.games
    const reason = Array.isArray(parsed) ? 'legacy' : (parsed.reason || 'save')
    if (!Array.isArray(games)) {
      return res.status(400).json({ error: 'games doit être un tableau' })
    }
    const filename = backupFilename(reason)
    fs.writeFileSync(path.join(backupsDir, filename), JSON.stringify(games, null, 2) + '\n')
    res.json({ ok: true, filename, reason })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Servir les backups en statique
app.use('/backups', express.static(backupsDir))

// GET /api/users
app.get('/api/users', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(DATA_FILES.users, 'utf-8')))
})

// POST /api/users
app.post('/api/users', (req, res) => {
  const data = req.body
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'users doit être un tableau' })
  }
  fs.writeFileSync(DATA_FILES.users, JSON.stringify(data, null, 2) + '\n')
  res.json({ ok: true })
})

// GET /api/decks
app.get('/api/decks', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(DATA_FILES.decks, 'utf-8')))
})

// POST /api/decks
app.post('/api/decks', (req, res) => {
  const data = req.body
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'decks doit être un tableau' })
  }
  fs.writeFileSync(DATA_FILES.decks, JSON.stringify(data, null, 2) + '\n')
  res.json({ ok: true })
})

// ─── Fichiers statiques (dist/) ────────────────────

app.use(express.static(distDir))

// SPA fallback : toute route inconnue → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

// ─── Démarrage ─────────────────────────────────────

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`MagicAddicts server running on port ${PORT}`)
})
