import { v4 as uuidv4 } from 'uuid'

export function createUserId() {
  return uuidv4()
}

export function createDeckId() {
  return uuidv4()
}

export function asCommanderList(com) {
  return Array.isArray(com) ? com : [com]
}

export function commandersKey(commanders) {
  return [...asCommanderList(commanders)].sort().join(' / ')
}

export function getActiveUsers(users) {
  return users.filter((u) => u.active !== false)
}

export function getActiveDecks(decks) {
  return decks.filter((d) => d.active !== false && !d.archived)
}

export function getUserById(users, userId) {
  return users.find((u) => u.id === userId)
}

export function getUserByName(users, name) {
  const trimmed = name.trim().toLowerCase()
  return users.find(
    (u) => u.active !== false && u.name.trim().toLowerCase() === trimmed,
  )
}

export function getUserName(users, userId) {
  return getUserById(users, userId)?.name ?? 'Inconnu'
}

export function getDeckById(decks, deckId) {
  return decks.find((d) => d.id === deckId)
}

export function getDecksForUser(decks, userId, { activeOnly = true, includeArchived = false } = {}) {
  return decks.filter(
    (d) =>
      d.userId === userId
      && (!activeOnly || d.active !== false)
      && (includeArchived || !d.archived),
  )
}

/** Même commandant + bracket + variation → doublon actif pour un joueur. */
export function deckMappingMatches(a, b) {
  return (
    commandersKey(a.com) === commandersKey(b.com) &&
    a.bracket === b.bracket &&
    (a.bracketVariation ?? null) === (b.bracketVariation ?? null)
  )
}

export function formatComPrint(printing) {
  return {
    scryfallId: printing.id,
    set: String(printing.setCode || '').toLowerCase(),
    collectorNumber: printing.collectorNumber,
    setName: printing.setName,
    imageUrl: printing.imageUrl || '',
  }
}

export function formatComPrintLabel(print) {
  if (!print?.set) return ''
  return `${String(print.set).toUpperCase()} #${print.collectorNumber}`
}

export function buildDeckEntry({
  userId,
  commanders,
  bracket,
  bracketVariation,
  deckUrl,
  comPrint,
  id,
  createdAt,
}) {
  const com = commanders.length === 1 ? commanders[0] : commanders
  const entry = {
    id: id ?? createDeckId(),
    userId,
    com,
    bracket,
    bracketVariation: bracketVariation ?? null,
    deckUrl: deckUrl || '',
    active: true,
    createdAt: createdAt ?? new Date().toISOString().slice(0, 10),
  }
  if (comPrint && Object.keys(comPrint).length > 0) {
    entry.comPrint = comPrint
  }
  return entry
}

export function findDeckForCommanders(users, decks, commanders) {
  const deck = getCurrentDeckForCommanders(decks, commanders)
  if (!deck) return null
  const user = getUserById(users, deck.userId)
  return {
    deckId: deck.id,
    userId: deck.userId,
    player: user?.name ?? 'Inconnu',
    commanders: asCommanderList(deck.com),
    bracket: deck.bracket,
    bracketVariation: deck.bracketVariation ?? null,
    deckUrl: deck.deckUrl,
    comPrint: deck.comPrint,
    previousDeckId: deck.previousDeckId,
    history: deck.history,
  }
}

/** Deck actif « courant » pour une liste de commandants (fin de chaîne de versions). */
export function getCurrentDeckForCommanders(decks, commanders) {
  const key = commandersKey(commanders)
  const matches = getActiveDecks(decks).filter(
    (d) => commandersKey(d.com) === key,
  )
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  const current = matches.filter(
    (d) => !matches.some((other) => other.previousDeckId === d.id),
  )
  return current[0] ?? matches[matches.length - 1]
}

export function resolveDeckFromCatalog(decks, users, gameDeck) {
  if (gameDeck.deckId) {
    const record = getDeckById(decks, gameDeck.deckId)
    if (record) {
      return {
        ...gameDeck,
        player: gameDeck.player || getUserName(users, record.userId),
        commanders: gameDeck.commanders?.length
          ? gameDeck.commanders
          : asCommanderList(record.com),
        bracket: gameDeck.bracket ?? record.bracket,
        bracketVariation:
          gameDeck.bracketVariation !== undefined
            ? gameDeck.bracketVariation
            : (record.bracketVariation ?? null),
        deckUrl: record.deckUrl || gameDeck.deckUrl || '#',
        deckId: record.id,
        userId: record.userId,
        previousDeckId: record.previousDeckId,
        history: record.history,
      }
    }
  }

  const owned = findDeckForCommanders(users, decks, gameDeck.commanders)
  if (!owned) {
    return {
      ...gameDeck,
      player: gameDeck.player || 'Inconnu',
      deckUrl: gameDeck.deckUrl ?? '#',
    }
  }

  return {
    ...gameDeck,
    player: gameDeck.player || owned.player,
    bracket: gameDeck.bracket ?? owned.bracket,
    bracketVariation:
      gameDeck.bracketVariation !== undefined
        ? gameDeck.bracketVariation
        : (owned.bracketVariation ?? null),
    deckUrl: owned.deckUrl ?? gameDeck.deckUrl ?? '#',
    deckId: owned.deckId,
    userId: owned.userId,
    previousDeckId: owned.previousDeckId,
    history: owned.history,
  }
}

