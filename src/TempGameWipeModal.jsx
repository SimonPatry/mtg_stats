import { useEffect, useState } from 'react'
import Select from './Select'
import NumberStepper from './NumberStepper'

export default function TempGameWipeModal({ tempGame, onSave, onClose }) {
  const [player, setPlayer] = useState(tempGame.players[0]?.player ?? '')
  const [turn, setTurn] = useState(tempGame.currentTurn || 1)
  const [protectedPlayers, setProtectedPlayers] = useState([])
  const [partiallyProtectedPlayers, setPartiallyProtectedPlayers] = useState([])
  const [countered, setCountered] = useState(false)
  const [counteredBy, setCounteredBy] = useState('')
  const [error, setError] = useState('')

  function toggleProtected(name) {
    setProtectedPlayers((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    )
  }

  function togglePartiallyProtected(name) {
    setPartiallyProtectedPlayers((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    )
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!player) {
      setError('Choisis un joueur.')
      return
    }
    if (countered && !counteredBy) {
      setError('Choisis le joueur qui a contré.')
      return
    }
    onSave({
      player,
      turn,
      ...(protectedPlayers.length ? { protected: protectedPlayers } : {}),
      ...(partiallyProtectedPlayers.length
        ? { partiallyProtected: partiallyProtectedPlayers }
        : {}),
      ...(countered ? { countered: true, counteredBy } : {}),
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
          <h2>Board wipe</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="form-field">
          <span>Joueur</span>
          <Select value={player} onChange={(e) => setPlayer(e.target.value)} required>
            {tempGame.players.map((p) => (
              <option key={p.player} value={p.player}>
                {p.player}
              </option>
            ))}
          </Select>
        </label>

        <label className="form-field">
          <span>Tour</span>
          <NumberStepper min={1} step={1} value={turn} onChange={setTurn} />
        </label>

        <fieldset className="temp-game-fieldset">
          <legend>Protégés</legend>
          <div className="temp-game-victim-list">
            {tempGame.players.map((p) => (
              <label key={p.player} className="form-check">
                <input
                  type="checkbox"
                  checked={protectedPlayers.includes(p.player)}
                  onChange={() => toggleProtected(p.player)}
                />
                {p.player}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="temp-game-fieldset">
          <legend>Partiellement protégés</legend>
          <div className="temp-game-victim-list">
            {tempGame.players.map((p) => (
              <label key={p.player} className="form-check">
                <input
                  type="checkbox"
                  checked={partiallyProtectedPlayers.includes(p.player)}
                  onChange={() => togglePartiallyProtected(p.player)}
                />
                {p.player}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="form-check temp-game-countered-check">
          <input
            type="checkbox"
            checked={countered}
            onChange={(e) => {
              setCountered(e.target.checked)
              if (!e.target.checked) setCounteredBy('')
            }}
          />
          Contré
        </label>

        {countered && (
          <label className="form-field">
            <span>Contré par</span>
            <Select
              value={counteredBy}
              onChange={(e) => setCounteredBy(e.target.value)}
              required
            >
              <option value="">—</option>
              {tempGame.players.map((p) => (
                <option key={p.player} value={p.player}>
                  {p.player}
                </option>
              ))}
            </Select>
          </label>
        )}

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
