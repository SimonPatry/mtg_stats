import { z } from 'zod'

/**
 * Schémas de validation partagés entre l'API et les formulaires.
 *
 * Une seule source de vérité : ce qui passe côté navigateur passera côté
 * serveur, et inversement. Le serveur revalide systématiquement — on ne fait
 * jamais confiance au client — mais les règles ne sont écrites qu'ici.
 */

export const uuid = z.uuid('Identifiant invalide')
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')

export const MIN_SEATS = 2
export const MAX_SEATS = 5
export const COLOR_CODES = ['W', 'U', 'B', 'R', 'G']
export const BRACKET_VARIATIONS = ['low', 'high']

const bracket = z.number().int().min(1).max(4).nullable().default(null)
const bracketVariation = z.enum(BRACKET_VARIATIONS).nullable().default(null)

// ─── Joueurs ───────────────────────────────────────────────────────────────
export const userInput = z.object({
  name: z.string().trim().min(1, 'Le nom du joueur est obligatoire').max(100),
  active: z.boolean().default(true),
})

// ─── Decks ─────────────────────────────────────────────────────────────────
export const commanderInput = z.object({
  name: z.string().trim().min(1, 'Nom de commandant requis').max(200),
  set_code: z.string().trim().max(10).default(''),
  collector_number: z.string().trim().max(20).default(''),
})

export const deckInput = z.object({
  user_id: uuid,
  name: z.string().trim().max(120).default(''),
  description: z.string().trim().max(5000).default(''),
  // Décidé à la création : ce deck apparaît-il sur la vitrine publique ?
  showcase: z.boolean().default(false),
  active: z.boolean().default(true),
  created_on: isoDate.nullable().default(null),
  // Un à deux commandants : le second couvre les partenaires.
  commanders: z.array(commanderInput).min(1, 'Au moins un commandant').max(2),
  // Habillage vitrine, ignoré tant que showcase est faux.
  colors: z.array(z.enum(COLOR_CODES)).default([]),
  tag_ids: z.array(uuid).default([]),
  slider: z.array(z.object({
    title: z.string().trim().min(1, 'Titre de section requis').max(120),
    cards: z.array(z.object({ name: z.string().trim().min(1).max(200) })).min(1),
  })).default([]),
})
  // Un deck de statistiques se reconnaît à ses commandants et n'a pas besoin de
  // titre. Un deck affiché sur la vitrine, si : c'est ce qu'on lit dans le menu
  // et en tête de bande.
  .refine((deck) => !deck.showcase || deck.name.length > 0, {
    path: ['name'],
    message: 'Un deck affiché sur le site doit avoir un titre',
  })

export const deckVersionInput = z.object({
  bracket,
  bracket_variation: bracketVariation,
  deck_url: z.union([z.url('Lien invalide'), z.literal('')]).default(''),
  cause: z.enum(['initial', 'newVersion', 'levelAdjustment']).default('newVersion'),
  started_on: isoDate,
})

// ─── Tags ──────────────────────────────────────────────────────────────────
export const tagInput = z.object({
  label: z.string().trim().min(1, 'Le libellé est obligatoire').max(40),
})

// ─── Parties ───────────────────────────────────────────────────────────────
export const gameSeatInput = z.object({
  seat_order: z.number().int().min(1).max(MAX_SEATS),
  deck_version_id: uuid.nullable().default(null),
  user_id: uuid.nullable().default(null),
  player_name: z.string().trim().min(1, 'Nom du joueur requis').max(100),
  result: z.enum(['win', 'loss']),
  bracket,
  bracket_variation: bracketVariation,
  commanders: z.array(z.string().trim().min(1)).default([]),
})

export const gameInput = z.object({
  played_on: isoDate,
  turns: z.number().int().min(1).max(200).nullable().default(null),
  bracket,
  bracket_variation: bracketVariation,
  board_wipes: z.number().int().min(0).max(50).default(0),
  winner_protected_victory: z.boolean().default(false),
  last_player: z.string().trim().max(100).nullable().default(null),
  last_seat_order: z.number().int().min(1).max(MAX_SEATS).nullable().default(null),
  win_style: z.string().trim().max(30).nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
  seats: z.array(gameSeatInput)
    .min(MIN_SEATS, 'Une partie compte au moins 2 joueurs')
    .max(MAX_SEATS, 'Une partie compte au plus 5 joueurs'),
  wipe_events: z.array(z.object({
    turn: z.number().int().min(1),
    player: z.string().trim().min(1),
    countered: z.boolean().default(false),
    countered_by: z.string().trim().nullable().default(null),
    protected: z.array(z.string()).default([]),
    partially_protected: z.array(z.string()).default([]),
  })).default([]),
  mana_events: z.array(z.object({
    mana_rule: z.string().trim().min(1).max(5),
    turn: z.number().int().min(1).nullable().default(null),
    mana_by_player: z.record(z.string(), z.number()).default({}),
  })).default([]),
  death_events: z.array(z.object({
    turn: z.number().int().min(1),
    victims: z.array(z.string().trim().min(1)).min(1),
    killer: z.string().trim().nullable().default(null),
    kill_style: z.string().trim().max(30).nullable().default(null),
  })).default([]),
})
  .refine((g) => g.seats.filter((s) => s.result === 'win').length === 1, {
    message: 'Une partie a exactement un gagnant',
    path: ['seats'],
  })
  .refine((g) => new Set(g.seats.map((s) => s.seat_order)).size === g.seats.length, {
    message: 'Deux joueurs ne peuvent pas occuper le même siège',
    path: ['seats'],
  })