export function findDeckUrlForCommanders(decks, commanders) {
  const key = commandersKey(commanders)
  for (const deck of getActiveDecks(decks)) {
    if (commandersKey(deck.com) === key && deck.deckUrl) {
      return deck.deckUrl
    }
  }
  return ''
}

export function parseCommandersInput(raw) {
  const parts = String(raw)
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts : null
}

export function addUser(users, name) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Nom du joueur requis.')
  if (getUserByName(users, trimmed)) {
    throw new Error(`Le joueur « ${trimmed} » existe déjà.`)
  }
  return [...users, { id: createUserId(), name: trimmed, active: true }]
}

export function deactivateUser(users, userId) {
  const user = getUserById(users, userId)
  if (!user) throw new Error('Joueur introuvable.')
  return users.map((u) =>
    u.id === userId ? { ...u, active: false } : u,
  )
}

export function addDeckToUser(decks, users, userId, deck) {
  const user = getUserById(users, userId)
  if (!user || user.active === false) throw new Error('Joueur introuvable.')

  const commanders = parseCommandersInput(deck.commanders)
  if (!commanders) throw new Error('Commandant requis.')
  if (deck.bracket == null || deck.bracket === '') {
    throw new Error('Bracket requis.')
  }

  const entry = buildDeckEntry({
    userId,
    commanders,
    bracket: Number(deck.bracket),
    bracketVariation: deck.bracketVariation ?? null,
    deckUrl: deck.deckUrl ?? '',
    comPrint: deck.comPrint,
  })

  const exists = getDecksForUser(decks, userId).some((d) =>
    deckMappingMatches(d, entry),
  )
  if (exists) throw new Error('Ce deck existe déjà pour ce joueur.')

  // Champs de vitrine, présents seulement si la case « afficher sur le site »
  // était cochée. Ils voyagent sur la ligne jusqu'à `saveDecks`, qui les passe
  // à la création de la lignée.
  if (deck.showcase) {
    entry.showcase = true
    entry.name = deck.name ?? ''
    entry.description = deck.description ?? ''
    entry.colors = deck.colors ?? []
    entry.tagIds = deck.tagIds ?? []
    entry.slider = deck.slider ?? []
  }

  return [...decks, entry]
}

/** Met à jour un deck sans toucher id ni userId. */
export function alterDeck(decks, deckId, updates) {
  const deck = getDeckById(decks, deckId)
  if (!deck) throw new Error('Deck introuvable.')

  return decks.map((d) => {
    if (d.id !== deckId) return d
    const next = { ...d, ...updates, id: d.id, userId: d.userId }
    if (updates.com) {
      next.com =
        updates.com.length === 1 ? updates.com[0] : updates.com
    }
    return next
  })
}

/**
 * Modifie le bracket / variation d'un deck.
 * - newVersion : nouveau deck actif + previousDeckId, ancien désactivé
 * - levelAdjustment : même id, entrée dans history (date + anciennes valeurs)
 */
