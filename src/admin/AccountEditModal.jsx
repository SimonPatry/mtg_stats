import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Select from '../Select.jsx'

/**
 * Édition d'un inscrit : nom d'affichage, actif, rôle du compte.
 */
export default function AccountEditModal({ user, saving, onClose, onSave }) {
  const [name, setName] = useState(user.name)
  const [active, setActive] = useState(user.active !== false)
  const [role, setRole] = useState(user.accountRole === 'admin' ? 'admin' : 'user')
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Le nom est obligatoire.')
      return
    }
    try {
      await onSave({
        name: trimmed,
        active,
        role,
        accountId: user.accountId,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal account-edit-modal"
        role="dialog"
        aria-labelledby="account-edit-title"
        aria-modal="true"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="account-edit-title">Éditer l’inscrit</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body account-edit-body">
            <p className="hint">
              Compte&nbsp;: <strong>@{user.accountUsername || '—'}</strong>
            </p>

            <label className="form-field">
              <span>Nom affiché</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </label>

            <label className="form-field">
              <span>Rôle</span>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="user">Membre</option>
                <option value="admin">Administrateur</option>
              </Select>
            </label>

            <label className="form-field form-field-checkbox">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span>Compte actif (visible dans le roster)</span>
            </label>

            {error && <p className="error">{error}</p>}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
