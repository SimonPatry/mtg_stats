import { useRef, useState } from 'react'
import { CardImage } from '../components/CardImage.jsx'
import { hidePreview } from '../components/preview-store.js'

/**
 * Carrousel de sections : une section = une diapositive.
 *
 * Le défilement est natif (scroll-snap CSS). Les illustrations sont
 * résolues via lib/scryfall (coalescence /collection sur le même tick).
 */
export function DeckCarousel({ sections }) {
  const track = useRef(null)
  const [index, setIndex] = useState(0)
  const total = sections.length

  function goTo(target) {
    const el = track.current
    if (!el) return
    const next = (target + total) % total
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  function handleScroll(event) {
    const el = event.currentTarget
    const current = Math.round(el.scrollLeft / el.clientWidth)
    if (current !== index) setIndex(current)
    hidePreview()
  }

  return (
    <div className="deck-slider">
      <div className="deck-slider__viewport">
        <button
          type="button"
          className="deck-slider__nav deck-slider__nav--prev"
          aria-label="Section précédente"
          disabled={total <= 1}
          onClick={() => goTo(index - 1)}
        >
          &#8249;
        </button>

        <div className="deck-slider__track" ref={track} onScroll={handleScroll}>
          {sections.map((section, i) => (
            <div className="deck-slider__slide" key={section.title || i}>
              {section.title && <h3 className="deck-slider__title">{section.title}</h3>}
              <ul className="deck-slider__cards">
                {section.cards.map((card, i) => (
                  <CardImage
                    key={`${card.name}|${card.set_code || ''}|${card.collector_number || ''}|${i}`}
                    name={card.name}
                    set={card.set_code || ''}
                    collectorNumber={card.collector_number || ''}
                    imageUrl={card.image_url || ''}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="deck-slider__nav deck-slider__nav--next"
          aria-label="Section suivante"
          disabled={total <= 1}
          onClick={() => goTo(index + 1)}
        >
          &#8250;
        </button>
      </div>

      {total > 1 && (
        <div className="deck-slider__dots">
          {sections.map((section, i) => (
            <button
              key={section.title || i}
              type="button"
              className={`deck-slider__dot ${i === index ? 'is-active' : ''}`}
              aria-label={section.title || `Section ${i + 1}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
