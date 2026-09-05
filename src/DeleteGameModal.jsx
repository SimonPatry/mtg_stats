import { useEffect, useState } from 'react'

export default function DeleteGameModal({ game, onConfirm, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!password.trim()) {
      setError('Mot de passe requis.')
      return
    }
    setBusy(true)
    try {
      await onConfirm(password)
    } catch (err) {
      setError(err.message || 'Suppression impossible')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <form
        className="modal delete-game-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h2>Supprimer la partie</h2>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>

        <p className="delete-game-hint">
          Partie du <strong>{game.date}</strong>. Un backup sera créé avant
          suppression. Entre le mot de passe admin pour confirmer.
        </p>

        <label className="form-field">
          <span>Mot de passe</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoFocus
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Annuler
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy}>
            {busy ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </form>
    </div>
  )
}
