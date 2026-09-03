import { useEffect } from 'react'
import { listTempGames, tempGameSummary } from './tempGame'

function formatStartedAt(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TempGamePickerModal({
  liveStore,
  onSelect,
  onNew,
  onAbandon,
  onClose,
}) {
  const games = listTempGames(liveStore)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal temp-game-picker-modal"
        role="dialog"
        aria-labelledby="temp-game-picker-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="temp-game-picker-title">Parties live</h2>
            <p className="temp-game-picker-subtitle">
              Reprends une partie en cours ou lance-en une nouvelle.
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        {games.length === 0 ? (
          <p className="temp-game-picker-empty">Aucune partie live en cours.</p>
        ) : (
          <ul className="temp-game-picker-list">
            {games.map((game) => {
              const summary = tempGameSummary(game)
              const isActive = liveStore.activeId === game.id
              return (
                <li
                  key={game.id}
                  className={`temp-game-picker-card${isActive ? ' is-active' : ''}`}
                >
                  <div className="temp-game-picker-card-main">
                    <p className="temp-game-picker-players">
                      {summary.playerNames.join(' · ')}
                    </p>
                    <p className="temp-game-picker-meta">
                      Tour {summary.turn} · {summary.wipeCount} wipe
                      {summary.wipeCount !== 1 ? 's' : ''} · {summary.manaCount} mana ·{' '}
                      {summary.deathCount} mort{summary.deathCount !== 1 ? 's' : ''}
                    </p>
                    <p className="temp-game-picker-date">
                      Démarrée {formatStartedAt(summary.createdAt)}
                      {isActive && <span className="temp-game-picker-active-tag">Active</span>}
                    </p>
                  </div>
                  <div className="temp-game-picker-card-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onSelect(game.id)}
                    >
                      Reprendre
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost temp-game-picker-abandon"
                      onClick={() => onAbandon(game.id)}
                    >
                      Abandonner
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="modal-actions temp-game-picker-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className="btn btn-primary" onClick={onNew}>
            + Nouvelle partie live
          </button>
        </div>
      </div>
    </div>
  )
}
