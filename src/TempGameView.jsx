import { useState } from 'react'
import NumberStepper from './NumberStepper'
import TempGameDeathModal from './TempGameDeathModal'
import TempGameManaModal from './TempGameManaModal'
import TempGameWipeModal from './TempGameWipeModal'
import {
  addDeathEvent,
  addManaEvent,
  addWipeEvent,
  isPlayerAlive,
  styleLabel,
} from './tempGame'
import { formatWipeProtection } from './gameDetails'

export default function TempGameView({
  tempGame,
  onChange,
  onFinalize,
  onAbandon,
  onBack,
}) {
  const [showWipe, setShowWipe] = useState(false)
  const [showMana, setShowMana] = useState(false)
  const [showDeath, setShowDeath] = useState(false)

  const manaEvents = tempGame.manaEvents ?? []

  function updateTurn(currentTurn) {
    onChange({ ...tempGame, currentTurn })
  }

  function handleWipe(event) {
    onChange(addWipeEvent(tempGame, event))
    setShowWipe(false)
  }

  function handleMana(event) {
    onChange(addManaEvent(tempGame, event))
    setShowMana(false)
  }

  function handleDeath(event) {
    onChange(addDeathEvent(tempGame, event))
    setShowDeath(false)
  }

  const events = [
    ...tempGame.wipeEvents.map((e) => ({ kind: 'wipe', turn: e.turn, data: e })),
    ...manaEvents.map((e) => ({ kind: 'mana', turn: e.turn, data: e })),
    ...tempGame.deathEvents.map((e) => ({ kind: 'death', turn: e.turn, data: e })),
  ].sort((a, b) => a.turn - b.turn || a.kind.localeCompare(b.kind))

  return (
    <div className="temp-game-shell">
      <div className="temp-game-view">
        <div className="temp-game-header">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            ← Retour
          </button>
          <div className="temp-game-turn-block">
            <span className="temp-game-turn-label">Tour actuel</span>
            <NumberStepper
              min={1}
              step={1}
              value={tempGame.currentTurn || 1}
              onChange={updateTurn}
            />
          </div>
        </div>

        <section className="temp-game-tools">
          <h2 className="subsection-title">Actions</h2>
          <div className="temp-game-tool-buttons">
            <button type="button" className="btn btn-ghost" onClick={() => setShowWipe(true)}>
              Wipe
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowMana(true)}>
              Mana
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowDeath(true)}>
              Mort
            </button>
            <button type="button" className="btn btn-primary" onClick={onFinalize}>
              Terminer → Partie
            </button>
            <button type="button" className="btn btn-ghost temp-game-abandon" onClick={onAbandon}>
              Abandonner
            </button>
          </div>
        </section>

        <section className="temp-game-players">
          <h2 className="subsection-title">Joueurs</h2>
          <ul className="temp-game-player-cards">
            {tempGame.players.map((p) => {
              const alive = isPlayerAlive(tempGame, p.player)
              return (
                <li
                  key={p.seatOrder}
                  className={`temp-game-player-card${alive ? '' : ' is-dead'}`}
                >
                  <span className="temp-game-player-seat">#{p.seatOrder}</span>
                  <span className="temp-game-player-name">{p.player}</span>
                  <span className="temp-game-player-status">
                    {alive ? 'En vie' : 'Éliminé'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="temp-game-log">
          <h2 className="subsection-title">
            Journal ({tempGame.wipeEvents.length} wipe
            {tempGame.wipeEvents.length !== 1 ? 's' : ''}, {manaEvents.length} mana,{' '}
            {tempGame.deathEvents.length} mort
            {tempGame.deathEvents.length !== 1 ? 's' : ''})
          </h2>
          {events.length === 0 ? (
            <p className="empty-filter">Aucun événement pour l&apos;instant.</p>
          ) : (
            <ul className="temp-game-event-list">
              {events.map((entry) => {
                if (entry.kind === 'wipe') {
                  const protection = formatWipeProtection(entry.data)
                  return (
                    <li key={entry.data.id} className="temp-game-event temp-game-event-wipe">
                      <strong>Tour {entry.turn}</strong> — Wipe — {entry.data.player}
                      {protection && (
                        <span className="temp-game-event-detail">{protection}</span>
                      )}
                    </li>
                  )
                }
                if (entry.kind === 'mana') {
                  return (
                    <li key={entry.data.id} className="temp-game-event temp-game-event-mana">
                      <strong>{entry.data.manaRule}</strong>
                      <span className="temp-game-event-detail">
                        {tempGame.players
                          .map(
                            (p) =>
                              `${p.player}: ${entry.data.manaByPlayer?.[p.player] ?? '?'} mana`,
                          )
                          .join(' · ')}
                      </span>
                    </li>
                  )
                }
                return (
                  <li key={entry.data.id} className="temp-game-event temp-game-event-death">
                    <strong>Tour {entry.turn}</strong> — {entry.data.victims.join(', ')} éliminé
                    {entry.data.victims.length > 1 ? 's' : ''}
                    <span className="temp-game-event-detail">
                      tueur: {entry.data.killer ?? '—'} · {styleLabel(entry.data.killStyle)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {showWipe && (
          <TempGameWipeModal
            tempGame={tempGame}
            onSave={handleWipe}
            onClose={() => setShowWipe(false)}
          />
        )}
        {showMana && (
          <TempGameManaModal
            tempGame={tempGame}
            onSave={handleMana}
            onClose={() => setShowMana(false)}
          />
        )}
        {showDeath && (
          <TempGameDeathModal
            tempGame={tempGame}
            onSave={handleDeath}
            onClose={() => setShowDeath(false)}
          />
        )}
      </div>
    </div>
  )
}
