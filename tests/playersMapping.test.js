import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { users, decks, games } from './helpers.js'
import {
  asCommanderList, commandersKey, parseCommandersInput,
  getActiveUsers, getActiveDecks, getUserByName, getUserName,
  getCurrentDeckForCommanders, findDeckForCommanders, resolveDeckFromCatalog,
  getDeckVersionChain, getDeckChainHistory, computeStatsByDeckId,
  formatBracketLine, formatCommanders, addUser, deactivateUser,
  ensureUserByName, alterDeck, deactivateDeck,
} from '../src/playersMapping.js'

describe('commandants', () => {
  test('asCommanderList normalise une chaîne en liste (partenaires)', () => {
    assert.deepEqual(asCommanderList('Atraxa'), ['Atraxa'])
    assert.deepEqual(asCommanderList(['Tana', 'Tymna']), ['Tana', 'Tymna'])
  })

  test('commandersKey est indépendante de l’ordre des partenaires', () => {
    assert.equal(commandersKey(['Tymna', 'Tana']), commandersKey(['Tana', 'Tymna']))
    assert.equal(commandersKey(['Tana', 'Tymna']), 'Tana / Tymna')
  })

  test('parseCommandersInput découpe sur « / »', () => {
    assert.deepEqual(parseCommandersInput('Tana / Tymna'), ['Tana', 'Tymna'])
    assert.deepEqual(parseCommandersInput('  Atraxa  '), ['Atraxa'])
    // Une saisie vide rend null, pas un tableau vide : le formulaire distingue
    // « rien saisi » de « saisi mais invalide ».
    assert.equal(parseCommandersInput(''), null)
  })

  test('formatCommanders rend une liste lisible', () => {
    assert.equal(formatCommanders(['Tana', 'Tymna']), 'Tana / Tymna')
    assert.equal(formatCommanders('Atraxa'), 'Atraxa')
  })
})

describe('catalogue joueurs et decks (jeu de test)', () => {
  test('le jeu de test contient 5 joueurs, 36 decks, 43 parties', () => {
    assert.equal(users.length, 5)
    assert.equal(decks.length, 36)
    assert.equal(games.length, 43)
  })

  test('getActiveUsers / getActiveDecks filtrent sur active !== false', () => {
    assert.equal(getActiveUsers(users).length, users.filter((u) => u.active !== false).length)
    assert.equal(getActiveDecks(decks).length, decks.filter((d) => d.active !== false).length)
  })

  test('getUserByName est insensible à la casse et aux espaces', () => {
    const simon = getUserByName(users, 'Simon')
    assert.ok(simon)
    assert.equal(getUserByName(users, '  simon ')?.id, simon.id)
  })

  test('getUserName retombe sur « Inconnu » pour un identifiant absent', () => {
    assert.equal(getUserName(users, 'nope'), 'Inconnu')
  })
})

describe('versions de deck', () => {
  const versioned = decks.find((d) => d.previousDeckId)

  test('le jeu de test contient bien des chaînes de versions', () => {
    assert.ok(versioned, 'aucun deck versionné dans le jeu de test')
    assert.equal(decks.filter((d) => d.previousDeckId).length, 15)
  })

  test('getDeckVersionChain remonte et redescend toute la chaîne', () => {
    const chain = getDeckVersionChain(decks, versioned.id)
    assert.ok(chain.length >= 2)
    // ordre chronologique : la première n'a pas de parent dans la chaîne
    assert.equal(chain[0].previousDeckId ?? null, null)
    // chaque maillon pointe vers le précédent
    for (let i = 1; i < chain.length; i += 1) {
      assert.equal(chain[i].previousDeckId, chain[i - 1].id)
    }
    // le deck demandé fait partie de la chaîne
    assert.ok(chain.some((d) => d.id === versioned.id))
  })

  test('la chaîne est la même quel que soit le maillon interrogé', () => {
    const chain = getDeckVersionChain(decks, versioned.id)
    const fromFirst = getDeckVersionChain(decks, chain[0].id)
    assert.deepEqual(fromFirst.map((d) => d.id), chain.map((d) => d.id))
  })

  test('getDeckVersionChain rend [] pour un identifiant inconnu ou vide', () => {
    assert.deepEqual(getDeckVersionChain(decks, 'inconnu'), [])
    assert.deepEqual(getDeckVersionChain(decks, null), [])
  })

  test('getDeckChainHistory agrège l’historique, du plus récent au plus ancien', () => {
    const items = getDeckChainHistory(decks, versioned.id)
    assert.ok(items.length > 0)
    const dates = items.map((i) => String(i.date))
    assert.deepEqual(dates, [...dates].sort().reverse())
    assert.ok(items.every((i) => i.versionIndex >= 1))
  })

  test('getCurrentDeckForCommanders rend la version courante, pas une ancienne', () => {
    const chain = getDeckVersionChain(decks, versioned.id)
    const last = chain[chain.length - 1]
    const current = getCurrentDeckForCommanders(decks, asCommanderList(last.com))
    assert.ok(current)
    // la version rendue ne doit être remplacée par aucune autre version active
    const superseded = getActiveDecks(decks).some((d) => d.previousDeckId === current.id)
    assert.equal(superseded, false)
  })
})

