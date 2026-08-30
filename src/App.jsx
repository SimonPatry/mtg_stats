import { useEffect, useState } from 'react'
import initialGames from './data/games_test.json'
import initialPlayers from './data/players.json'
import { fetchCommanderImage } from './scryfall'
import { loadGames, saveGames } from './gamesApi'
import { loadPlayers, savePlayers } from './playersApi'
import { asCommanderList, commandersKey } from './playersMapping'
import AddGameForm from './AddGameForm'

/** Premier joueur de la liste dont un deck matche les commandants. */
function findPlayerForCommanders(players, commanders) {
  const key = commandersKey(commanders)
  for (const [player, decks] of Object.entries(players)) {
    const deck = decks.find((d) => commandersKey(asCommanderList(d.com)) === key)
    if (deck) {
      return {
        player,
        commanders: asCommanderList(deck.com),
        bracket: deck.bracket,
        bracketVariation: deck.bracketVariation ?? null,
        deckUrl: deck.deckUrl,
      }
    }
  }
  return null
}

function resolveDeck(deck, players) {
  const owned = findPlayerForCommanders(players, deck.commanders)
  return {
    ...deck,
    player: deck.player || owned?.player || 'Inconnu',
    commanders: deck.commanders,
    bracket: deck.bracket ?? owned?.bracket ?? null,
    bracketVariation:
      deck.bracketVariation !== undefined
        ? deck.bracketVariation
        : (owned?.bracketVariation ?? null),
    deckUrl: owned?.deckUrl ?? deck.deckUrl ?? '#',
  }
}

function deckLabel(deck) {
  return deck.commanders.join(' / ')
}

