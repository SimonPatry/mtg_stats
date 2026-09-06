import { useState } from 'react'
import { api } from '../../lib/api.js'

/**
 * Un seul contrôle tags : pastilles style Admin/Membre.
 * Clic = poser / retirer du deck. × = supprimer du vocabulaire. Créer ajoute et pose.
 */
export default function TagPicker({ value, onChange, tags, onTagsChange }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectedIds = value.map(String)

  function toggle(id) {
    const sid = String(id)
    if (selectedIds.includes(sid)) {
      onChange(value.filter((x) => String(x) !== sid))
    } else {
      onChange([...value, id])
    }
  }

  async function removeFromVocab(tag) {
    setError('')
    try {
      await api.deleteTag(tag.id)
      onTagsChange?.(tags.filter((t) => String(t.id) !== String(tag.id)))
      onChange(value.filter((id) => String(id) !== String(tag.id)))
    } catch (err) {
      setError(err.message || 'Suppression impossible')
    }
  }

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
      const existing = tags.find(
        (t) => t.label.toLowerCase() === label.toLowerCase())
      if (existing) {
        if (!selectedIds.includes(String(existing.id))) {
          onChange([...value, existing.id])
        }
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
      <div className="forge-tag-row">
        {tags.length === 0 && <span className="tag-picker-empty">Aucun tag.</span>}
        {tags.map((tag) => {
          const on = selectedIds.includes(String(tag.id))
          return (
            <span key={tag.id} className={`forge-tag${on ? ' is-on' : ''}`}>
              <button
                type="button"
                className="forge-tag-label"
                aria-pressed={on}
                title={on ? 'Retirer du deck' : 'Ajouter au deck'}
                onClick={() => toggle(tag.id)}
              >
                {tag.label}
              </button>
              <button
                type="button"
                className="forge-tag-remove"
                title="Supprimer le tag"
                aria-label={`Supprimer ${tag.label}`}
                onClick={() => removeFromVocab(tag)}
              >
                ×
              </button>
            </span>
          )
        })}
      </div>

      <div className="tag-picker-controls">
        <input
          type="text"
          value={draft}
          placeholder="Nouveau tag…"
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); create() }
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-tiny"
          disabled={busy || !draft.trim()}
          onClick={create}
        >
          Ajouter
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
