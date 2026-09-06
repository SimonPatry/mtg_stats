import {
  resolveDeckFromCatalog,
  getUserName,
  commandersKey,
  getCurrentDeckForCommanders,
  getDeckVersionChain,
  getActiveDecks,
  asCommanderList,
} from './playersMapping.js'
import { getBoardWipes } from './gamesApi.js'

/**
 * Calculs du tableau de bord.
 *
 * Extrait de App.jsx sans modification : ces fonctions étaient définies à
 * l'intérieur du composant et donc intestables. C'est la logique métier la
 * plus précieuse du projet — un winrate faux ne se voit pas à l'œil — et elle
 * doit survivre à l'identique au passage en base de données.
 */

export function resolveDeck(deck, users, decks) {
  return resolveDeckFromCatalog(decks, users, deck)
}

export function deckLabel(deck) {
  return deck.commanders.join(' / ')
}

export function computeStats(games, users, decks) {
  const totalGames = games.length
  const avgTurns =
    totalGames === 0
      ? 0
      : (games.reduce((sum, g) => sum + g.turns, 0) / totalGames).toFixed(1)

  const avgBoardWipes =
    totalGames === 0
      ? 0
      : (
          games.reduce((sum, g) => sum + getBoardWipes(g), 0) / totalGames
        ).toFixed(1)

  const protectedRate =
    totalGames === 0
      ? 0
      : Math.round(
          (games.filter((g) => g.winnerProtectedVictory).length / totalGames) *
            100,
        )

  const winsByDeck = {}
  const winsByPlayer = {}

  // Liste commandants = catalogue (decks actifs, version courante), stats ensuite
  for (const record of getActiveDecks(decks)) {
    const superseded = getActiveDecks(decks).some(
      (other) => other.previousDeckId === record.id,
    )
    if (superseded) continue
    winsByDeck[record.id] = {
      wins: 0,
      games: 0,
      deckId: record.id,
      deckUrl: record.deckUrl,
      commanders: asCommanderList(record.com),
      player: getUserName(users, record.userId),
      bracket: record.bracket,
      bracketVariation: record.bracketVariation ?? null,
      tags: record.tags ?? [],
    }
  }

  function findDeckStatsKey(deck) {
    if (deck.deckId && winsByDeck[deck.deckId]) return deck.deckId

    // Le siège porte l'identifiant d'une version antérieure : on remonte sa
    // chaîne de versions jusqu'à la version courante. C'est le seul
    // rattachement fiable, parce qu'il suit le deck lui-même — deux joueurs
    // peuvent parfaitement jouer le même commandant.
    if (deck.deckId) {
      const chain = getDeckVersionChain(decks, deck.deckId)
      const current = chain[chain.length - 1]
      if (current && winsByDeck[current.id]) return current.id
    }

    // Sans identifiant de deck, on apparie sur joueur + commandants. Cet
    // appariement passe AVANT la recherche par commandants seuls : celle-ci
    // ignore le propriétaire et attribuait les parties au mauvais joueur dès
    // que deux personnes jouaient le même commandant.
    const comKey = commandersKey(deck.commanders)
    const byPlayer = Object.keys(winsByDeck).find((id) => {
      const entry = winsByDeck[id]
      return (
        entry.player === deck.player &&
        commandersKey(entry.commanders) === comKey
      )
    })
    if (byPlayer) return byPlayer

    const current = getCurrentDeckForCommanders(decks, deck.commanders)
    if (current && winsByDeck[current.id]) return current.id

    return null
  }

  for (const game of games) {
    for (const raw of game.decks) {
      const deck = resolveDeck(raw, users, decks)
      let key = findDeckStatsKey(deck)
      if (!key) {
        key = `orphan:${deck.deckId ?? deckLabel(deck)}:${deck.player}`
        winsByDeck[key] = {
          wins: 0,
          games: 0,
          deckId: deck.deckId,
          deckUrl: deck.deckUrl,
          commanders: deck.commanders,
          player: deck.player,
          bracket: deck.bracket,
          bracketVariation: deck.bracketVariation,
          tags: [],
        }
      }
      winsByDeck[key].games += 1
      if (deck.result === 'win') winsByDeck[key].wins += 1

      if (!winsByPlayer[deck.player]) {
        winsByPlayer[deck.player] = { wins: 0, games: 0 }
      }
      winsByPlayer[deck.player].games += 1
      if (deck.result === 'win') winsByPlayer[deck.player].wins += 1
    }
  }

  return {
    totalGames,
    avgTurns,
    avgBoardWipes,
    protectedRate,
    winsByDeck,
    winsByPlayer,
  }
}