function computeStats(games, players) {
  const totalGames = games.length
  const avgTurns =
    totalGames === 0
      ? 0
      : (games.reduce((sum, g) => sum + g.turns, 0) / totalGames).toFixed(1)

  const wipeRate =
    totalGames === 0
      ? 0
      : Math.round((games.filter((g) => g.hadWipe).length / totalGames) * 100)

  const protectedRate =
    totalGames === 0
      ? 0
      : Math.round(
          (games.filter((g) => g.winnerProtectedVictory).length / totalGames) *
            100,
        )

  const winsByDeck = {}
  const winsByPlayer = {}

  for (const game of games) {
    for (const raw of game.decks) {
      const deck = resolveDeck(raw, players)
      const key = deckLabel(deck)

      if (!winsByDeck[key]) {
        winsByDeck[key] = {
          wins: 0,
          games: 0,
          deckUrl: deck.deckUrl,
          commanders: deck.commanders,
          player: deck.player,
          bracket: deck.bracket,
          bracketVariation: deck.bracketVariation,
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
    wipeRate,
    protectedRate,
    winsByDeck,
    winsByPlayer,
  }
}

function formatBracket({ bracket, bracketVariation }) {
  if (bracket == null) return 'B?'
  if (!bracketVariation) return `B${bracket}`
  return `B${bracket} · ${bracketVariation}`
}

function useFloatImages(names) {
  const [srcs, setSrcs] = useState([])

  useEffect(() => {
    if (!names?.length) {
      setSrcs([])
      return
    }
    let cancelled = false

    // Show cached/normal first for instant paint, then upgrade to large
    Promise.all(names.map((name) => fetchCommanderImage(name, 'normal')))
      .then((urls) => {
        if (!cancelled) setSrcs(urls)
      })
      .catch(() => {})

    Promise.all(names.map((name) => fetchCommanderImage(name, 'large')))
      .then((urls) => {
        if (!cancelled) setSrcs(urls)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [names])

  return srcs
}

function CardFloat({ names, origin, onClose }) {
  const srcs = useFloatImages(names)
  const [grown, setGrown] = useState(false)

  useEffect(() => {
    setGrown(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setGrown(true))
    })
    return () => cancelAnimationFrame(id)
  }, [names, origin])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!origin || !names?.length) return null

  const partner = names.length > 1
  const finalW = partner
    ? Math.min(Math.max(origin.width * 3.2, 340), 640)
    : Math.min(Math.max(origin.width * 3.8, 260), 360)
  const finalH = (partner ? finalW / 2 - 4 : finalW) * (7 / 5)
  const scaleFrom = Math.max(origin.width / finalW, 0.12)

  // Exact card center — no reposition jump
  const cx = origin.left + origin.width / 2
  const cy = origin.top + origin.height / 2

  return (
    <>
      <div
        className={`card-float-backdrop ${grown ? 'shown' : ''}`}
        onClick={onClose}
      />
      <div
        className={`card-float ${grown ? 'grown' : ''} ${partner ? 'partner' : ''}`}
        style={{
          '--ox': `${cx}px`,
          '--oy': `${cy}px`,
          '--fw': `${finalW}px`,
          '--fh': `${finalH}px`,
          '--scale-from': scaleFrom,
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <div className="card-float-art">
          {names.map((name, i) =>
            srcs[i] ? (
              <img key={name} src={srcs[i]} alt={name} draggable={false} />
            ) : (
              <div key={name} className="commander-art loading" />
            ),
          )}
        </div>
      </div>
    </>
  )
}

function CommanderImage({ name, size = 'normal', className = '', onZoom }) {
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSrc(null)
    setFailed(false)

    fetchCommanderImage(name, size)
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [name, size])

  function handleClick(e) {
    if (!onZoom) return
    e.stopPropagation()
    onZoom([name], e.currentTarget.getBoundingClientRect())
  }

  if (failed) {
    return (
      <div className={`commander-art missing ${className}`} title={name}>
        <span>?</span>
      </div>
    )
  }

  if (!src) {
    return <div className={`commander-art loading ${className}`} title={name} />
  }

  return (
    <img
      className={`commander-art ${onZoom ? 'zoomable' : ''} ${className}`}
      src={src}
      alt={name}
      title={onZoom ? `Voir ${name}` : name}
      onClick={handleClick}
    />
  )
}

function DeckCard({ deck, onZoom }) {
  const winrate = Math.round((deck.wins / deck.games) * 100)
  const isPartner = deck.commanders.length > 1

  return (
    <article className={`deck-card ${isPartner ? 'partner' : ''}`}>
      <div
        className="deck-card-art zoomable"
        title="Agrandir"
        onClick={(e) =>
          onZoom?.(deck.commanders, e.currentTarget.getBoundingClientRect())
        }
      >
        {deck.commanders.map((name) => (
          <CommanderImage key={name} name={name} onZoom={onZoom} />
        ))}
      </div>

      <div className="deck-card-body">
        <h3 className="deck-card-title">{deckLabel(deck)}</h3>
        <div className="deck-card-meta stats">
          <div className="stat-line">
            <strong>{winrate}%</strong>
            <span>winrate</span>
          </div>
          <div className="stat-line">
            <strong>
              {deck.wins}/{deck.games}
            </strong>
            <span>victoires</span>
          </div>
          <a
            className="deck-link"
            href={deck.deckUrl}
            target="_blank"
            rel="noreferrer"
          >
            Voir le deck
          </a>
        </div>
      </div>
    </article>
  )
}

function GameRow({ game, onZoom }) {
  const decks = [...game.decks].sort((a, b) => a.seatOrder - b.seatOrder)

  return (
    <article className="game game-compact">
      <div className="game-stats-row">
        <span className="game-date">{game.date}</span>
        <span className="bracket-chip">{formatBracket(game)}</span>
        <span className="stat-pill">{game.turns} tours</span>
        {game.hadWipe && <span className="stat-pill flag-on">wipe</span>}
        {game.winnerProtectedVictory && (
          <span className="stat-pill flag-on">protégée</span>
        )}
      </div>

      {game.notes ? (
        <p className="game-notes-row">{game.notes}</p>
      ) : null}

      <div className="game-coms-row">
        {decks.map((deck) => (
          <button
            type="button"
            key={`${game.id}-${deck.seatOrder}`}
            className={`game-com-thumb ${deck.result}`}
            title={`${deckLabel(deck)} · ${deck.result}`}
            onClick={(e) =>
              onZoom?.(deck.commanders, e.currentTarget.getBoundingClientRect())
            }
          >
            <div className="game-com-art">
              {deck.commanders.map((name) => (
                <CommanderImage key={name} name={name} size="small" />
              ))}
            </div>
            {deck.result === 'win' && <span className="game-win-dot" />}
          </button>
        ))}
      </div>
    </article>
  )
}

function deckMatchesFilters(rawDeck, winsByDeck, { nameQuery, minWinrate }, players) {
  const deck = resolveDeck(rawDeck, players)
  const label = deckLabel(deck)
  const data = winsByDeck[label]
  if (!data) return false

  const winrate = Math.round((data.wins / data.games) * 100)
  const q = nameQuery.trim().toLowerCase()
  const haystack = `${label} ${data.player ?? ''}`.toLowerCase()

  if (q && !haystack.includes(q)) return false
  if (winrate < minWinrate) return false
  return true
}

function filterGames(games, winsByDeck, filters, players) {
  const hasFilters =
    filters.nameQuery.trim() !== '' || filters.minWinrate > 0
  if (!hasFilters) return games

  return games.filter((game) =>
    game.decks.some((raw) => deckMatchesFilters(raw, winsByDeck, filters, players)),
  )
}

function winnerWinrate(game, winsByDeck) {
  const winner = game.decks.find((d) => d.result === 'win')
  if (!winner) return 0
  const label = deckLabel(winner)
  const data = winsByDeck[label]
  if (!data) return 0
  return Math.round((data.wins / data.games) * 100)
}

function filterAndSortGames(games, winsByDeck, filters, players) {
  const comQ = filters.comQuery.trim().toLowerCase()
  const playerQ = filters.playerQuery.trim().toLowerCase()

  let list = games.filter((game) => {
    const resolved = game.decks.map((d) => resolveDeck(d, players))

    if (comQ) {
      const matchCom = resolved.some((d) =>
        deckLabel(d).toLowerCase().includes(comQ),
      )
      if (!matchCom) return false
    }

    if (playerQ) {
      const matchPlayer = resolved.some((d) =>
        (d.player ?? '').toLowerCase().includes(playerQ),
      )
      if (!matchPlayer) return false
    }

    if (filters.bracket !== '' && Number(filters.bracket) !== game.bracket) {
      return false
    }

    if (filters.wipe === 'yes' && !game.hadWipe) return false
    if (filters.wipe === 'no' && game.hadWipe) return false

    if (filters.protected === 'yes' && !game.winnerProtectedVictory) {
      return false
    }
    if (filters.protected === 'no' && game.winnerProtectedVictory) {
      return false
    }

    return true
  })

  const sorted = [...list].sort((a, b) => {
    switch (filters.sort) {
      case 'date-asc':
        return a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
      case 'date-desc':
        return b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
      case 'turns-asc':
        return a.turns - b.turns
      case 'turns-desc':
        return b.turns - a.turns
      case 'bracket-asc':
        return a.bracket - b.bracket
      case 'bracket-desc':
        return b.bracket - a.bracket
      case 'wipe-first':
        return Number(b.hadWipe) - Number(a.hadWipe)
      case 'wipe-last':
        return Number(a.hadWipe) - Number(b.hadWipe)
      case 'prot-first':
        return (
          Number(b.winnerProtectedVictory) - Number(a.winnerProtectedVictory)
        )
      case 'winrate-desc':
        return winnerWinrate(b, winsByDeck) - winnerWinrate(a, winsByDeck)
      case 'winrate-asc':
        return winnerWinrate(a, winsByDeck) - winnerWinrate(b, winsByDeck)
      default:
        return b.date.localeCompare(a.date)
    }
  })

  return sorted
}

function filterDecks(winsByDeck, { nameQuery, minWinrate, sortWinrate }) {
  const q = nameQuery.trim().toLowerCase()

  return Object.entries(winsByDeck)
    .map(([label, data]) => ({
      label,
      data,
      winrate: Math.round((data.wins / data.games) * 100),
    }))
    .filter(({ label, data, winrate }) => {
      const haystack = `${label} ${data.player ?? ''}`.toLowerCase()
      if (q && !haystack.includes(q)) return false
      if (winrate < minWinrate) return false
      return true
    })
    .sort((a, b) => {
      if (sortWinrate === 'asc') return a.winrate - b.winrate
      if (sortWinrate === 'desc') return b.winrate - a.winrate
      return a.label.localeCompare(b.label)
    })
}

function FiltersBar({
  nameQuery,
  onNameQuery,
  minWinrate,
  onMinWinrate,
  sortWinrate,
  onSortWinrate,
  showSort = false,
}) {
  return (
    <div className={`filters ${showSort ? 'filters-3' : 'filters-2'}`}>
      <label className="filter">
        <span>Nom</span>
        <input
          type="search"
          placeholder="Commandant ou joueur…"
          value={nameQuery}
          onChange={(e) => onNameQuery(e.target.value)}
        />
      </label>

      <label className="filter">
        <span>Winrate min</span>
        <div className="filter-control range">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={minWinrate}
            onChange={(e) => onMinWinrate(Number(e.target.value))}
          />
          <span className="range-value">{minWinrate}%</span>
        </div>
      </label>

      {showSort && (
        <label className="filter">
          <span>Tri winrate</span>
          <select
            value={sortWinrate}
            onChange={(e) => onSortWinrate(e.target.value)}
          >
            <option value="desc">Du plus haut</option>
            <option value="asc">Du plus bas</option>
            <option value="name">Par nom</option>
          </select>
        </label>
      )}
    </div>
  )
}

function GamesFiltersBar({
  comQuery,
  onComQuery,
  playerQuery,
  onPlayerQuery,
  bracket,
  onBracket,
  wipe,
  onWipe,
  protectedFilter,
  onProtected,
  sort,
  onSort,
}) {
  return (
    <div className="filters filters-games">
      <label className="filter">
        <span>Commandant</span>
        <input
          type="search"
          placeholder="Nom du com…"
          value={comQuery}
          onChange={(e) => onComQuery(e.target.value)}
        />
      </label>

      <label className="filter">
        <span>Joueur</span>
        <input
          type="search"
          placeholder="Nom…"
          value={playerQuery}
          onChange={(e) => onPlayerQuery(e.target.value)}
        />
      </label>

      <label className="filter">
        <span>Bracket</span>
        <select value={bracket} onChange={(e) => onBracket(e.target.value)}>
          <option value="">Tous</option>
          <option value="1">B1</option>
          <option value="2">B2</option>
          <option value="3">B3</option>
          <option value="4">B4</option>
        </select>
      </label>

      <label className="filter">
        <span>Wipe</span>
        <select value={wipe} onChange={(e) => onWipe(e.target.value)}>
          <option value="">Tous</option>
          <option value="yes">Oui</option>
          <option value="no">Non</option>
        </select>
      </label>

      <label className="filter">
        <span>Protégée</span>
        <select
          value={protectedFilter}
          onChange={(e) => onProtected(e.target.value)}
        >
          <option value="">Tous</option>
          <option value="yes">Oui</option>
          <option value="no">Non</option>
        </select>
      </label>

      <label className="filter">
        <span>Tri</span>
        <select value={sort} onChange={(e) => onSort(e.target.value)}>
          <option value="date-desc">Date ↓</option>
          <option value="date-asc">Date ↑</option>
          <option value="turns-desc">Tours ↓</option>
          <option value="turns-asc">Tours ↑</option>
          <option value="bracket-desc">Bracket ↓</option>
          <option value="bracket-asc">Bracket ↑</option>
          <option value="wipe-first">Wipe d’abord</option>
          <option value="prot-first">Protégée d’abord</option>
          <option value="winrate-desc">WR gagnant ↓</option>
          <option value="winrate-asc">WR gagnant ↑</option>
        </select>
      </label>
    </div>
  )
}

function App() {
  const [games, setGames] = useState(initialGames)
  const [players, setPlayers] = useState(initialPlayers)
  const [showAddForm, setShowAddForm] = useState(false)
  const [cardFloat, setCardFloat] = useState(null)

  useEffect(() => {
    loadGames(initialGames).then(setGames)
    loadPlayers(initialPlayers).then(setPlayers)
  }, [])

  const allStats = computeStats(games, players)

  const [statsNameQuery, setStatsNameQuery] = useState('')
  const [statsMinWinrate, setStatsMinWinrate] = useState(0)

  const [comNameQuery, setComNameQuery] = useState('')
  const [comMinWinrate, setComMinWinrate] = useState(0)
  const [comSortWinrate, setComSortWinrate] = useState('desc')

  const [gameComQuery, setGameComQuery] = useState('')
  const [gamePlayerQuery, setGamePlayerQuery] = useState('')
  const [gameBracket, setGameBracket] = useState('')
  const [gameWipe, setGameWipe] = useState('')
  const [gameProtected, setGameProtected] = useState('')
  const [gameSort, setGameSort] = useState('date-desc')

  const statsFilters = { nameQuery: statsNameQuery, minWinrate: statsMinWinrate }
  const isStatsFiltered =
    statsNameQuery.trim() !== '' || statsMinWinrate > 0

  const statsFilteredGames = filterGames(games, allStats.winsByDeck, statsFilters, players)
  const stats = computeStats(statsFilteredGames, players)

  const filteredDecks = filterDecks(allStats.winsByDeck, {
    nameQuery: comNameQuery,
    minWinrate: comMinWinrate,
    sortWinrate: comSortWinrate,
  })

  const displayGames = filterAndSortGames(games, allStats.winsByDeck, {
    comQuery: gameComQuery,
    playerQuery: gamePlayerQuery,
    bracket: gameBracket,
    wipe: gameWipe,
    protected: gameProtected,
    sort: gameSort,
  }, players)

  const isGamesFiltered =
    gameComQuery.trim() !== '' ||
    gamePlayerQuery.trim() !== '' ||
    gameBracket !== '' ||
    gameWipe !== '' ||
    gameProtected !== ''

  async function handleAddGame({ game, players: updatedPlayers }) {
    const updatedGames = [...games, game]
    await saveGames(updatedGames)
    await savePlayers(updatedPlayers)
    setGames(updatedGames)
    setPlayers(updatedPlayers)
    setShowAddForm(false)
  }

  function handleZoom(names, origin) {
    setCardFloat({
      names,
      origin: {
        left: origin.left,
        top: origin.top,
        width: origin.width,
        height: origin.height,
      },
    })
  }

  return (
    <div className="page">
      {showAddForm && (
        <AddGameForm
          players={players}
          onSave={handleAddGame}
          onClose={() => setShowAddForm(false)}
        />
      )}
      {cardFloat && (
        <CardFloat
          key={cardFloat.names.join('|')}
          names={cardFloat.names}
          origin={cardFloat.origin}
          onClose={() => setCardFloat(null)}
        />
      )}
      <header className="page-header top-bar">
        <div className="top-bar-brand">
          <h1>MagicAddicts Stats</h1>
          <p className="eyebrow">Commander</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-add"
          onClick={() => setShowAddForm(true)}
        >
          + Partie
        </button>
      </header>

      <div className="dashboard">
        <section className="panel panel-stats">
          <div className="panel-header">
            <div className="section-heading">
              <h2>Stats</h2>
              {isStatsFiltered && (
                <p className="filter-count">
                  {statsFilteredGames.length}/{games.length}
                </p>
              )}
            </div>

            <FiltersBar
              nameQuery={statsNameQuery}
              onNameQuery={setStatsNameQuery}
              minWinrate={statsMinWinrate}
              onMinWinrate={setStatsMinWinrate}
            />
            <p className="results-count">
              résultats : {Object.keys(stats.winsByPlayer).length}
            </p>
          </div>

          <div className="panel-scroll">
            <div className="stats-grid">
              <div className="stat-box">
                <div className="label">Parties</div>
                <div className="value">{stats.totalGames}</div>
              </div>
              <div className="stat-box">
                <div className="label">Tours (moy.)</div>
                <div className="value">{stats.avgTurns}</div>
              </div>
              <div className="stat-box">
                <div className="label">Avec wipe</div>
                <div className="value">{stats.wipeRate}%</div>
              </div>
              <div className="stat-box">
                <div className="label">Victoire protégée</div>
                <div className="value">{stats.protectedRate}%</div>
              </div>
            </div>

            <h3 className="subsection-title">Winrate joueurs</h3>
            {Object.keys(stats.winsByPlayer).length === 0 ? (
              <p className="empty-filter">Aucun joueur ne correspond aux filtres.</p>
            ) : (
              <div className="player-stats">
                {Object.entries(stats.winsByPlayer).map(([name, data]) => (
                  <div key={name} className="stat-box">
                    <div className="label">{name}</div>
                    <div className="value">
                      {Math.round((data.wins / data.games) * 100)}%
                    </div>
                    <div className="sub">
                      {data.wins}/{data.games} victoires
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel panel-coms">
          <div className="panel-header">
            <div className="section-heading">
              <h2>Commandants</h2>
              <p className="filter-count">
                {filteredDecks.length}/{Object.keys(allStats.winsByDeck).length}
              </p>
            </div>

            <FiltersBar
              nameQuery={comNameQuery}
              onNameQuery={setComNameQuery}
              minWinrate={comMinWinrate}
              onMinWinrate={setComMinWinrate}
              sortWinrate={comSortWinrate}
              onSortWinrate={setComSortWinrate}
              showSort
            />
            <p className="results-count">résultats : {filteredDecks.length}</p>
          </div>

          <div className="panel-scroll">
            {filteredDecks.length === 0 ? (
              <p className="empty-filter">Aucun deck ne correspond aux filtres.</p>
            ) : (
              <div className="deck-grid deck-grid-col">
                {filteredDecks.map(({ label, data }) => (
                  <DeckCard
                    key={label}
                    deck={data}
                    onZoom={handleZoom}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel panel-games">
          <div className="panel-header">
            <div className="section-heading">
              <h2>Parties</h2>
              <p className="filter-count">
                {displayGames.length}
                {isGamesFiltered ? `/${games.length}` : ''}
              </p>
            </div>

            <GamesFiltersBar
              comQuery={gameComQuery}
              onComQuery={setGameComQuery}
              playerQuery={gamePlayerQuery}
              onPlayerQuery={setGamePlayerQuery}
              bracket={gameBracket}
              onBracket={setGameBracket}
              wipe={gameWipe}
              onWipe={setGameWipe}
              protectedFilter={gameProtected}
              onProtected={setGameProtected}
              sort={gameSort}
              onSort={setGameSort}
            />
            <p className="results-count">résultats : {displayGames.length}</p>
          </div>

          <div className="panel-scroll">
            {displayGames.length === 0 ? (
              <p className="empty-filter">
                Aucune partie ne correspond aux filtres.
              </p>
            ) : (
              displayGames.map((game) => (
                <GameRow
                  key={game.id}
                  game={game}
                  onZoom={handleZoom}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
