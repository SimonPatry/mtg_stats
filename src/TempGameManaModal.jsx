import { useEffect, useState } from 'react'
import NumberStepper from './NumberStepper'
import { emptyPlayerMap } from './tempGame'

export default function TempGameManaModal({ tempGame, onSave, onClose }) {
  const [manaRule, setManaRule] = useState(null)
  const [manaByPlayer, setManaByPlayer] = useState(() => emptyPlayerMap(tempGame, 0))
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function setPlayerMana(name, value) {
    setManaByPlayer((prev) => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!manaRule) {
      setError('Choisis T4 ou T5.')
      return
    }
    onSave({ manaRule, manaByPlayer })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal temp-game-event-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h2>Mana</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="temp-game-mana-rule">
          <span className="temp-game-mana-rule-label">Tour</span>
          <div className="temp-game-toggle-group">
            <button
              type="button"
              className={`btn btn-ghost${manaRule === 'T4' ? ' is-active' : ''}`}
              onClick={() => setManaRule('T4')}
            >
              T4
            </button>
            <button
              type="button"
              className={`btn btn-ghost${manaRule === 'T5' ? ' is-active' : ''}`}
              onClick={() => setManaRule('T5')}
            >
              T5
            </button>
          </div>
        </div>

        <fieldset className="temp-game-fieldset">
          <legend>Mana accessible par joueur</legend>
          {tempGame.players.map((p) => (
            <label key={p.player} className="temp-game-player-row">
              <span>{p.player}</span>
              <NumberStepper
                min={0}
                step={1}
                value={manaByPlayer[p.player] ?? 0}
                onChange={(v) => setPlayerMana(p.player, v)}
              />
            </label>
          ))}
        </fieldset>

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
