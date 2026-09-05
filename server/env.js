import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Le .env est lu depuis la racine du projet, jamais depuis le cwd : lancer le
 * serveur ou un script depuis n'importe où doit donner la même configuration.
 */
config({ path: join(here, '..', '.env'), quiet: true })

export const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'mtg',
  // `??` et non `||` : un mot de passe vide est une valeur légitime (base
  // locale sans authentification), et `||` la remplaçait silencieusement par
  // la valeur par défaut — d'où un « Access denied » très déroutant.
  password: process.env.DB_PASSWORD ?? 'mtg',
  database: process.env.DB_NAME || 'mtg',
}
