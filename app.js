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

function backupFilename(kind, reason = 'save') {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const safeReason =
    String(reason)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '') || 'save'
  return `${kind}_${safeReason}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`
}

function listBackups(kind) {
  try {
    return fs
      .readdirSync(backupsDir)
      .filter((name) => name.startsWith(`${kind}_`) && name.endsWith('.json'))
      .map((name) => {
        const stat = fs.statSync(path.join(backupsDir, name))
        return { name, mtime: stat.mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)
  } catch {
    return []
  }
}

function extractBackupPayload(parsed, kind) {
  if (Array.isArray(parsed)) {
    return { data: parsed, reason: 'legacy' }
  }
  return {
    data: parsed.data ?? parsed[kind],
    reason: parsed.reason || 'save',
  }
}

function mountKindRoutes(kind) {
  app.get(`/api/${kind}`, (req, res) => {
    res.json(JSON.parse(fs.readFileSync(DATA_FILES[kind], 'utf-8')))
  })

  app.post(`/api/${kind}`, (req, res) => {
    const data = req.body
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: `${kind} doit être un tableau` })
    }
    fs.writeFileSync(DATA_FILES[kind], JSON.stringify(data, null, 2) + '\n')
    res.json({ ok: true })
  })

  app.get(`/api/${kind}/backup`, (req, res) => {
    res.json(listBackups(kind))
  })

  app.post(`/api/${kind}/backup`, (req, res) => {
    try {
      const { data, reason } = extractBackupPayload(req.body, kind)
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: `${kind} doit être un tableau` })
      }
      const filename = backupFilename(kind, reason)
      fs.writeFileSync(
        path.join(backupsDir, filename),
        JSON.stringify(data, null, 2) + '\n',
      )
      res.json({ ok: true, filename, reason })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}

mountKindRoutes('games')
mountKindRoutes('users')
mountKindRoutes('decks')

app.get('/api/backup-file', (req, res) => {
  const name = String(req.query.name || '')
  if (!/^(games|users|decks)_[a-z0-9_-]+\.json$/i.test(name)) {
    return res.status(400).json({ error: 'Nom de backup invalide' })
  }
  const filePath = path.join(backupsDir, name)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Sauvegarde introuvable' })
  }
  res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')))
})

// Servir les backups en statique
app.use('/backups', express.static(backupsDir))

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
