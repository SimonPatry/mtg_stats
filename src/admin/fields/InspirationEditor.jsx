/**
 * Éditeur des liens d'inspiration (URL + libellé optionnel).
 * Les lignes vides sont ignorées à la sauvegarde côté parent.
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
          la vitrine.
        </p>
      )}

      {items.map((item, index) => (
        <div className="inspiration-editor__row" key={index}>
          <input
            type="url"
            className="inspiration-editor__url"
            value={item.url}
            placeholder="https://…"
            maxLength={500}
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
    .map((item) => ({
      url: String(item.url || '').trim(),
      label: String(item.label || '').trim(),
    }))
    .filter((item) => item.url.length > 0)
}
