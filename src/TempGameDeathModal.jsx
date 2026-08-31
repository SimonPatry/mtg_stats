import { useEffect, useMemo, useState } from 'react'
import Select from './Select'
import NumberStepper from './NumberStepper'
import { isPlayerAlive, KILL_STYLES } from './tempGame'

export default function TempGameDeathModal({ tempGame, onSave, onClose }) {
  const [turn, setTurn] = useState(tempGame.currentTurn || 1)
  const [victims, setVictims] = useState([])
  const [killer, setKiller] = useState('')
  const [killStyle, setKillStyle] = useState('combat')
  const [error, setError] = useState('')

  const alivePlayers = useMemo(
    () => tempGame.players.filter((p) => isPlayerAlive(tempGame, p.player)),
    [tempGame],
  )

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggleVictim(name) {
    setVictims((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name],
    )
    if (killer === name) setKiller('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (victims.length === 0) {
      setError('Sélectionne au moins un joueur éliminé.')
      return
    }
    onSave({
      turn,
      victims,
      killer: killer || null,
      killStyle,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal temp-game-event-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h2>Mort de joueur(s)</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="form-field">
          <span>Tour de la mort</span>
          <NumberStepper min={1} step={1} value={turn} onChange={setTurn} />
        </label>

        <fieldset className="temp-game-fieldset">
          <legend>Joueur(s) éliminé(s)</legend>
          <div className="temp-game-victim-list">
            {alivePlayers.map((p) => (
              <label key={p.player} className="form-check">
                <input
                  type="checkbox"
                  checked={victims.includes(p.player)}
                  onChange={() => toggleVictim(p.player)}
                />
                {p.player}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="form-field">
          <span>Tueur</span>
          <Select value={killer} onChange={(e) => setKiller(e.target.value)}>
            <option value="">—</option>
            {tempGame.players
              .filter((p) => !victims.includes(p.player))
              .map((p) => (
                <option key={p.player} value={p.player}>
                  {p.player}
                </option>
              ))}
          </Select>
        </label>

        <label className="form-field">
          <span>Style de kill</span>
          <Select value={killStyle} onChange={(e) => setKillStyle(e.target.value)}>
            {KILL_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  )
}
