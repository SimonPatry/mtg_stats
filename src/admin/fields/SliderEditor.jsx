import { useState } from 'react'
import CardPicker from './CardPicker.jsx'
import CardPrintingsModal from '../../CardPrintingsModal.jsx'
import { formatComPrint, formatComPrintLabel } from '../../playersMapping.js'

/**
 * Éditeur des carrousels : sections ordonnées, chacune avec des cartes
 * (nom + impression Scryfall optionnelle).
 */
export default function SliderEditor({ sections, onChange, errors }) {
  const [printTarget, setPrintTarget] = useState(null) // { si, ci, name }

  const replace = (index, section) =>
    onChange(sections.map((s, i) => (i === index ? section : s)))

  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function setCard(si, ci, patch) {
    const section = sections[si]
    replace(si, {
      ...section,
      cards: section.cards.map((c, i) => (i === ci ? { ...c, ...patch } : c)),
    })
  }

  function handleSelectPrinting(printing) {
    if (!printTarget) return
    const formatted = formatComPrint(printing)
    setCard(printTarget.si, printTarget.ci, {
      name: printTarget.name || printing.name,
      set_code: formatted.set || '',
      collector_number: formatted.collectorNumber || '',
    })
    setPrintTarget(null)
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

          {section.cards.map((card, ci) => {
            const printLabel = formatComPrintLabel({
              set: card.set_code,
              collectorNumber: card.collector_number,
            })
            return (
              <div className="slider-card-line" key={ci}>
                <div className="slider-card-line__main">
                  <CardPicker
                    value={card.name}
                    onChange={(name) =>
                      setCard(si, ci, {
                        name,
                        // Changer le nom invalide l’ancienne impression.
                        set_code: name === card.name ? (card.set_code || '') : '',
                        collector_number: name === card.name ? (card.collector_number || '') : '',
                      })
                    }
                  />
                  {printLabel ? (
                    <span className="slider-card-print">{printLabel}</span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-tiny"
                    disabled={!card.name?.trim()}
                    onClick={() => setPrintTarget({ si, ci, name: card.name.trim() })}
                  >
                    {printLabel ? 'Changer version' : 'Versions'}
                  </button>
                </div>
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
            )
          })}

          <button
            type="button"
            className="btn btn-ghost btn-tiny"
            onClick={() => replace(si, {
              ...section,
              cards: [...section.cards, { name: '', set_code: '', collector_number: '' }],
            })}
          >
            + Ajouter une carte
          </button>

          {errors?.[si] && <p className="form-error">{errors[si]}</p>}
        </div>
      ))}

      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => onChange([
          ...sections,
          { title: '', cards: [{ name: '', set_code: '', collector_number: '' }] },
        ])}
      >
        + Ajouter une section
      </button>

      {printTarget ? (
        <CardPrintingsModal
          cardName={printTarget.name}
          selectedSet={sections[printTarget.si]?.cards[printTarget.ci]?.set_code || ''}
          selectedCollectorNumber={
            sections[printTarget.si]?.cards[printTarget.ci]?.collector_number || ''
          }
          onSelect={handleSelectPrinting}
          onClose={() => setPrintTarget(null)}
        />
      ) : null}
    </div>
  )
}
