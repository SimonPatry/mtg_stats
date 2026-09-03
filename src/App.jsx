import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import initialGames from './data/games.json'
import initialUsers from './data/users.json'
import initialDecks from './data/decks.json'
import fakeGames from './data/games_test.json'
import fakeUsers from './data/users_test.json'
import fakeDecks from './data/decks_test.json'
import { fetchCommanderImage } from './scryfall'
import { BACKUP_REASON, getBoardWipes, getLastPlayer, getLastPlayerLabel, isLastDeck, loadGames, saveGames } from './gamesApi'
import Select from './Select'
import { loadUsers, saveUsers } from './usersApi'
import { loadDecks, saveDecks } from './decksApi'
import {
  DATA_SOURCE,
  loadDataSource,
  saveDataSource,
} from './dataSource'
import {
  resolveDeckFromCatalog,
  getDeckById,
  getDeckFilterOptions,
  getUserName,
  commandersKey,
  getCurrentDeckForCommanders,
  computeStatsByDeckId,
} from './playersMapping'
import AddGameForm from './AddGameForm'
import JsonEditor from './JsonEditor'
import PlayersManager from './PlayersManager'
import DeckStatsModal from './DeckStatsModal'
import GameDetailsModal from './GameDetailsModal'
import TempGameView from './TempGameView'
import TempGamePickerModal from './TempGamePickerModal'
import TempGameStartModal from './TempGameStartModal'
import {
  loadLiveGamesStore,
  removeTempGameFromStore,
  saveLiveGamesStore,
  tempGameToAddGameInitial,
} from './tempGame'
import { downloadGamesExcel, downloadGamesJson } from './exportGames'

function resolveDeck(deck, users, decks) {
  return resolveDeckFromCatalog(decks, users, deck)
}

function deckLabel(deck) {
  return deck.commanders.join(' / ')
}

