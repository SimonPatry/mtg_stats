/**
 * Éditeur des liens d'inspiration (URL + libellé optionnel).
 * Les lignes vides sont ignorées à la sauvegarde côté parent.
 * Sur la vitrine, les URLs YouTube sans libellé affichent le titre de la vidéo.
 */
export default function InspirationEditor({ items = [], onChange }) {
  function setRow(index, patch) {
    onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  function addRow() {
    onChange([...items, { url: '', label: '' }])
  }

  return (
    <div className="inspiration-editor">
      {items.length === 0 && (
        <p className="form-hint">
          Aucun lien. Ajoute des sources (EDHREC, article, vidéo…) révélées sur
          la vitrine. YouTube : le titre de la vidéo s’affiche tout seul si le
          libellé est vide.
        </p>
      )}

      {items.map((item, index) => (
        <div className="inspiration-editor__row" key={index}>
          <input
            type="text"
            inputMode="url"
            className="inspiration-editor__url"
            value={item.url}
            placeholder="https://…"
            maxLength={500}
            autoComplete="off"
            onChange={(e) => setRow(index, { url: e.target.value })}
          />
          <input
            type="text"
            className="inspiration-editor__label"
            value={item.label}
            placeholder="Libellé (optionnel)"
            maxLength={120}
            onChange={(e) => setRow(index, { label: e.target.value })}
          />
          <button
            type="button"
            className="btn btn-ghost btn-tiny"
            title="Retirer"
            aria-label="Retirer le lien"
            onClick={() => removeRow(index)}
          >
            ×
          </button>
        </div>
      ))}

      <button type="button" className="btn btn-ghost btn-tiny" onClick={addRow}>
        + Ajouter un lien
      </button>
    </div>
  )
}

/** Ne garde que les URLs non vides, prêtes pour l’API. */
export function cleanInspirations(items = []) {
  return items
    .map((item) => {
      let url = String(item.url || '').trim()
      // Zod / type=url exigent un schéma : on normalise les collages « edhrec.com/… ».
      if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`
      return {
        url,
        label: String(item.label || '').trim(),
      }
    })
    .filter((item) => {
      if (!item.url) return false
      try {
        return Boolean(new URL(item.url))
      } catch {
        return false
      }
    })
}
