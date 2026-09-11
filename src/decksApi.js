import { api } from './lib/api.js'
import { decksFromApi, diffById } from './lib/adapters.js'

/**
 * Accès aux decks.
 *
 * C'est le plus délicat des trois : les composants manipulent des LIGNES DE
 * VERSION chaînées par `previousDeckId`, alors que l'API expose des lignées et
 * leurs versions. `decksFromApi` reconstitue la forme historique ; à
 * l'écriture, on décide en fonction du chaînage si une nouvelle ligne est une
 * nouvelle version d'une lignée existante ou une lignée toute neuve.
 */

export async function loadDecks(fallback = []) {
  try {
    return decksFromApi(await api.listDecks())
  } catch {
    return fallback
  }
}

const versionPayload = (row) => ({
  bracket: row.bracket ?? null,
  bracket_variation: row.bracketVariation ?? null,
  deck_url: row.deckUrl ?? '',
  cause: row.cause ?? (row.previousDeckId ? 'newVersion' : 'initial'),
  started_on: row.createdAt ?? new Date().toISOString().slice(0, 10),
})

export async function saveDecks(nextDecks, previousDecks) {
  const { created, updated, removed } = diffById(previousDecks, nextDecks)
  const byId = new Map((previousDecks ?? []).concat(nextDecks ?? []).map((d) => [d.id, d]))

  for (const row of removed) {
    if (!row.lineageId) continue
    try { await api.deleteDeck(row.lineageId) } catch { /* deck joué : conservé */ }
  }

  for (const row of updated) {
    if (!row.lineageId) continue
    // Les champs de lignée et ceux de version se mettent à jour séparément.
    const deck = await api.getDeck(row.lineageId)
    await api.updateDeck(row.lineageId, {
      user_id: row.userId,
      name: deck.name,
      description: deck.description,
      showcase: deck.showcase,
      active: row.active !== false,
      archived: Boolean(row.archived),
      created_on: deck.created_on,
      commanders: deck.commanders,
      colors: deck.colors,
      tag_ids: deck.tag_ids,
      slider: deck.slider,
    })
    await api.updateDeckVersion(row.lineageId, row.id, versionPayload(row))
  }

  const createdIds = new Map()
  for (const row of created) {
    const parent = row.previousDeckId ? byId.get(row.previousDeckId) : null
    const commanders = (Array.isArray(row.com) ? row.com : [row.com])
      .filter(Boolean)
      .map((name) => {
        const print = row.comPrint?.[name]
        return {
          name,
          set_code: print?.set ?? '',
          collector_number: print?.collectorNumber ?? '',
        }
      })

    if (parent?.lineageId) {
      // Nouvelle version d'une lignée existante.
      const version = await api.addDeckVersion(parent.lineageId, versionPayload(row))
      createdIds.set(row.id, version.id)
      continue
    }

    const deck = await api.createDeck({
      deck: {
        user_id: row.userId,
        // Une ligne créée depuis le roster n'a de titre et d'habillage que si
        // la case « afficher sur le site » était cochée à la saisie.
        name: row.name ?? '',
        description: row.description ?? '',
        showcase: Boolean(row.showcase),
        colors: row.colors ?? [],
        tag_ids: row.tagIds ?? [],
        slider: row.showcase ? (row.slider ?? []) : [],
        active: row.active !== false,
        archived: Boolean(row.archived),
        created_on: row.createdAt ?? null,
        commanders,
      },
      version: versionPayload(row),
    })
    createdIds.set(row.id, deck.versions?.[0]?.id ?? deck.id)
  }
  return { createdIds }
}
