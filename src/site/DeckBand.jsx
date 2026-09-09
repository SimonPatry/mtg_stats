import { useCardImage } from '../hooks/useCardImage.js'
import { manaSymbolUrl } from '../lib/scryfall.js'
import { ManaSymbols } from '../components/ManaSymbols.jsx'
import { DeckDescription } from './DeckDescription.jsx'
import { DeckCarousel } from './DeckCarousel.jsx'

// La couleur de la bande et le côté de l'illustration suivent la POSITION du
// deck, pas ses couleurs : les bandes s'enchaînent blanc → bleu → noir →
// rouge → vert puis rebouclent. Le filigrane de mana suit cette même rotation.
const BAND_COLORS = ['w', 'u', 'b', 'r', 'g']
const bandColor = (i) => BAND_COLORS[i % BAND_COLORS.length]
const isReversed = (i) => i % 2 === 1

function ArchidektLink({ link }) {
  if (!link) return null
  return (
    <a className="deck-banner__archidekt-btn" href={link} target="_blank" rel="noopener">
      <img className="deck-banner__archidekt-logo" src="/archidekt-icon.png" alt="" loading="lazy" />
      <span className="deck-banner__archidekt-label">Archidekt</span>
    </a>
  )
}

function CommanderArt({ deck }) {
  const { image, uri } = useCardImage({
    name: deck.commander,
    set: deck.set_code,
    collectorNumber: deck.collector_number,
  })

  // Tant que Scryfall n'a pas répondu, un cadre vide occupe exactement la place
  // de l'illustration. Sans lui la bande s'afficherait écrasée puis sauterait à
  // sa hauteur définitive — le prix à payer pour ne plus attendre les images
  // avant de dessiner la page.
  const img = image ? (
    <img
      className="deck-banner__image"
      src={image}
      alt={`Illustration du commandant — ${deck.name}`}
      loading="lazy"
    />
  ) : (
    <div className="deck-banner__image deck-banner__image--pending" aria-hidden="true" />
  )

  return (
    <div className="deck-banner__media">
      {uri ? (
        <a
          className="deck-banner__media-link"
          href={uri}
          target="_blank"
          rel="noopener"
          aria-label={`Voir « ${deck.commander || deck.name} » sur Scryfall`}
        >
          {img}
        </a>
      ) : img}
    </div>
  )
}

export function DeckBand({ deck, index }) {
  const sections = (deck.slider || []).filter((s) => s.cards?.length > 0)
  const color = bandColor(index)
  const manaLetter = color.toUpperCase()

  return (
    <section className={`deck-band deck-band--${color}`} id={`deck-${deck.id}`}>
      <img
        className="deck-band__watermark"
        src={manaSymbolUrl(manaLetter)}
        alt=""
        aria-hidden="true"
        loading="lazy"
      />
      <div className="deck-band__inner">
        <article
          className={`deck-banner ${isReversed(index) ? 'deck-banner--reverse' : ''}`}
          style={{ animationDelay: `${Math.min((index % 6) * 0.08, 0.4)}s` }}
        >
          <CommanderArt deck={deck} />

          <div className="deck-banner__content">
            <div className="deck-banner__meta">
              <ManaSymbols colors={deck.colors} />
              {deck.colors?.length > 0 && (
                <span className="deck-banner__meta-separator" aria-hidden="true">—</span>
              )}
              <h2 className="deck-banner__title">{deck.name}</h2>
              <ArchidektLink link={deck.link} />
            </div>

            {deck.author ? (
              <p className="deck-banner__author">par {deck.author}</p>
            ) : null}

            {deck.tags?.length > 0 && (
              <>
                <hr className="deck-banner__tags-separator" />
                <ul className="deck-banner__tags">
                  {deck.tags.map((tag) => (
                    <li className="deck-banner__tag" key={tag}>{tag}</li>
                  ))}
                </ul>
              </>
            )}

            <DeckDescription text={deck.description} />

            {sections.length > 0 && <DeckCarousel sections={sections} />}
          </div>
        </article>
      </div>
    </section>
  )
}
