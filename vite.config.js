import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const gamesPath = path.resolve(__dirname, 'src/data/games_test.json')
const playersPath = path.resolve(__dirname, 'src/data/players.json')

function jsonFileApiPlugin(route, filePath) {
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
      server.middlewares.use('/api/games', jsonFileApiPlugin('/api/games', gamesPath))
      server.middlewares.use('/api/players', jsonFileApiPlugin('/api/players', playersPath))
    },
  }
}

export default defineConfig({
  plugins: [react(), dataApiPlugin()],
})
