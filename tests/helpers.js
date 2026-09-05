import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'src', 'data')

const read = (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf8'))

/** Jeu de données de test livré avec le projet : 5 joueurs, 36 decks, 43 parties. */
export const users = read('users_test.json')
export const decks = read('decks_test.json')
export const games = read('games_test.json')

/** tempGame.js s'appuie sur sessionStorage : on en pose un en mémoire. */
export function installSessionStorage() {
  const store = new Map()
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size },
  }
  return store
}