describe('résolution d’un deck de partie vers le catalogue', () => {
  test('un deckId connu ramène le joueur, les commandants et l’URL du catalogue', () => {
    const known = decks.find((d) => d.deckUrl)
    const resolved = resolveDeckFromCatalog(decks, users, { deckId: known.id, result: 'win' })
    assert.equal(resolved.deckId, known.id)
    assert.equal(resolved.userId, known.userId)
    assert.equal(resolved.player, getUserName(users, known.userId))
    assert.deepEqual(resolved.commanders, asCommanderList(known.com))
    assert.equal(resolved.deckUrl, known.deckUrl)
  })

  test('sans deckId, la résolution se fait par commandants', () => {
    const known = getActiveDecks(decks)[0]
    const resolved = resolveDeckFromCatalog(decks, users, {
      commanders: asCommanderList(known.com),
      player: '',
      result: 'loss',
    })
    assert.ok(resolved.deckId, 'aucun deck retrouvé par commandants')
    assert.equal(commandersKey(resolved.commanders), commandersKey(known.com))
  })

  test('un deck inconnu reste tel quel, joueur « Inconnu » et URL « # »', () => {
    const resolved = resolveDeckFromCatalog(decks, users, {
      commanders: ['Commandant Fantôme'],
      player: '',
      result: 'loss',
    })
    assert.equal(resolved.player, 'Inconnu')
    assert.equal(resolved.deckUrl, '#')
    assert.equal(resolved.deckId, undefined)
  })

  test('les valeurs portées par la partie priment sur le catalogue', () => {
    const known = decks.find((d) => d.bracket != null)
    const resolved = resolveDeckFromCatalog(decks, users, {
      deckId: known.id,
      player: 'Nom Figé',
      bracket: 4,
      bracketVariation: 'high',
      result: 'win',
    })
    assert.equal(resolved.player, 'Nom Figé')
    assert.equal(resolved.bracket, 4)
    assert.equal(resolved.bracketVariation, 'high')
  })
})

describe('statistiques par deck', () => {
  const stats = computeStatsByDeckId(games, users, decks)

  test('chaque partie compte une participation par siège', () => {
    const totalSeats = games.reduce((n, g) => n + g.decks.length, 0)
    const counted = Object.values(stats).reduce((n, s) => n + s.games, 0)
    // seuls les decks résolus vers un identifiant sont comptés
    assert.ok(counted <= totalSeats)
    assert.ok(counted > 0)
  })

  test('il y a exactement une victoire par partie', () => {
    const wins = games.reduce((n, g) => n + g.decks.filter((d) => d.result === 'win').length, 0)
    assert.equal(wins, games.length)
  })

  test('aucun deck n’a plus de victoires que de parties', () => {
    for (const [id, s] of Object.entries(stats)) {
      assert.ok(s.wins <= s.games, `${id} : ${s.wins} victoires pour ${s.games} parties`)
    }
  })

  test('le total des victoires comptées ne dépasse pas le nombre de parties', () => {
    const wins = Object.values(stats).reduce((n, s) => n + s.wins, 0)
    assert.ok(wins <= games.length)
  })
})

describe('mutations du catalogue (fonctions pures, sans effet de bord)', () => {
  test('addUser ajoute sans muter le tableau d’origine', () => {
    const before = users.length
    const next = addUser(users, 'Nouveau Joueur')
    assert.equal(users.length, before, 'le tableau source a été muté')
    assert.equal(next.length, before + 1)
    assert.ok(getUserByName(next, 'Nouveau Joueur'))
  })

  test('deactivateUser marque actif = false sans supprimer', () => {
    const target = users[0]
    const next = deactivateUser(users, target.id)
    assert.equal(next.length, users.length)
    assert.equal(next.find((u) => u.id === target.id).active, false)
  })

  test('ensureUserByName réutilise un joueur existant plutôt que d’en créer un', () => {
    const { users: next, userId } = ensureUserByName(users, 'Simon')
    assert.equal(next.length, users.length)
    assert.equal(userId, getUserByName(users, 'Simon').id)
  })

  test('alterDeck ne touche que le deck visé', () => {
    const target = decks[0]
    const next = alterDeck(decks, target.id, { deckUrl: 'https://exemple.test/x' })
    assert.equal(next.find((d) => d.id === target.id).deckUrl, 'https://exemple.test/x')
    assert.equal(next.length, decks.length)
    assert.equal(decks[0].deckUrl, target.deckUrl, 'le tableau source a été muté')
  })

  test('deactivateDeck désactive sans supprimer', () => {
    const target = getActiveDecks(decks)[0]
    const next = deactivateDeck(decks, target.id)
    assert.equal(next.find((d) => d.id === target.id).active, false)
    assert.equal(next.length, decks.length)
  })
})

describe('affichage des brackets', () => {
  test('formatBracketLine compose le niveau et sa variation', () => {
    assert.equal(formatBracketLine(2, null), 'B2')
    assert.equal(formatBracketLine(3, 'high'), 'B3 - high')
    assert.equal(formatBracketLine(3, 'low'), 'B3 - low')
  })
})
