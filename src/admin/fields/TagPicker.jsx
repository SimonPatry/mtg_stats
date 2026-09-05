import { useState } from 'react'
import { api } from '../../lib/api.js'

/**
 * Sélection dans le vocabulaire de tags.
 *
 * La liste déroulante reste la voie normale — c'est tout l'intérêt d'avoir
 * sorti les tags dans leur table. Mais un tag manquant en pleine saisie ne
 * doit pas obliger à quitter le formulaire : on peut en créer un ici, et le
 * ménage (renommer, supprimer) se fait sur l'écran Tags.
 */
export default function TagPicker({ value, onChange, tags, onTagsChange }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selected = tags.filter((t) => value.includes(t.id))
  const available = tags.filter((t) => !value.includes(t.id))

  async function create() {
    const label = draft.trim()
    if (!label) return
    setBusy(true)
    setError('')
    try {
      const tag = await api.createTag(label)
      onTagsChange?.([...tags, tag])
      onChange([...value, tag.id])
      setDraft('')
    } catch (err) {
      // 409 : le tag existe déjà. On le sélectionne plutôt que de râler.
      const existing = tags.find(
        (t) => t.label.toLowerCase() === label.toLowerCase())
      if (existing) {
        if (!value.includes(existing.id)) onChange([...value, existing.id])
        setDraft('')
      } else {
        setError(err.message || 'Création impossible')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tag-picker">
      <div className="chip-row">
        {selected.length === 0 && <span className="tag-picker-empty">Aucun tag posé.</span>}
        {selected.map((tag) => (
          <span key={tag.id} className="chip is-on">
            {tag.label}
            <button
              type="button"
              title="Retirer"
              className="chip-remove"
              onClick={() => onChange(value.filter((id) => id !== tag.id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="tag-picker-controls">
        <select
          value=""
          disabled={available.length === 0}
          onChange={(e) => {
            if (e.target.value) onChange([...value, e.target.value])
          }}
        >
          <option value="">
            {available.length
              ? 'Ajouter un tag…'
              : tags.length === 0
                ? 'Aucun tag dans le vocabulaire'
                : 'Tous les tags sont déjà posés'}
          </option>
          {available.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.label}</option>
          ))}
        </select>

        <input
          type="text"
          value={draft}
          placeholder="ou créer un tag…"
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Entrée créerait le tag ET soumettrait le formulaire parent.
            if (e.key === 'Enter') { e.preventDefault(); create() }
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-tiny"
          disabled={busy || !draft.trim()}
          onClick={create}
        >
          Créer
        </button>
      </div>

      {/* Saisir un nom sans cliquer sur « Créer », puis enregistrer le deck :
          le tag n'existe nulle part et la saisie est perdue sans un mot. */}
      {draft.trim() && !busy && (
        <p className="form-hint tag-picker-pending">
          « {draft.trim()} » n’est pas encore créé — clique sur Créer, ou appuie
          sur Entrée.
        </p>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
