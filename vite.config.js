import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const gamesPath = path.resolve(__dirname, 'src/data/games_test.json')
const playersPath = path.resolve(__dirname, 'src/data/players.json')
const backupsDir = path.resolve(__dirname, 'public/backups')

function backupFilename() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `games_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`
}

function gamesApiPlugin(filePath) {
  return (req, res, next) => {
    const subpath = (req.url || '/').split('?')[0]

    if (subpath === '/backup') {
      if (req.method === 'GET') {
        try {
          fs.mkdirSync(backupsDir, { recursive: true })
          const files = fs
            .readdirSync(backupsDir)
            .filter((name) => name.endsWith('.json'))
            .map((name) => {
              const stat = fs.statSync(path.join(backupsDir, name))
              return { name, mtime: stat.mtimeMs }
            })
            .sort((a, b) => b.mtime - a.mtime)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(files))
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
            const data = JSON.parse(body)
            fs.mkdirSync(backupsDir, { recursive: true })
            const filename = backupFilename()
            const backupPath = path.join(backupsDir, filename)
            fs.writeFileSync(backupPath, `${JSON.stringify(data, null, 2)}\n`)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, filename }))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
        })
        return
      }

      next()
      return
    }

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
          const data = JSON.parse(body)
          fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    next()
  }
}

function jsonFileApiPlugin(filePath) {
  return (req, res, next) => {
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
          const data = JSON.parse(body)
          fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    next()
  }
}

function dataApiPlugin() {
  return {
    name: 'data-api',
    configureServer(server) {
      server.middlewares.use('/api/games', gamesApiPlugin(gamesPath))
      server.middlewares.use('/api/players', jsonFileApiPlugin(playersPath))
    },
  }
}

export default defineConfig({
  plugins: [react(), dataApiPlugin()],
})
