import { useEffect, useMemo } from 'react'
import { getBoardWipes, getLastPlayerLabel, isLastDeck } from './gamesApi'
import {
  buildGameTimeline,
  composeGameNotes,
  formatManaByPlayer,
  formatWipeProtection,
  manaEventsByRule,
  winStyleLabel,
} from './gameDetails'
import { resolveDeckFromCatalog } from './playersMapping'
import { styleLabel } from './tempGame'

function formatBracket({ bracket, bracketVariation }) {
  if (bracket == null) return 'B?'
  if (!bracketVariation) return `B${bracket}`
  return `B${bracket} · ${bracketVariation}`
}

function deckLabel(deck) {
  return deck.commanders?.join(' / ') ?? '—'
}

function logEntryKindLabel(kind) {
  if (kind === 'wipe') return 'Wipe'
  if (kind === 'mana') return 'Mana'
  return 'Mort'
}

function TimelineItem({ entry }) {
  const stamp =
    entry.kind === 'mana' ? entry.data.manaRule : `Tour ${entry.turn}`

  let headline = ''
  let detail = ''

  if (entry.kind === 'wipe') {
    headline = `Board wipe — ${entry.data.player}`
    detail = formatWipeProtection(entry.data)
  } else if (entry.kind === 'mana') {
    headline = 'Relevé de mana accessible'
    detail = formatManaByPlayer(entry.data.manaByPlayer)
  } else {
    headline = `${entry.data.victims.join(', ')} éliminé${entry.data.victims.length > 1 ? 's' : ''}`
    detail = `${entry.data.killer ? `Par ${entry.data.killer}` : 'Cause inconnue'} · ${styleLabel(entry.data.killStyle)}`
  }

  return (
    <li className={`game-details-log-entry game-details-log-entry-${entry.kind}`}>
      <div className="game-details-log-entry-meta">
        <span className="game-details-log-stamp">{stamp}</span>
        <span className={`game-details-log-tag game-details-log-tag-${entry.kind}`}>
          {logEntryKindLabel(entry.kind)}
        </span>
      </div>
      <p className="game-details-log-headline">{headline}</p>
      {detail && <p className="game-details-log-detail">{detail}</p>}
    </li>
  )
}

export default function GameDetailsModal({ game, users, decks, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const resolvedDecks = useMemo(
    () =>
      [...game.decks]
        .sort((a, b) => a.seatOrder - b.seatOrder)
        .map((deck) => resolveDeckFromCatalog(decks, users, deck)),
    [game.decks, decks, users],
  )

  const winner = resolvedDecks.find((d) => d.result === 'win')
  const lastPlayerLabel = getLastPlayerLabel(game)
  const boardWipes = getBoardWipes(game)
  const timeline = buildGameTimeline(game)
  const mana = manaEventsByRule(game)
  const hasMana = mana.t4.length > 0 || mana.t5.length > 0
  const hasTimeline = timeline.length > 0
  const displayNotes = composeGameNotes(game.notes, game)

  return (
    <div className="modal-backdrop game-details-modal-backdrop" onClick={onClose}>
      <div
        className="modal game-details-modal"
        role="dialog"
        aria-labelledby="game-details-modal-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="game-details-modal-title">Partie du {game.date}</h2>
            <p className="game-details-subtitle">{formatBracket(game)}</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="game-details-modal-body">
          <div className="game-details-summary">
            <div className="game-details-stat">
              <span className="game-details-stat-label">Tours</span>
              <span className="game-details-stat-value">{game.turns}</span>
            </div>
            <div className="game-details-stat">
              <span className="game-details-stat-label">Gagnant</span>
              <span className="game-details-stat-value">{winner?.player ?? '—'}</span>
            </div>
            <div className="game-details-stat">
              <span className="game-details-stat-label">Last</span>
              <span className="game-details-stat-value">{lastPlayerLabel}</span>
            </div>
            <div className="game-details-stat">
              <span className="game-details-stat-label">Wipes</span>
              <span className="game-details-stat-value">{boardWipes}</span>
            </div>
            {game.winnerProtectedVictory && (
              <div className="game-details-stat game-details-stat-flag">
                <span className="game-details-stat-value">Victoire protégée</span>
              </div>
            )}
            {game.winStyle && (
              <div className="game-details-stat">
                <span className="game-details-stat-label">Style win</span>
                <span className="game-details-stat-value">{winStyleLabel(game.winStyle)}</span>
              </div>
            )}
          </div>

          <div className="game-details-columns">
            <div className="game-details-col game-details-col-players">
              <section className="game-details-section">
                <h3 className="game-details-section-title">Joueurs</h3>
                <ul className="game-details-players">
                  {resolvedDecks.map((deck) => (
                    <li key={deck.seatOrder} className="game-details-player-row">
                      <span className="game-details-player-seat">#{deck.seatOrder}</span>
                      <div className="game-details-player-main">
                        <span className="game-details-player-name">{deck.player}</span>
                        <span className="game-details-player-deck">{deckLabel(deck)}</span>
                      </div>
                      <div className="game-details-player-badges">
                        {deck.result === 'win' && (
                          <span className="game-details-badge game-details-badge-win">Win</span>
                        )}
                        {isLastDeck(game, deck) && (
                          <span className="game-details-badge game-details-badge-last">Last</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="game-details-col game-details-col-history">
              <section className="game-details-section game-details-logbook">
                <h3 className="game-details-section-title">Journal de bord</h3>

                <div className="game-details-logbook-pages">
                  {hasMana && (
                    <div className="game-details-log-mana-section">
                      {mana.t4.length > 0 && (
                        <div className="game-details-log-mana-sheet">
                          <span className="game-details-log-mana-label">T4</span>
                          {mana.t4.map((event) => (
                            <p key={event.id} className="game-details-log-mana-line">
                              {formatManaByPlayer(event.manaByPlayer)}
                            </p>
                          ))}
                        </div>
                      )}
                      {mana.t5.length > 0 && (
                        <div className="game-details-log-mana-sheet">
                          <span className="game-details-log-mana-label">T5</span>
                          {mana.t5.map((event) => (
                            <p key={event.id} className="game-details-log-mana-line">
                              {formatManaByPlayer(event.manaByPlayer)}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {hasTimeline ? (
                    <ol className="game-details-log-timeline">
                      {timeline.map((entry) => (
                        <TimelineItem
                          key={`${entry.kind}-${entry.data.id ?? entry.turn}`}
                          entry={entry}
                        />
                      ))}
                    </ol>
                  ) : (
                    !hasMana && (
                      <p className="game-details-log-empty">Aucune entrée enregistrée.</p>
                    )
                  )}

                  {displayNotes && (
                    <div className="game-details-log-notes">
                      <p className="game-details-log-notes-label">Notes & observations</p>
                      <div className="game-details-log-notes-body">
                        {displayNotes.split('\n').map((line, i) => (
                          <p key={`${i}-${line.slice(0, 12)}`} className="game-details-log-notes-line">
                            {line || '\u00A0'}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
