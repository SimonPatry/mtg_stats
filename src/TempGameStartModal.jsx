import { useEffect, useMemo, useState } from 'react'
import { getActiveUsers } from './playersMapping'
import Select from './Select'
import { createTempGame } from './tempGame'

const emptySeat = (seatOrder) => ({ seatOrder, userId: '', player: '' })

export default function TempGameStartModal({ users, onStart, onClose }) {
  const activeUsers = useMemo(
    () => getActiveUsers(users).sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  )
  const [seats, setSeats] = useState([
    emptySeat(1),
    emptySeat(2),
    emptySeat(3),
    emptySeat(4),
  ])
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function setSeat(index, userId) {
    const user = activeUsers.find((u) => u.id === userId)
    setSeats((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, userId, player: user?.name ?? '' } : s,
      ),
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const ids = seats.map((s) => s.userId)
    if (ids.some((id) => !id)) {
      setError('Choisis les 4 joueurs.')
      return
    }
    if (new Set(ids).size !== 4) {
      setError('Chaque joueur ne peut apparaître qu\'une fois.')
      return
    }
    onStart(createTempGame(seats))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal temp-game-start-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h2>Nouvelle partie live</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="temp-game-start-hint">
          Choisis les 4 joueurs. Les decks seront renseignés à la fin de la partie.
        </p>

        <div className="temp-game-start-seats">
          {seats.map((seat, i) => {
            const taken = new Set(
              seats.filter((_, j) => j !== i).map((s) => s.userId).filter(Boolean),
            )
            return (
              <label key={seat.seatOrder} className="form-field">
                <span>Joueur #{seat.seatOrder}</span>
                <Select
                  value={seat.userId}
                  onChange={(e) => setSeat(i, e.target.value)}
                  required
                >
                  <option value="">Joueur…</option>
                  {activeUsers.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                      disabled={taken.has(user.id)}
                    >
                      {user.name}
                    </option>
                  ))}
                </Select>
              </label>
            )
          })}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary">
            Démarrer
          </button>
        </div>
      </form>
    </div>
  )
}
