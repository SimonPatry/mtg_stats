import './env.js'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { requireAuth } from './auth.js'
import { pool } from './db.js'
import authRoutes from './routes/auth.js'
import showcaseRoutes from './routes/showcase.js'
import referenceRoutes from './routes/reference.js'
import statsRoutes from './routes/stats.js'
import usersRoutes from './routes/users.js'
import tagsRoutes from './routes/tags.js'
import decksRoutes from './routes/decks.js'
import gamesRoutes from './routes/games.js'
import accountsRoutes from './routes/accounts.js'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Construit l'application Express. Séparé du démarrage du serveur pour que les
 * tests puissent la monter sur un port éphémère sans effet de bord.
 *
 * `clientDir` désigne le dossier de build du front. En production, Express le
 * sert lui-même : un seul processus, une seule origine, donc plus de CORS ni
 * de cookie inter-origines. En développement c'est Vite qui sert le front et
 * relaie /api, et ce dossier n'existe pas — le serveur démarre quand même.
 */
export function createApp({ clientDir = join(projectRoot, 'dist'), bootError = null } = {}) {
  const app = express()

  app.disable('x-powered-by')
  // Nécessaire pour que express-rate-limit voie la vraie IP derrière un proxy.
  app.set('trust proxy', 1)

  /**
   * La CSP par défaut de helmet bloquerait tout ce dont le site dépend :
   * illustrations et symboles de mana Scryfall, polices Google, appels à
   * l'API Scryfall. On la déclare explicitement plutôt que de la découvrir
   * cassée en production.
   */
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        // cards/svgs.scryfall.io : illustrations et symboles de mana.
        // api.dicebear.com : avatars des joueurs du roster.
        'img-src': [
          "'self'", 'data:',
          'https://cards.scryfall.io',
          'https://svgs.scryfall.io',
          'https://api.dicebear.com',
        ],
        'connect-src': ["'self'", 'https://api.scryfall.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'script-src': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }))

  app.use(cors({
    // En développement le front passe par le proxy de Vite : rien n'est
    // inter-origines. Cette liste ne sert qu'aux appels directs à l'API.
    origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? ['http://localhost:5173'],
    credentials: true,
  }))

  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.get('/api/health', async (req, res) => {
    if (bootError) {
      return res.status(503).json({
        ok: false,
        error: bootError.message,
        code: bootError.code || null,
      })
    }
    // Marqueur de déploiement : si `inspirations` est absent ici, Passenger
    // tourne encore sur un vieux process (le front `dist/` peut être à jour).
    let deckInspirationsTable = false
    try {
      const [rows] = await pool.query(`
        SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'deck_inspirations'
         LIMIT 1
      `)
      deckInspirationsTable = rows.length > 0
    } catch {
      deckInspirationsTable = false
    }
    return res.json({
      ok: true,
      api: '1.6.3',
      features: { inspirations: true },
      db: { deck_inspirations: deckInspirationsTable },
    })
  })

  // Si la DB n'a pas démarré, mieux vaut un JSON clair qu'une cascade de 500.
  if (bootError) {
    app.use('/api', (req, res, next) => {
      if (req.path === '/health') return next()
      return res.status(503).json({
        error: 'Base de données indisponible',
        detail: bootError.message,
        code: bootError.code || null,
      })
    })
  }

  // ─── Ouvert ──────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes)
  app.use('/api/showcase', showcaseRoutes)

  // ─── Membre ou admin (stats, lecture catalogue, ajout de parties) ───────
  app.use('/api/reference', requireAuth, referenceRoutes)
  app.use('/api/stats', requireAuth, statsRoutes)
  app.use('/api/users', requireAuth, usersRoutes)
  app.use('/api/accounts', requireAuth, accountsRoutes)
  app.use('/api/tags', requireAuth, tagsRoutes)
  app.use('/api/decks', requireAuth, decksRoutes)
  app.use('/api/games', requireAuth, gamesRoutes)


  // Ce 404 est placé avant le front : une route /api inconnue doit répondre en
  // JSON, jamais renvoyer la page d'accueil — sinon une faute de frappe dans un
  // appel se traduit par un « Unexpected token < » incompréhensible côté front.
  app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }))

  // ─── Le front, servi par le même processus ───────────────────────────────
  const indexFile = join(clientDir, 'index.html')
  if (existsSync(indexFile)) {
    // Les fichiers d'assets portent une empreinte dans leur nom : ils sont
    // immuables, on les met en cache pour un an. `index.html`, lui, ne doit
    // jamais être mis en cache, sinon un déploiement passe inaperçu.
    app.use('/assets', express.static(join(clientDir, 'assets'), {
      immutable: true,
      maxAge: '1y',
      index: false,
    }))
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }))

    // Le routage est côté client : /admin, /stats, /decks… n'existent pas sur
    // le disque. Toute requête de PAGE non résolue rend index.html, et c'est
    // l'application qui décide quoi afficher.
    //
    // Un fichier manquant, lui, doit rester un 404. Renvoyer index.html à la
    // place d'un bundle absent donne un « Unexpected token < » au lieu d'une
    // erreur lisible, et fait passer un déploiement incomplet pour un site qui
    // marche. D'où le filtre : ni /assets, ni rien qui ressemble à un fichier.
    const looksLikeFile = /\.[a-z0-9]+$/i
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      if (req.path.startsWith('/assets/') || looksLikeFile.test(req.path)) return next()
      if (!req.accepts('html')) return next()
      res.set('Cache-Control', 'no-store').sendFile(indexFile)
    })
  }

  app.use((err, req, res, next) => {
    console.error(err)
    // Les violations de contrainte remontent en 409 : c'est un conflit de
    // données, pas une panne du serveur.
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Cette valeur existe déjà' })
    }
    if (err?.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Référence inconnue' })
    }
    // En prod Plesk les logs Passenger sont peu accessibles : remonter un
    // détail SQL sûr (code + message) aide le diagnostic sans stack trace.
    const detail = err?.sqlMessage || err?.message || null
    const code = err?.code || null
    res.status(500).json({
      error: 'Erreur serveur',
      ...(detail ? { detail, code } : {}),
    })
  })

  return app
}
