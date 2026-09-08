import './env.js'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createApp } from './app.js'
import { migrate } from './db.js'
import { bootstrapAdminAccount } from './routes/auth.js'

const port = Number(process.env.PORT) || 3000
const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

// Le schéma et les référentiels sont appliqués au démarrage : une base neuve
// (conteneur fraîchement créé) devient utilisable sans étape manuelle.
await migrate()
await bootstrapAdminAccount()

const app = createApp({ clientDir })
// Plesk/Passenger ignore le numéro de port et intercepte le premier listen().
const underPassenger = typeof globalThis.PhusionPassenger !== 'undefined'
if (underPassenger) {
  globalThis.PhusionPassenger.configure({ autoInstall: false })
}
app.listen(underPassenger ? 'passenger' : port, () => {
  const served = existsSync(join(clientDir, 'index.html'))
  console.log(`MagicAddicts sur http://localhost:${port}`)
  console.log(served
    // Un seul processus : le site et l'API partagent l'origine.
    ? '  site et API servis par ce processus'
    // Sans build, Express ne sert que l'API ; c'est le mode développement,
    // où Vite sert le front sur 5173 et relaie /api ici.
    : '  API seule (pas de build dans dist/ — lance `npm run build`, ou `npm run dev` pour Vite)')
})
