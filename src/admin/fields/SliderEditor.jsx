import CardPicker from './CardPicker.jsx'

/**
 * Éditeur des carrousels : des sections ordonnées, chacune contenant des cartes
 * ordonnées. C'est cette structure imbriquée qui rendait l'édition du JSON à la
 * main pénible.
 */
export default function SliderEditor({ sections, onChange, errors }) {
  const replace = (index, section) =>
    onChange(sections.map((s, i) => (i === index ? section : s)))

  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="slider-editor">
      {sections.length === 0 && (
        <p className="form-hint">
          Aucune section. Un deck sans carrousel s’affiche très bien.
        </p>
      )}

      {sections.map((section, si) => (
        <div className="slider-section" key={si}>
          <div className="slider-section-head">
            <input
              type="text"
              value={section.title}
              placeholder="Titre de la section (ex. Rampe)"
              onChange={(e) => replace(si, { ...section, title: e.target.value })}
            />
            <div className="slider-section-actions">
              <button type="button" className="btn btn-ghost btn-tiny" title="Monter"
                disabled={si === 0} onClick={() => move(si, -1)}>↑</button>
              <button type="button" className="btn btn-ghost btn-tiny" title="Descendre"
                disabled={si === sections.length - 1} onClick={() => move(si, 1)}>↓</button>
              <button type="button" className="btn btn-danger-ghost btn-tiny"
                onClick={() => onChange(sections.filter((_, i) => i !== si))}>
                Supprimer
              </button>
            </div>
          </div>

          {section.cards.map((card, ci) => (
            <div className="slider-card-line" key={ci}>
              <CardPicker
                value={card.name}
                onChange={(name) =>
                  replace(si, {
                    ...section,
                    cards: section.cards.map((c, i) => (i === ci ? { name } : c)),
                  })
                }
              />
              <button
                type="button"
                className="btn btn-ghost btn-tiny"
                title="Retirer la carte"
                onClick={() =>
                  replace(si, {
                    ...section,
                    cards: section.cards.filter((_, i) => i !== ci),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-ghost btn-tiny"
            onClick={() => replace(si, { ...section, cards: [...section.cards, { name: '' }] })}
          >
            + Ajouter une carte
          </button>

          {errors?.[si] && <p className="form-error">{errors[si]}</p>}
        </div>
      ))}

      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => onChange([...sections, { title: '', cards: [{ name: '' }] }])}
      >
        + Ajouter une section
      </button>
    </div>
  )
}