export function editDeckPowerLevel(
  decks,
  deckId,
  { bracket, bracketVariation, reason, deckUrl },
) {
  const deck = getDeckById(decks, deckId)
  if (!deck || deck.active === false) throw new Error('Deck introuvable.')

  const nextUrl =
    deckUrl !== undefined ? String(deckUrl).trim() : (deck.deckUrl ?? '')
  const newBracket = Number(bracket)
  if (Number.isNaN(newBracket) || newBracket < 1 || newBracket > 4) {
    throw new Error('Bracket invalide.')
  }

  const newVariation = bracketVariation ?? null
  const oldBracket = deck.bracket
  const oldVariation = deck.bracketVariation ?? null
  const bracketChanged =
    newBracket !== oldBracket || newVariation !== oldVariation
  const urlChanged = nextUrl !== (deck.deckUrl ?? '')

  if (!bracketChanged) {
    if (!urlChanged) {
      throw new Error('Aucune modification à enregistrer.')
    }
    return decks.map((d) =>
      d.id === deckId ? { ...d, deckUrl: nextUrl } : d,
    )
  }

  if (reason === 'newVersion') {
    const newDeck = buildDeckEntry({
      userId: deck.userId,
      commanders: asCommanderList(deck.com),
      bracket: newBracket,
      bracketVariation: newVariation,
      deckUrl: nextUrl || deck.deckUrl,
      comPrint: deck.comPrint,
    })
    newDeck.previousDeckId = deck.id

    return [
      ...decks.map((d) => (d.id === deckId ? { ...d, active: false } : d)),
      newDeck,
    ]
  }

  if (reason === 'levelAdjustment') {
    const historyEntry = {
      date: new Date().toISOString().slice(0, 10),
      previousValue: formatBracketLine(oldBracket, oldVariation),
      newValue: formatBracketLine(newBracket, newVariation),
      cause: 'levelAdjustment',
      bracket: oldBracket,
      bracketVariation: oldVariation,
    }

    return decks.map((d) => {
      if (d.id !== deckId) return d
      return {
        ...d,
        bracket: newBracket,
        bracketVariation: newVariation,
        deckUrl: nextUrl,
        history: [...(d.history || []), historyEntry],
        id: d.id,
        userId: d.userId,
      }
    })
  }

  throw new Error('Choisis le type de modification (nouvelle version ou réajustement).')
}

export function deactivateDeck(decks, deckId) {
  return alterDeck(decks, deckId, { active: false })
}

