import { useEffect } from 'react'
import {
  formatBracketLine,
  formatCommanders,
  getDeckVersionChain,
  getUserName,
} from './playersMapping'

function versionStats(statsByDeckId, deckId) {
  const data = statsByDeckId[deckId]
  if (!data) return { wins: 0, games: 0, winrate: 0 }
  const winrate = data.games === 0 ? 0 : Math.round((data.wins / data.games) * 100)
  return { wins: data.wins, games: data.games, winrate }
}

export default function DeckStatsModal({
  deck,
  decks,
  users,
  statsByDeckId,
  onClose,
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const chain = getDeckVersionChain(decks, deck.deckId)
  const versions =
    chain.length > 0
      ? chain
      : deck.deckId
        ? [
            {
              id: deck.deckId,
              com: deck.commanders.length === 1 ? deck.commanders[0] : deck.commanders,
              bracket: deck.bracket,
              bracketVariation: deck.bracketVariation,
              deckUrl: deck.deckUrl,
              active: true,
            },
          ]
        : []

  const combined = {
    wins: deck.wins,
    games: deck.games,
    winrate: deck.games === 0 ? 0 : Math.round((deck.wins / deck.games) * 100),
  }

  const commanderLabel = formatCommanders(
    versions[0]?.com ?? deck.commanders,
  )
  const playerLabel = deck.player || getUserName(users, versions[0]?.userId)

  return (
    <div
      className="modal-backdrop deck-stats-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal deck-stats-modal"
        role="dialog"
        aria-labelledby="deck-stats-modal-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="deck-stats-modal-title">{commanderLabel}</h2>
            {playerLabel && (
              <p className="deck-stats-modal-subtitle">{playerLabel}</p>
            )}
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="deck-stats-summary">
          <div className="deck-stats-summary-stat">
            <strong>{combined.winrate}%</strong>
            <span>winrate global</span>
          </div>
          <div className="deck-stats-summary-stat">
            <strong>
              {combined.wins}/{combined.games}
            </strong>
            <span>victoires</span>
          </div>
          <div className="deck-stats-summary-stat">
            <strong>{versions.length}</strong>
            <span>
              version{versions.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {versions.length === 0 ? (
          <p className="deck-stats-empty">
            Aucune version cataloguée pour ce deck.
          </p>
        ) : (
          <ul className="deck-stats-version-list">
            {versions.map((record, index) => {
              const stats = versionStats(statsByDeckId, record.id)
              const isActive = record.active !== false
              const versionLabel =
                versions.length === 1
                  ? 'Version unique'
                  : `Version ${index + 1}`

              return (
                <li key={record.id} className="deck-stats-version-item">
                  <div className="deck-stats-version-head">
                    <div>
                      <h3 className="deck-stats-version-title">{versionLabel}</h3>
                      <p className="deck-stats-version-bracket">
                        {formatBracketLine(record.bracket, record.bracketVariation)}
                      </p>
                    </div>
                    <span
                      className={`deck-stats-version-badge${isActive ? ' is-active' : ''}`}
                    >
                      {isActive ? 'Actuelle' : 'Ancienne'}
                    </span>
                  </div>

                  <div className="deck-stats-version-stats">
                    <div className="deck-stats-version-stat">
                      <strong>{stats.winrate}%</strong>
                      <span>winrate</span>
                    </div>
                    <div className="deck-stats-version-stat">
                      <strong>
                        {stats.wins}/{stats.games}
                      </strong>
                      <span>victoires</span>
                    </div>
                  </div>

                  {record.deckUrl ? (
                    <a
                      className="deck-link deck-stats-version-link"
                      href={record.deckUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Voir le deck
                    </a>
                  ) : null}

                  {record.history?.length > 0 && (
                    <ul className="deck-stats-version-history">
                      {[...record.history].reverse().slice(0, 3).map((entry, i) => (
                        <li key={`${entry.date}-${i}`}>
                          <time dateTime={entry.date}>{entry.date}</time>
                          {' · '}
                          {entry.previousValue && entry.newValue
                            ? `${entry.previousValue} → ${entry.newValue}`
                            : entry.newValue || entry.previousValue}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
