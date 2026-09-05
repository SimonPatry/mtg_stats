export function parseJsonText(text, label = 'JSON') {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error(`${label} : contenu vide.`)
  }
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(`${label} : syntaxe invalide — ${err.message}`)
  }
}

export function tryParseJsonText(text) {
  try {
    parseJsonText(text)
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

function indexById(items, label) {
  const map = new Map()
  for (const item of items) {
    if (!item?.id || typeof item.id !== 'string' || !item.id.trim()) {
      throw new Error(`${label} : chaque entrée doit avoir un « id » (string non vide).`)
    }
    if (map.has(item.id)) {
      throw new Error(`${label} : id dupliqué « ${item.id} ».`)
    }
    map.set(item.id, item)
  }
  return map
}

function assertIdsPreserved(beforeMap, afterMap, label) {
  for (const [id] of beforeMap) {
    const afterItem = afterMap.get(id)
    if (!afterItem) {
      throw new Error(
        `${label} : suppression interdite — l'entrée « ${id} » doit rester présente.`,
      )
    }
    if (afterItem.id !== id) {
      throw new Error(
        `${label} : modification interdite de l'id « ${id} ».`,
      )
    }
  }
}

function assertLinkFieldUnchanged(beforeItem, afterItem, field, context) {
  if (beforeItem[field] === undefined || beforeItem[field] === null) return
  const expected = beforeItem[field]
  const actual = afterItem[field]
  if (actual !== expected) {
    throw new Error(
      `${context} : « ${field} » ne peut pas être supprimé ni modifié (était « ${expected} », reçu « ${actual ?? '—'} »).`,
    )
  }
}

export function validateGamesEdit(before, after) {
  if (!Array.isArray(after)) {
    throw new Error('Le JSON doit être un tableau de parties.')
  }
  if (!Array.isArray(before)) {
    throw new Error('État de référence des parties invalide.')
  }

  const beforeMap = indexById(before, 'Parties')
  const afterMap = indexById(after, 'Parties')
  assertIdsPreserved(beforeMap, afterMap, 'Parties')

  for (const [gameId, beforeGame] of beforeMap) {
    const afterGame = afterMap.get(gameId)
    if (!Array.isArray(afterGame.decks)) {
      throw new Error(`Partie « ${gameId} » : « decks » doit être un tableau.`)
    }

    // Protéger les deckId (stables) — seatOrder peut être modifié librement.
    for (const beforeDeck of beforeGame.decks || []) {
      if (beforeDeck.deckId === undefined || beforeDeck.deckId === null) continue
      const afterDeck = afterGame.decks.find(
        (d) => d.deckId === beforeDeck.deckId,
      )
      if (!afterDeck) {
        throw new Error(
          `Partie « ${gameId} » : deckId « ${beforeDeck.deckId} » manquant (ne peut pas être retiré).`,
        )
      }
    }
  }

  for (const game of after) {
    if (!Array.isArray(game.decks)) {
      throw new Error(`Partie « ${game.id} » : « decks » doit être un tableau.`)
    }
  }

  return after
}

export function validateUsersEdit(before, after) {
  if (!Array.isArray(after)) {
    throw new Error('users.json doit être un tableau.')
  }
  if (!Array.isArray(before)) {
    throw new Error('État de référence des users invalide.')
  }

  const beforeMap = indexById(before, 'Users')
  const afterMap = indexById(after, 'Users')
  assertIdsPreserved(beforeMap, afterMap, 'Users')
  return after
}

export function validateDecksEdit(before, after) {
  if (!Array.isArray(after)) {
    throw new Error('decks.json doit être un tableau.')
  }
  if (!Array.isArray(before)) {
    throw new Error('État de référence des decks invalide.')
  }

  const beforeMap = indexById(before, 'Decks')
  const afterMap = indexById(after, 'Decks')
  assertIdsPreserved(beforeMap, afterMap, 'Decks')

  for (const [deckId, beforeDeck] of beforeMap) {
    const afterDeck = afterMap.get(deckId)
    assertLinkFieldUnchanged(beforeDeck, afterDeck, 'userId', `Deck « ${deckId} »`)
    assertLinkFieldUnchanged(
      beforeDeck,
      afterDeck,
      'previousDeckId',
      `Deck « ${deckId} »`,
    )
  }

  return after
}

export function validateNewGameDraft(expectedGameId, game) {
  if (!game || typeof game !== 'object') {
    throw new Error('JSON partie : objet attendu.')
  }
  if (!expectedGameId) {
    throw new Error('JSON partie : id manquant.')
  }
  if (game.id !== expectedGameId) {
    throw new Error(
      `JSON partie : l'id ne peut pas être modifié (attendu « ${expectedGameId} »).`,
    )
  }
  if (!game.date || !Array.isArray(game.decks) || game.decks.length !== 4) {
    throw new Error('JSON partie : structure invalide.')
  }
  if (!game.decks.some((d) => d.result === 'win')) {
    throw new Error('JSON partie : un gagnant est requis.')
  }
  return game
}

export function validateCatalogEdits({ usersBefore, usersAfter, decksBefore, decksAfter }) {
  validateUsersEdit(usersBefore, usersAfter)
  validateDecksEdit(decksBefore, decksAfter)
  return { users: usersAfter, decks: decksAfter }
}