export function ensureUserByName(users, name) {
  const trimmed = name.trim()
  if (!trimmed) return { users, userId: null }
  const existing = getUserByName(users, trimmed)
  if (existing) return { users, userId: existing.id }
  const inactive = users.find(
    (u) => u.active === false && u.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  if (inactive) {
    return {
      users: users.map((u) =>
        u.id === inactive.id ? { ...u, active: true } : u,
      ),
      userId: inactive.id,
    }
  }
  throw new Error(
    `Joueur inconnu « ${trimmed} » — il doit d’abord s’inscrire sur le site.`,
  )
}

/** Complète users/decks avec les decks de la partie (sans doublons actifs). */
export function mergeGameDecksIntoCatalog(users, decks, gameDecks) {
  let nextUsers = [...users]
  let nextDecks = [...decks]

  for (const gameDeck of gameDecks) {
    const playerName = gameDeck.player?.trim()
    if (!playerName || !gameDeck.commanders?.length) continue

    const ensured = ensureUserByName(nextUsers, playerName)
    nextUsers = ensured.users
    const { userId } = ensured
    if (!userId) continue

    const entry = buildDeckEntry({
      userId,
      commanders: gameDeck.commanders,
      bracket: gameDeck.bracket,
      bracketVariation: gameDeck.bracketVariation,
      deckUrl:
        findDeckUrlForCommanders(nextDecks, gameDeck.commanders) ||
        findDeckUrlForCommanders(decks, gameDeck.commanders),
    })

    const exists = getDecksForUser(nextDecks, userId).some((d) =>
      deckMappingMatches(d, entry),
    )
    if (!exists) nextDecks = [...nextDecks, entry]
  }

  return { users: nextUsers, decks: nextDecks }
}

export function formatBracketLine(bracket, bracketVariation) {
  if (bracket == null) return '—'
  const base = `B${bracket}`
  if (bracketVariation === 'low' || bracketVariation === 'high') {
    return `${base} - ${bracketVariation}`
  }
  return base
}

const HISTORY_CAUSE_LABELS = {
  levelAdjustment: 'Réajustement du niveau',
  newVersion: 'Nouvelle version du deck',
}

export function describeHistoryEntry(entry) {
  const previousValue =
    entry.previousValue ??
    entry.changedValue ??
    formatBracketLine(entry.bracket, entry.bracketVariation ?? null)
  const newValue = entry.newValue ?? null
  const levelTransition = newValue
    ? `${previousValue} → ${newValue}`
    : previousValue
  const cause =
    HISTORY_CAUSE_LABELS[entry.cause] ??
    entry.cause ??
    HISTORY_CAUSE_LABELS.levelAdjustment

  return {
    date: entry.date,
    previousValue,
    newValue,
    levelTransition,
    cause,
  }
}

/** Chaîne complète des versions d'un deck (ancienne → actuelle). */
export function getDeckVersionChain(decks, deckId) {
  if (!deckId) return []
  const byId = new Map(decks.map((d) => [d.id, d]))
  let node = byId.get(deckId)
  if (!node) return []

  const chain = [node]
  while (node.previousDeckId && byId.has(node.previousDeckId)) {
    node = byId.get(node.previousDeckId)
    chain.unshift(node)
  }

  let tail = chain[chain.length - 1]
  while (true) {
    const next = decks.find((d) => d.previousDeckId === tail.id)
    if (!next || chain.some((d) => d.id === next.id)) break
    chain.push(next)
    tail = next
  }

  return chain
}

/** Date de création d'une version (cataloguée ou déduite). */
export function getDeckCreatedAt(deck, chain) {
  if (deck.createdAt) return deck.createdAt

  const firstHistoryDate = [...(deck.history ?? [])]
    .map((h) => h.date)
    .filter(Boolean)
    .sort()[0]
  if (firstHistoryDate) return firstHistoryDate

  const chainDates = chain
    .flatMap((d) => (d.history ?? []).map((h) => h.date))
    .filter(Boolean)
    .sort()
  if (chainDates[0]) {
    const d = new Date(`${chainDates[0]}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 14)
    return d.toISOString().slice(0, 10)
  }

  return new Date().toISOString().slice(0, 10)
}

/** Historique agrégé de toutes les versions (plus récent en premier). */
export function getDeckChainHistory(decks, deckId) {
  const chain = getDeckVersionChain(decks, deckId)
  const multi = chain.length > 1
  const items = []

  chain.forEach((record, index) => {
    const versionLabel = multi ? `Version ${index + 1}` : null
    for (const entry of record.history ?? []) {
      items.push({
        ...describeHistoryEntry(entry),
        versionLabel,
        versionIndex: index + 1,
        deckId: record.id,
        isCurrentDeck: record.id === deckId,
      })
    }
  })

  if (multi && chain[0] && !(chain[0].history?.length)) {
    const first = chain[0]
    const level = formatBracketLine(first.bracket, first.bracketVariation)
    items.push({
      date: getDeckCreatedAt(first, chain),
      previousValue: null,
      newValue: level,
      levelTransition: level,
      cause: 'Version initiale',
      versionLabel: 'Version 1',
      versionIndex: 1,
      deckId: first.id,
      isInitial: true,
    })
  }

  items.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return items
}

export function computeStatsByDeckId(games, users, decks) {
  const byId = {}
  for (const game of games) {
    for (const raw of game.decks) {
      const resolved = resolveDeckFromCatalog(decks, users, raw)
      const id = resolved.deckId
      if (!id) continue
      if (!byId[id]) {
        byId[id] = { wins: 0, games: 0 }
      }
      byId[id].games += 1
      if (resolved.result === 'win') byId[id].wins += 1
    }
  }
  return byId
}

export function formatCommanders(com) {
  return asCommanderList(com).join(' / ')
}

/** Tous les decks actifs pour filtres (commandant + joueur). */
export function getDeckFilterOptions(users, decks) {
  return getActiveDecks(decks)
    .map((deck) => ({
      deckId: deck.id,
      commanders: asCommanderList(deck.com),
      label: formatCommanders(deck.com),
      player: getUserName(users, deck.userId),
    }))
    .sort((a, b) => {
      const byCom = a.label.localeCompare(b.label)
      return byCom !== 0 ? byCom : a.player.localeCompare(b.player)
    })
}

export function getCommanderOptionsFromCatalog(users, decks) {
  const seen = new Set()
  const options = []

  for (const deck of getActiveDecks(decks)) {
    const commanders = asCommanderList(deck.com)
    const key = commandersKey(commanders)
    if (seen.has(key)) continue
    const superseded = getActiveDecks(decks).some(
      (other) => other.previousDeckId === deck.id,
    )
    if (superseded) continue
    seen.add(key)
    options.push(buildCommanderOption(deck, users))
  }

  return options.sort((a, b) => a.label.localeCompare(b.label))
}

function buildCommanderOption(deck, users) {
  const commanders = asCommanderList(deck.com)
  return {
    key: commandersKey(commanders),
    label: commanders.join(' / '),
    commanders,
    deckId: deck.id,
    userId: deck.userId,
    player: getUserName(users, deck.userId),
    bracket: deck.bracket,
    bracketVariation: deck.bracketVariation ?? '',
  }
}

/** Decks actifs courants d'un joueur (triés par nom de commandant). */
export function getCommanderOptionsForUser(users, decks, userId) {
  if (!userId) return []
  const userDecks = getActiveDecks(decks).filter((d) => d.userId === userId)
  const options = []

  for (const deck of userDecks) {
    const superseded = userDecks.some((other) => other.previousDeckId === deck.id)
    if (superseded) continue
    options.push(buildCommanderOption(deck, users))
  }

  return options.sort((a, b) => a.label.localeCompare(b.label))
}

export function getDeckOptionById(users, decks, deckId) {
  const deck = getDeckById(decks, deckId)
  if (!deck) return null
  return buildCommanderOption(deck, users)
}
