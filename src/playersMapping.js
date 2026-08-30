export function asCommanderList(com) {
  return Array.isArray(com) ? com : [com]
}

export function commandersKey(commanders) {
  return [...asCommanderList(commanders)].sort().join(' / ')
}

/** Même commandant + bracket + variation → doublon, on n'ajoute pas. */
export function deckMappingMatches(a, b) {
  return (
    commandersKey(a.com) === commandersKey(b.com) &&
    a.bracket === b.bracket &&
    (a.bracketVariation ?? null) === (b.bracketVariation ?? null)
  )
}

export function findDeckUrlForCommanders(players, commanders) {
  const key = commandersKey(commanders)
  for (const decks of Object.values(players)) {
    for (const deck of decks) {
      if (commandersKey(deck.com) === key && deck.deckUrl) {
        return deck.deckUrl
      }
    }
  }
  return ''
}

export function buildDeckMappingEntry({ commanders, bracket, bracketVariation, deckUrl }) {
  const com = commanders.length === 1 ? commanders[0] : commanders
  return {
    com,
    bracket,
    bracketVariation: bracketVariation ?? null,
    deckUrl: deckUrl || '',
  }
}

/** Complète le mapping joueur avec les decks de la partie (sans doublons exacts). */
export function mergeGameDecksIntoPlayers(players, gameDecks) {
  const updated = JSON.parse(JSON.stringify(players))

  for (const deck of gameDecks) {
    const playerName = deck.player?.trim()
    if (!playerName || !deck.commanders?.length) continue

    const entry = buildDeckMappingEntry({
      commanders: deck.commanders,
      bracket: deck.bracket,
      bracketVariation: deck.bracketVariation,
      deckUrl:
        findDeckUrlForCommanders(updated, deck.commanders) ||
        findDeckUrlForCommanders(players, deck.commanders),
    })

    if (!updated[playerName]) updated[playerName] = []

    const exists = updated[playerName].some((d) => deckMappingMatches(d, entry))
    if (!exists) updated[playerName].push(entry)
  }

  return updated
}

export function getCommanderOptionsFromPlayers(players) {
  const seen = new Set()
  const options = []

  for (const [player, decks] of Object.entries(players)) {
    for (const deck of decks) {
      const commanders = asCommanderList(deck.com)
      const key = commandersKey(commanders)
      if (seen.has(key)) continue
      seen.add(key)
      options.push({
        key,
        label: commanders.join(' / '),
        commanders,
        player,
        bracket: deck.bracket,
        bracketVariation: deck.bracketVariation ?? '',
      })
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label))
}
