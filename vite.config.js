import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {
  parseJsonText,
  validateDecksEdit,
  validateGamesEdit,
  validateUsersEdit,
} from './src/jsonGuard.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, 'src/data')
const backupsDir = path.resolve(__dirname, 'public/backups')

const DATA_FILES = {
  games: {
    real: path.join(dataDir, 'games.json'),
    fake: path.join(dataDir, 'games_test.json'),
  },
  users: {
    real: path.join(dataDir, 'users.json'),
    fake: path.join(dataDir, 'users_test.json'),
  },
  decks: {
    real: path.join(dataDir, 'decks.json'),
    fake: path.join(dataDir, 'decks_test.json'),
  },
}

const LABELS = {
  games: 'Parties',
  users: 'Joueurs',
  decks: 'Decks',
}

function resolveDataSource(req) {
  const url = new URL(req.url || '/', 'http://localhost')
  return url.searchParams.get('source') === 'fake' ? 'fake' : 'real'
}

function resolveDataPath(kind, req) {
  const source = resolveDataSource(req)
  return DATA_FILES[kind][source]
}

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
  fs.mkdirSync(backupsDir, { recursive: true })
  return fs
    .readdirSync(backupsDir)
    .filter((name) => name.startsWith(`${kind}_`) && name.endsWith('.json'))
    .map((name) => {
      const stat = fs.statSync(path.join(backupsDir, name))
      return { name, mtime: stat.mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
}

function extractBackupPayload(parsed, kind) {
  if (Array.isArray(parsed)) {
    return { data: parsed, reason: 'legacy' }
  }
  const data = parsed.data ?? parsed[kind]
  const reason = parsed.reason || 'save'
  return { data, reason }
}

function handleBackupRoutes(kind, req, res, next) {
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname !== '/backup') {
    next()
    return
  }

  if (req.method === 'GET') {
    try {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(listBackups(kind)))
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  if (req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body)
        const { data, reason } = extractBackupPayload(parsed, kind)
        if (!Array.isArray(data)) {
          throw new Error(`Backup invalide : ${kind} doit être un tableau`)
        }
        fs.mkdirSync(backupsDir, { recursive: true })
        const filename = backupFilename(kind, reason)
        fs.writeFileSync(
          path.join(backupsDir, filename),
          `${JSON.stringify(data, null, 2)}\n`,
        )
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, filename, reason }))
      } catch (err) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  next()
}

function jsonFileApiPlugin(kind, validateEdit) {
  return (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname === '/backup') {
      handleBackupRoutes(kind, req, res, next)
      return
    }

    const filePath = resolveDataPath(kind, req)

    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json')
      res.end(fs.readFileSync(filePath, 'utf-8'))
      return
    }

    if (req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        try {
          const data = parseJsonText(body, LABELS[kind] || 'JSON')
          const before = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          validateEdit(before, data)
          fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    next()
  }
}

function backupFilePlugin() {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      next()
      return
    }
    try {
      const url = new URL(req.url || '/', 'http://localhost')
      const name = url.searchParams.get('name') || ''
      if (!/^(games|users|decks)_[a-z0-9_-]+\.json$/i.test(name)) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Nom de backup invalide' }))
        return
      }
      const filePath = path.join(backupsDir, name)
      if (!fs.existsSync(filePath)) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Sauvegarde introuvable' }))
        return
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(fs.readFileSync(filePath, 'utf-8'))
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: err.message }))
    }
  }
}

function dataApiPlugin() {
  return {
    name: 'data-api',
    configureServer(server) {
      server.middlewares.use('/api/backup-file', backupFilePlugin())
      server.middlewares.use(
        '/api/games',
        jsonFileApiPlugin('games', validateGamesEdit),
      )
      server.middlewares.use(
        '/api/users',
        jsonFileApiPlugin('users', validateUsersEdit),
      )
      server.middlewares.use(
        '/api/decks',
        jsonFileApiPlugin('decks', validateDecksEdit),
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), dataApiPlugin()],
})