function computeStats(games, users, decks) {
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

  for (const game of games) {
    for (const raw of game.decks) {
      const deck = resolveDeck(raw, users, decks)
      const key = deckLabel(deck)

      if (!winsByDeck[key]) {
        const current = getCurrentDeckForCommanders(decks, deck.commanders)
        winsByDeck[key] = {
          wins: 0,
          games: 0,
          deckId: current?.id ?? deck.deckId,
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
    avgBoardWipes,
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

  const mobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 768px)').matches

  const partner = names.length > 1
  const finalW = partner
    ? mobile
      ? Math.min(window.innerWidth * 0.92, 640)
      : Math.min(Math.max(origin.width * 3.2, 340), 640)
    : mobile
      ? Math.min(window.innerWidth * 0.82, 360)
      : Math.min(Math.max(origin.width * 3.8, 260), 360)
  const finalH = (partner ? finalW / 2 - 4 : finalW) * (7 / 5)
  const scaleFrom = Math.max(origin.width / finalW, 0.12)

  const cx = mobile
    ? window.innerWidth / 2
    : origin.left + origin.width / 2
  const cy = mobile
    ? window.innerHeight / 2
    : origin.top + origin.height / 2

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

function DeckCard({ deck, onZoom, onDetail }) {
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
        <h3 className="deck-card-title">
          {deckLabel(deck)}
          {deck.player ? (
            <span className="deck-card-player"> ({deck.player})</span>
          ) : null}
        </h3>
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
        </div>
        <div className="deck-card-actions">
          <a
            className="deck-link"
            href={deck.deckUrl}
            target="_blank"
            rel="noreferrer"
          >
            Voir le deck
          </a>
          <button
            type="button"
            className="deck-link deck-link-btn"
            onClick={() => onDetail?.(deck)}
          >
            Détail
          </button>
        </div>
      </div>
    </article>
  )
}

function GameRow({ game, users, decks, onZoom, onDetails }) {
  const resolvedDecks = [...game.decks]
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((deck) => resolveDeck(deck, users, decks))
  const boardWipes = getBoardWipes(game)

  return (
    <article className="game game-compact">
      <div className="game-row-top">
        <div className="game-stats-row">
          <span className="game-date">{game.date}</span>
          <span className="bracket-chip">{formatBracket(game)}</span>
          <span className="stat-pill">{game.turns} tours</span>
          {boardWipes > 0 && (
            <span className="stat-pill flag-on">
              {boardWipes} wipe{boardWipes > 1 ? 's' : ''}
            </span>
          )}
          {game.winnerProtectedVictory && (
            <span className="stat-pill flag-on">protégée</span>
          )}
          {getLastPlayer(game) && (
            <span className="stat-pill">last: {getLastPlayerLabel(game)}</span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-game-details"
          onClick={() => onDetails?.(game)}
        >
          Détails
        </button>
      </div>

      <div className="game-coms-row">
        {resolvedDecks.map((deck) => (
          <button
            type="button"
            key={`${game.id}-${deck.seatOrder}`}
            className={`game-com-thumb ${deck.result}`}
            title={`${deckLabel(deck)} · ${deck.player} · ${deck.result}${isLastDeck(game, deck) ? ' · last' : ''}`}
            onClick={(e) =>
              onZoom?.(deck.commanders, e.currentTarget.getBoundingClientRect())
            }
          >
            <div className="game-com-art">
              {deck.commanders.map((name) => (
                <CommanderImage key={name} name={name} size="small" />
              ))}
            </div>
            <div className="game-com-caption">
              <span className="game-com-player">{deck.player || '—'}</span>
            </div>
            {deck.result === 'win' && <span className="game-win-dot" />}
            {isLastDeck(game, deck) && (
              <span className="game-last-dot" />
            )}
          </button>
        ))}
      </div>
    </article>
  )
}

function playerMatchesStatsFilters(rawDeck, winsByPlayer, { nameQuery, minWinrate }, users, decks) {
  const deck = resolveDeck(rawDeck, users, decks)
  const player = deck.player?.trim()
  if (!player) return false

  const data = winsByPlayer[player]
  if (!data) return false

  const winrate = Math.round((data.wins / data.games) * 100)
  const q = nameQuery.trim().toLowerCase()

  if (q && !player.toLowerCase().includes(q)) return false
  if (winrate < minWinrate) return false
  return true
}

function filterGamesByPlayerStats(games, winsByPlayer, filters, users, decks) {
  const hasFilters =
    filters.nameQuery.trim() !== '' || filters.minWinrate > 0
  if (!hasFilters) return games

  return games.filter((game) =>
    game.decks.some((raw) =>
      playerMatchesStatsFilters(raw, winsByPlayer, filters, users, decks),
    ),
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

function filterAndSortGames(games, winsByDeck, filters, users, decks) {
  const playerQ = filters.playerQuery.trim().toLowerCase()
  const comDeck = filters.comDeckId ? getDeckById(decks, filters.comDeckId) : null

  let list = games.filter((game) => {
    const resolved = game.decks.map((d) => resolveDeck(d, users, decks))

    if (comDeck) {
      const comKey = commandersKey(comDeck.com)
      const playerName = getUserName(users, comDeck.userId)
      const matchCom = resolved.some((d) => {
        if (d.deckId === comDeck.id) return true
        return (
          commandersKey(d.commanders) === comKey &&
          (d.player ?? '').trim().toLowerCase() === playerName.trim().toLowerCase()
        )
      })
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

    const wipes = getBoardWipes(game)
    if (filters.wipe === 'yes' && wipes === 0) return false
    if (filters.wipe === 'no' && wipes > 0) return false

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
        return getBoardWipes(b) - getBoardWipes(a)
      case 'wipe-last':
        return getBoardWipes(a) - getBoardWipes(b)
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

function formatWinrateValue(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function WinrateMinFilter({ value, onChange, label = 'Winrate min' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function commit(raw) {
    const parsed = Number(String(raw).replace(',', '.').trim())
    if (Number.isNaN(parsed)) {
      setEditing(false)
      return
    }
    onChange(Math.min(100, Math.max(0, parsed)))
    setEditing(false)
  }

  function startEdit() {
    setDraft(formatWinrateValue(value))
    setEditing(true)
  }

  return (
    <label className="filter">
      <span>{label}</span>
      <div className="filter-control range">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.min(100, Math.max(0, Math.round(value)))}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {editing ? (
          <input
            type="text"
            inputMode="decimal"
            className="range-value-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit(draft)
              }
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <span
            className="range-value range-value-editable"
            onDoubleClick={startEdit}
            title="Double-clic pour éditer"
          >
            {formatWinrateValue(value)}%
          </span>
        )}
      </div>
    </label>
  )
}

function FiltersBar({
  nameQuery,
  onNameQuery,
  minWinrate,
  onMinWinrate,
  sortWinrate,
  onSortWinrate,
  showSort = false,
  namePlaceholder = 'Commandant ou joueur…',
  minWinrateLabel = 'Winrate min',
}) {
  return (
    <div className={`filters ${showSort ? 'filters-3' : 'filters-2'}`}>
      <label className="filter">
        <span>Nom</span>
        <input
          type="search"
          placeholder={namePlaceholder}
          value={nameQuery}
          onChange={(e) => onNameQuery(e.target.value)}
        />
      </label>

      <WinrateMinFilter value={minWinrate} onChange={onMinWinrate} label={minWinrateLabel} />

      {showSort && (
        <label className="filter">
          <span>Tri winrate</span>
          <Select
            value={sortWinrate}
            onChange={(e) => onSortWinrate(e.target.value)}
          >
            <option value="desc">Du plus haut</option>
            <option value="asc">Du plus bas</option>
            <option value="name">Par nom</option>
          </Select>
        </label>
      )}
    </div>
  )
}

function GamesFiltersBar({
  commanderOptions,
  comDeckId,
  onComDeckId,
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
        <Select value={comDeckId} onChange={(e) => onComDeckId(e.target.value)}>
          <option value="">Tous</option>
          {commanderOptions.map((opt) => (
            <option key={opt.deckId} value={opt.deckId}>
              {opt.label} ({opt.player})
            </option>
          ))}
        </Select>
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

      <label className="filter filter-sort-inline">
        <span>Tri</span>
        <Select value={sort} onChange={(e) => onSort(e.target.value)}>
          <option value="date-desc">Date ↓</option>
          <option value="date-asc">Date ↑</option>
          <option value="turns-desc">Tours ↓</option>
          <option value="turns-asc">Tours ↑</option>
          <option value="bracket-desc">B ↓</option>
          <option value="bracket-asc">B ↑</option>
          <option value="wipe-first">Wipe</option>
          <option value="prot-first">Prot.</option>
          <option value="winrate-desc">WR ↓</option>
          <option value="winrate-asc">WR ↑</option>
        </Select>
      </label>

      <div className="filters-games-flags">
        <label className="filter filter-compact">
          <span>Bracket</span>
          <Select value={bracket} onChange={(e) => onBracket(e.target.value)}>
            <option value="">Tous</option>
            <option value="1">B1</option>
            <option value="2">B2</option>
            <option value="3">B3</option>
            <option value="4">B4</option>
          </Select>
        </label>

        <label className="filter filter-compact">
          <span>Wipe</span>
          <Select value={wipe} onChange={(e) => onWipe(e.target.value)}>
            <option value="">Tous</option>
            <option value="yes">Oui</option>
            <option value="no">Non</option>
          </Select>
        </label>

        <label className="filter filter-compact">
          <span>Protégée</span>
          <Select
            value={protectedFilter}
            onChange={(e) => onProtected(e.target.value)}
          >
            <option value="">Tous</option>
            <option value="yes">Oui</option>
            <option value="no">Non</option>
          </Select>
        </label>
      </div>
    </div>
  )
}

function FiltersModal({ title, onClose, children }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop panel-filters-modal-backdrop" onClick={onClose}>
      <div
        className="modal panel-filters-modal"
        role="dialog"
        aria-labelledby="panel-filters-modal-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="panel-filters-modal-title">{title}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="panel-filters-modal-body">{children}</div>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Appliquer
          </button>
        </div>
      </div>
    </div>
  )
}

function FilterFabIcon() {
  return (
    <svg
      className="panel-filters-fab-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M4 5.5a1 1 0 0 1 1-1h14a1 1 0 0 1 .832 1.555l-5.246 7.868V18a1 1 0 0 1-.553.894l-4 2A1 1 0 0 1 9 20v-5.677L3.168 6.055A1 1 0 0 1 4 5.5Z"
      />
    </svg>
  )
}

const DASHBOARD_PANELS = [
  { id: 'stats', label: 'Stats' },
  { id: 'coms', label: 'Commandants' },
  { id: 'games', label: 'Parties' },
]

function MobileDashboardFilters({ activePanel, filterPanels }) {
  const [open, setOpen] = useState(false)
  const current = filterPanels[activePanel]

  if (!current) return null

  return createPortal(
    <>
      <button
        type="button"
        className="panel-filters-fab"
        aria-label={`Filtres — ${current.title}`}
        onClick={() => setOpen(true)}
      >
        <FilterFabIcon />
        {current.hasActive ? <span className="panel-filters-fab-dot" aria-hidden /> : null}
      </button>
      {open ? (
        <FiltersModal
          key={activePanel}
          title={`Filtres — ${current.title}`}
          onClose={() => setOpen(false)}
        >
          {current.content}
        </FiltersModal>
      ) : null}
    </>,
    document.body,
  )
}

function SideNav({ open, onClose, activeView, onNavigate, onExportJson, onExportExcel }) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function go(view) {
    onNavigate(view)
    onClose()
  }

  return createPortal(
    <>
      <button
        type="button"
        className="side-nav-backdrop"
        aria-label="Fermer le menu"
        onClick={onClose}
      />
      <aside className="side-nav" aria-label="Menu">
        <div className="side-nav-header">
          <p className="side-nav-title">Menu</p>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <nav className="side-nav-links" aria-label="Navigation">
          <button
            type="button"
            className={`side-nav-link${activeView === 'dashboard' ? ' is-active' : ''}`}
            onClick={() => go('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`side-nav-link${activeView === 'players' ? ' is-active' : ''}`}
            onClick={() => go('players')}
          >
            Joueurs & decks
          </button>
          <button
            type="button"
            className={`side-nav-link${activeView === 'json' ? ' is-active' : ''}`}
            onClick={() => go('json')}
          >
            Édition JSON
          </button>
        </nav>

        <div className="side-nav-section">
          <p className="side-nav-section-label">Exports</p>
          <button type="button" className="side-nav-link" onClick={() => { onExportJson(); onClose() }}>
            ↓ Télécharger JSON
          </button>
          <button type="button" className="side-nav-link" onClick={() => { onExportExcel(); onClose() }}>
            ↓ Télécharger Excel
          </button>
        </div>
      </aside>
    </>,
    document.body,
  )
}

function DashboardShell({ children, filterPanels }) {
  const scrollRef = useRef(null)
  const [activePanel, setActivePanel] = useState(0)
  const activePanelRef = useRef(0)
  const touchStartRef = useRef(null)
  const panelCount = DASHBOARD_PANELS.length

  activePanelRef.current = activePanel

  const scrollToPanel = (index, smooth = true) => {
    const el = scrollRef.current
    if (!el) return
    const next = Math.max(0, Math.min(index, panelCount - 1))
    setActivePanel(next)
    el.scrollTo({
      left: next * el.clientWidth,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined

    function onResize() {
      const w = el.clientWidth
      if (w <= 0) return
      el.scrollLeft = activePanelRef.current * w
    }

    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function onTouchStart(e) {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    touchStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      panel: activePanel,
    }
  }

  function onTouchEnd(e) {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start || e.changedTouches.length !== 1) return

    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    // Horizontal swipe only — ignore vertical scroll inside panels
    if (absDx < 48 || absDx < absDy * 1.25) return

    const direction = dx < 0 ? 1 : -1
    scrollToPanel(start.panel + direction)
  }

  return (
    <>
      <div className="dashboard-wrap">
        <nav
          className="dashboard-mobile-nav"
          aria-label="Sections du dashboard"
        >
          {DASHBOARD_PANELS.map((panel, index) => (
            <button
              key={panel.id}
              type="button"
              className={`dashboard-mobile-nav-btn${activePanel === index ? ' is-active' : ''}`}
              aria-current={activePanel === index ? 'true' : undefined}
              onClick={() => scrollToPanel(index)}
            >
              {panel.label}
            </button>
          ))}
        </nav>
        <div
          className="dashboard dashboard-carousel"
          ref={scrollRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {children}
        </div>
      </div>
      <MobileDashboardFilters activePanel={activePanel} filterPanels={filterPanels} />
    </>
  )
}

function App() {
  const [dataSource, setDataSource] = useState(() => loadDataSource())
  const [games, setGames] = useState(
    () => (loadDataSource() === DATA_SOURCE.FAKE ? fakeGames : initialGames),
  )
  const [users, setUsers] = useState(
    () => (loadDataSource() === DATA_SOURCE.FAKE ? fakeUsers : initialUsers),
  )
  const [decks, setDecks] = useState(
    () => (loadDataSource() === DATA_SOURCE.FAKE ? fakeDecks : initialDecks),
  )
  const [showAddForm, setShowAddForm] = useState(false)
  const [addFormFromTemp, setAddFormFromTemp] = useState(null)
  const [liveStore, setLiveStore] = useState(() => loadLiveGamesStore())
  const [showLivePicker, setShowLivePicker] = useState(false)
  const [showTempStart, setShowTempStart] = useState(false)
  const [cardFloat, setCardFloat] = useState(null)
  const [deckDetail, setDeckDetail] = useState(null)
  const [gameDetail, setGameDetail] = useState(null)
  const [activeView, setActiveView] = useState('dashboard')
  const [sideNavOpen, setSideNavOpen] = useState(false)

  const isFakeData = dataSource === DATA_SOURCE.FAKE

  useEffect(() => {
    let cancelled = false
    const fallback =
      dataSource === DATA_SOURCE.FAKE
        ? { games: fakeGames, users: fakeUsers, decks: fakeDecks }
        : { games: initialGames, users: initialUsers, decks: initialDecks }

    Promise.all([
      loadGames(fallback.games, dataSource),
      loadUsers(fallback.users, dataSource),
      loadDecks(fallback.decks, dataSource),
    ]).then(([nextGames, nextUsers, nextDecks]) => {
      if (cancelled) return
      setGames(nextGames)
      setUsers(nextUsers)
      setDecks(nextDecks)
    })
    return () => {
      cancelled = true
    }
  }, [dataSource])

  async function handleToggleDataSource() {
    const next =
      dataSource === DATA_SOURCE.FAKE ? DATA_SOURCE.REAL : DATA_SOURCE.FAKE
    saveDataSource(next)
    setDataSource(next)
    setShowAddForm(false)
    setAddFormFromTemp(null)
    setGameDetail(null)
    setDeckDetail(null)
    setActiveView('dashboard')
  }

  const tempGame = liveStore.activeId ? liveStore.games[liveStore.activeId] ?? null : null
  const liveGameCount = Object.keys(liveStore.games).length

  useEffect(() => {
    saveLiveGamesStore(liveStore)
  }, [liveStore])

  useEffect(() => {
    if (activeView === 'tempGame' && !tempGame) {
      setActiveView('dashboard')
    }
  }, [activeView, tempGame])

  function openAddForm() {
    setAddFormFromTemp(null)
    setShowAddForm(true)
  }

  function openLiveGame() {
    setShowLivePicker(true)
  }

  function handleSelectLiveGame(id) {
    setLiveStore((prev) => ({ ...prev, activeId: id }))
    setShowLivePicker(false)
    setActiveView('tempGame')
  }

  function handleNewLiveGame() {
    setShowLivePicker(false)
    setShowTempStart(true)
  }

  function handleAbandonLiveGame(id) {
    if (!window.confirm('Abandonner cette partie live ?')) return
    setLiveStore((prev) => removeTempGameFromStore(prev, id))
  }

  function handleStartTempGame(game) {
    setLiveStore((prev) => ({
      activeId: game.id,
      games: { ...prev.games, [game.id]: game },
    }))
    setShowTempStart(false)
    setActiveView('tempGame')
  }

  function handleTempGameChange(game) {
    setLiveStore((prev) => ({
      ...prev,
      games: { ...prev.games, [game.id]: game },
    }))
  }

  function handleAbandonTempGame() {
    if (!tempGame) return
    handleAbandonLiveGame(tempGame.id)
    setActiveView('dashboard')
  }

  function handleFinalizeTempGame() {
    if (!tempGame) return
    setAddFormFromTemp(tempGameToAddGameInitial(tempGame))
    setShowAddForm(true)
  }

  const allStats = computeStats(games, users, decks)

  const statsByDeckId = useMemo(
    () => computeStatsByDeckId(games, users, decks),
    [games, users, decks],
  )

  const [statsNameQuery, setStatsNameQuery] = useState('')
  const [statsMinWinrate, setStatsMinWinrate] = useState(0)

  const [comNameQuery, setComNameQuery] = useState('')
  const [comMinWinrate, setComMinWinrate] = useState(0)
  const [comSortWinrate, setComSortWinrate] = useState('desc')

  const [gameComDeckId, setGameComDeckId] = useState('')
  const [gamePlayerQuery, setGamePlayerQuery] = useState('')
  const [gameBracket, setGameBracket] = useState('')
  const [gameWipe, setGameWipe] = useState('')
  const [gameProtected, setGameProtected] = useState('')
  const [gameSort, setGameSort] = useState('date-desc')

  const statsFilters = { nameQuery: statsNameQuery, minWinrate: statsMinWinrate }
  const isStatsFiltered =
    statsNameQuery.trim() !== '' || statsMinWinrate > 0

  const statsFilteredGames = filterGamesByPlayerStats(
    games,
    allStats.winsByPlayer,
    statsFilters,
    users,
    decks,
  )
  const stats = computeStats(statsFilteredGames, users, decks)

  const filteredDecks = filterDecks(allStats.winsByDeck, {
    nameQuery: comNameQuery,
    minWinrate: comMinWinrate,
    sortWinrate: comSortWinrate,
  })
  const isComsFiltered =
    comNameQuery.trim() !== '' || comMinWinrate > 0 || comSortWinrate !== 'desc'

  const gameCommanderOptions = useMemo(
    () => getDeckFilterOptions(users, decks),
    [users, decks],
  )

  const displayGames = filterAndSortGames(games, allStats.winsByDeck, {
    comDeckId: gameComDeckId,
    playerQuery: gamePlayerQuery,
    bracket: gameBracket,
    wipe: gameWipe,
    protected: gameProtected,
    sort: gameSort,
  }, users, decks)

  const isGamesFiltered =
    gameComDeckId !== '' ||
    gamePlayerQuery.trim() !== '' ||
    gameBracket !== '' ||
    gameWipe !== '' ||
    gameProtected !== ''

  const dashboardFilterPanels = useMemo(
    () => [
      {
        title: 'Stats',
        hasActive: isStatsFiltered,
        content: (
          <FiltersBar
            nameQuery={statsNameQuery}
            onNameQuery={setStatsNameQuery}
            minWinrate={statsMinWinrate}
            onMinWinrate={setStatsMinWinrate}
            namePlaceholder="Joueur…"
            minWinrateLabel="Winrate joueur min"
          />
        ),
      },
      {
        title: 'Commandants',
        hasActive: isComsFiltered,
        content: (
          <FiltersBar
            nameQuery={comNameQuery}
            onNameQuery={setComNameQuery}
            minWinrate={comMinWinrate}
            onMinWinrate={setComMinWinrate}
            sortWinrate={comSortWinrate}
            onSortWinrate={setComSortWinrate}
            showSort
          />
        ),
      },
      {
        title: 'Parties',
        hasActive: isGamesFiltered,
        content: (
          <GamesFiltersBar
            commanderOptions={gameCommanderOptions}
            comDeckId={gameComDeckId}
            onComDeckId={setGameComDeckId}
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
        ),
      },
    ],
    [
      isStatsFiltered,
      statsNameQuery,
      statsMinWinrate,
      isComsFiltered,
      comNameQuery,
      comMinWinrate,
      comSortWinrate,
      isGamesFiltered,
      gameCommanderOptions,
      gameComDeckId,
      gamePlayerQuery,
      gameBracket,
      gameWipe,
      gameProtected,
      gameSort,
    ],
  )

  async function handleAddGame({ game, users: updatedUsers, decks: updatedDecks }) {
    const updatedGames = [...games, game]
    await saveGames(updatedGames, games, { reason: BACKUP_REASON.ADD_GAME })
    await saveUsers(updatedUsers)
    await saveDecks(updatedDecks)
    setGames(updatedGames)
    setUsers(updatedUsers)
    setDecks(updatedDecks)
    setShowAddForm(false)
    const finalizedId = addFormFromTemp?.gameId
    if (finalizedId) {
      setLiveStore((prev) => removeTempGameFromStore(prev, finalizedId))
    }
    setAddFormFromTemp(null)
    setActiveView('dashboard')
  }

  function handleJsonSave(updatedGames) {
    setGames(updatedGames)
  }

  async function handleCatalogSave({ users: updatedUsers, decks: updatedDecks }) {
    await saveUsers(updatedUsers)
    await saveDecks(updatedDecks)
    setUsers(updatedUsers)
    setDecks(updatedDecks)
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
          users={users}
          decks={decks}
          fromTempGame={addFormFromTemp}
          onSave={handleAddGame}
          onClose={() => {
            setShowAddForm(false)
            setAddFormFromTemp(null)
          }}
        />
      )}
      {showLivePicker && (
        <TempGamePickerModal
          liveStore={liveStore}
          onSelect={handleSelectLiveGame}
          onNew={handleNewLiveGame}
          onAbandon={handleAbandonLiveGame}
          onClose={() => setShowLivePicker(false)}
        />
      )}
      {showTempStart && (
        <TempGameStartModal
          users={users}
          onStart={handleStartTempGame}
          onClose={() => setShowTempStart(false)}
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
      {deckDetail && (
        <DeckStatsModal
          deck={deckDetail}
          decks={decks}
          users={users}
          statsByDeckId={statsByDeckId}
          onClose={() => setDeckDetail(null)}
        />
      )}
      {gameDetail && (
        <GameDetailsModal
          game={gameDetail}
          users={users}
          decks={decks}
          onClose={() => setGameDetail(null)}
        />
      )}
      <SideNav
        open={sideNavOpen}
        onClose={() => setSideNavOpen(false)}
        activeView={activeView}
        onNavigate={setActiveView}
        onExportJson={() => downloadGamesJson(games, users, decks)}
        onExportExcel={() => downloadGamesExcel(games, users, decks)}
      />
      <header className="page-header top-bar">
        <button
          type="button"
          className="top-bar-menu-btn"
          aria-label="Ouvrir le menu"
          onClick={() => setSideNavOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path
              fill="currentColor"
              d="M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h14a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h14a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1Z"
            />
          </svg>
        </button>

        <div className="top-bar-brand">
          <h1>MagicAddicts Stats</h1>
          <p className="eyebrow">Commander</p>
        </div>

        <nav className="top-bar-nav top-bar-nav-desktop" aria-label="Navigation">
          <button
            type="button"
            className={`btn btn-tab${activeView === 'dashboard' ? ' is-active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`btn btn-tab${activeView === 'players' ? ' is-active' : ''}`}
            onClick={() => setActiveView('players')}
          >
            Joueurs & decks
          </button>
          <button
            type="button"
            className={`btn btn-tab${activeView === 'json' ? ' is-active' : ''}`}
            onClick={() => setActiveView('json')}
          >
            Édition JSON
          </button>
        </nav>

        <div className="top-bar-actions">
          <button
            type="button"
            className={`btn btn-ghost top-bar-export-btn${isFakeData ? ' is-fake-data' : ''}`}
            onClick={handleToggleDataSource}
          >
            {isFakeData ? 'Clear' : 'Fake data'}
          </button>
          <button
            type="button"
            className="btn btn-ghost top-bar-export-btn"
            onClick={() => downloadGamesJson(games, users, decks)}
          >
            ↓ JSON
          </button>
          <button
            type="button"
            className="btn btn-ghost top-bar-export-btn"
            onClick={() => downloadGamesExcel(games, users, decks)}
          >
            ↓ Excel
          </button>
          {activeView === 'dashboard' && (
            <>
              <button
                type="button"
                className={`btn btn-ghost btn-live${liveGameCount > 0 ? ' has-temp-game' : ''}`}
                onClick={openLiveGame}
              >
                {liveGameCount > 0 ? `● Live (${liveGameCount})` : 'Live'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-add"
                onClick={openAddForm}
              >
                + Partie
              </button>
            </>
          )}
        </div>
      </header>

      {activeView === 'json' ? (
        <JsonEditor
          games={games}
          onSave={handleJsonSave}
          onCancel={() => setActiveView('dashboard')}
        />
      ) : activeView === 'tempGame' && tempGame ? (
        <TempGameView
          tempGame={tempGame}
          onChange={handleTempGameChange}
          onFinalize={handleFinalizeTempGame}
          onAbandon={handleAbandonTempGame}
          onBack={() => setActiveView('dashboard')}
        />
      ) : activeView === 'players' ? (
        <PlayersManager
          users={users}
          decks={decks}
          onSave={handleCatalogSave}
          onZoom={handleZoom}
        />
      ) : (
      <DashboardShell filterPanels={dashboardFilterPanels}>
        <section className="panel panel-stats">
          <div className="panel-header">
            <div className="section-heading">
              <div className="section-heading-start">
                <h2>Stats</h2>
                {isStatsFiltered && (
                  <p className="filter-count">
                    {statsFilteredGames.length}/{games.length}
                  </p>
                )}
              </div>
              <p className="results-count">
                résultats : {Object.keys(stats.winsByPlayer).length}
              </p>
            </div>

            <div className="panel-filters-desktop">
              <FiltersBar
                nameQuery={statsNameQuery}
                onNameQuery={setStatsNameQuery}
                minWinrate={statsMinWinrate}
                onMinWinrate={setStatsMinWinrate}
                namePlaceholder="Joueur…"
                minWinrateLabel="Winrate joueur min"
              />
            </div>
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
                <div className="label">Board wipes (moy.)</div>
                <div className="value">{stats.avgBoardWipes}</div>
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
              <div className="section-heading-start">
                <h2>Commandants</h2>
                {isComsFiltered && (
                  <p className="filter-count">
                    {filteredDecks.length}/{Object.keys(allStats.winsByDeck).length}
                  </p>
                )}
              </div>
              <p className="results-count">
                résultats : {filteredDecks.length}
              </p>
            </div>

            <div className="panel-filters-desktop">
              <FiltersBar
                nameQuery={comNameQuery}
                onNameQuery={setComNameQuery}
                minWinrate={comMinWinrate}
                onMinWinrate={setComMinWinrate}
                sortWinrate={comSortWinrate}
                onSortWinrate={setComSortWinrate}
                showSort
              />
            </div>
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
                    onDetail={setDeckDetail}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel panel-games">
          <div className="panel-header">
            <div className="section-heading">
              <div className="section-heading-start">
                <h2>Parties</h2>
                {isGamesFiltered && (
                  <p className="filter-count">
                    {displayGames.length}/{games.length}
                  </p>
                )}
              </div>
              <p className="results-count">
                résultats : {displayGames.length}
              </p>
            </div>

            <div className="panel-filters-desktop">
              <GamesFiltersBar
                commanderOptions={gameCommanderOptions}
                comDeckId={gameComDeckId}
                onComDeckId={setGameComDeckId}
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
            </div>
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
                  users={users}
                  decks={decks}
                  onZoom={handleZoom}
                  onDetails={setGameDetail}
                />
              ))
            )}
          </div>
        </section>
      </DashboardShell>
      )}
    </div>
  )
}

export default App
