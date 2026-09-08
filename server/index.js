import './env.js'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createApp } from './app.js'
import { migrate } from './db.js'
import { bootstrapAdminAccount } from './routes/auth.js'

const port = Number(process.env.PORT) || 3000
const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

/**
 * Sur Plesk, si migrate() plante (DB absente / mauvais .env) AVANT listen(),
 * Passenger affiche une page HTML 500 opaque. On écoute toujours, et
 * /api/health expose l'erreur pour diagnostiquer.
 */
let bootError = null
try {
  await migrate()
  await bootstrapAdminAccount()
} catch (err) {
  bootError = err
  console.error('Bootstrap DB échoué — l’API tourne en mode dégradé:', err)
}

const app = createApp({ clientDir, bootError })

const underPassenger = typeof globalThis.PhusionPassenger !== 'undefined'
app.listen(underPassenger ? 'passenger' : port, () => {
  const served = existsSync(join(clientDir, 'index.html'))
  console.log(`MagicAddicts sur http://localhost:${port}`)
  if (bootError) {
    console.error(`  ATTENTION: bootstrap en échec (${bootError.code || bootError.message})`)
  }
  console.log(served
    ? '  site et API servis par ce processus'
    : '  API seule (pas de build dans dist/ — lance `npm run build`, ou `npm run dev` pour Vite)')
})
