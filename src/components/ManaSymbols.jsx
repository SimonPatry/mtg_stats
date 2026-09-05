import { manaSymbolUrl } from '../lib/scryfall.js'

const LABELS = { W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert' }
const WUBRG = ['W', 'U', 'B', 'R', 'G']

/** Identité de couleur d'un deck, dans l'ordre canonique WUBRG. */
export function ManaSymbols({ colors }) {
  const ordered = WUBRG.filter((letter) => colors?.includes(letter))
  if (ordered.length === 0) return null

  return (
    <span className="deck-banner__colors">
      {ordered.map((letter) => (
        <img
          key={letter}
          className="deck-banner__color-icon"
          src={manaSymbolUrl(letter)}
          alt={LABELS[letter] ?? letter}
          loading="lazy"
          width="20"
          height="20"
        />
      ))}
    </span>
  )
}
