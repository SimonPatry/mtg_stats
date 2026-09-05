import { useState } from 'react'
import { api } from '../lib/api.js'

/**
 * Ménage du vocabulaire de tags : renommer, supprimer.
 *
 * La création courante se fait dans le formulaire d'un deck, juste au-dessus ;
 * ce panneau existe pour ce que le sélecteur ne sait pas faire — corriger une
 * faute de frappe et retirer un tag devenu inutile.
 *
 * La liste vient de l'écran et y retourne : renommer un tag ici doit se voir
 * immédiatement dans le sélecteur voisin, sans rechargement.
 */
export default function TagAdmin({ tags, onTagsChange }) {
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [pending, setPending] = useState(null)

  const reload = () => api.listTags().then(onTagsChange).catch((e) => setError(e.message))

  async function guard(action) {
    setError('')
    try {
      await action()
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  /**
   * Suppression en deux temps : l'API refuse tant que la confirmation n'est pas
   * transmise et renvoie le nombre de decks concernés. On l'affiche, on exige la
   * case, puis on rappelle la même route avec la confirmation.
   */
  async function confirmDelete() {
    await guard(() => api.deleteTag(pending.tag.id, true))
    setPending(null)
  }

  const plural = (n) => (n > 1 ? 's' : '')

  return (
    <div className="tag-admin panel">
      <h3>Tags</h3>

      <div className="tag-admin-body">
      <p className="form-hint">
        Le vocabulaire du sélecteur de tags. On en crée depuis le formulaire
        de deck ; ici on les renomme et on les supprime.
      </p>

      <form
        className="tag-admin-add"
        onSubmit={(e) => {
          e.preventDefault()
          guard(async () => { await api.createTag(label); setLabel('') })
        }}
      >
        <input
          type="text"
          value={label}
          placeholder="Nouveau tag (ex. Combo)"
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!label.trim()}>
          Ajouter
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {tags.length === 0 && <p className="form-hint">Aucun tag.</p>}

      <ul className="tag-admin-list">
        {tags.map((tag) => (
          <li className="tag-admin-row" key={tag.id}>
            {editing?.id === tag.id ? (
              <input
                type="text"
                value={editing.label}
                autoFocus
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              />
            ) : (
              <div className="tag-admin-identity">
                <span className="tag-admin-label">{tag.label}</span>
                <span className="tag-admin-meta">
                  {tag.deck_count === 0
                    ? 'utilisé par aucun deck'
                    : `utilisé par ${tag.deck_count} deck${plural(tag.deck_count)}`}
                </span>
              </div>
            )}

            <div className="tag-admin-actions">
              {editing?.id === tag.id ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-tiny"
                    onClick={() => guard(async () => {
                      await api.updateTag(tag.id, editing.label)
                      setEditing(null)
                    })}
                  >
                    Enregistrer
                  </button>
                  <button type="button" className="btn btn-ghost btn-tiny"
                    onClick={() => setEditing(null)}>
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-ghost btn-tiny"
                    onClick={() => setEditing({ id: tag.id, label: tag.label })}>
                    Renommer
                  </button>
                  <button type="button" className="btn btn-danger-ghost btn-tiny"
                    onClick={() => setPending({ tag, confirmed: false })}>
                    Supprimer
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {pending && (
        <div className="tag-admin-warn">
          <strong>Supprimer le tag « {pending.tag.label} » ?</strong>
          <p className="form-hint">
            {pending.tag.deck_count === 0
              ? 'Ce tag n’est utilisé par aucun deck.'
              : `Ce tag est utilisé par ${pending.tag.deck_count} deck${
                  plural(pending.tag.deck_count)}. Il en sera retiré, mais aucun deck ne sera supprimé.`}
          </p>

          {pending.tag.deck_count > 0 && (
            <label className="form-check">
              <input
                type="checkbox"
                checked={pending.confirmed}
                onChange={(e) => setPending({ ...pending, confirmed: e.target.checked })}
              />
              <span>
                Je comprends que ce tag sera retiré de {pending.tag.deck_count} deck
                {plural(pending.tag.deck_count)}.
              </span>
            </label>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={pending.tag.deck_count > 0 && !pending.confirmed}
              onClick={confirmDelete}
            >
              Supprimer définitivement
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
