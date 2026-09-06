/**
 * L'ordre WUBRG est une règle du jeu, pas une configuration : on l'écrit ici
 * plutôt que d'importer `shared/schemas.js`, qui tirerait tout Zod dans le
 * paquet du navigateur pour cinq lettres. La liste réellement affichée vient
 * du référentiel servi par l'API.
 */
const COLOR_CODES = ['W', 'U', 'B', 'R', 'G']

const LABELS = { W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert' }

/** Ordre canonique WUBRG, quel que soit l'ordre des clics. */
export const sortColors = (codes) =>
  [...new Set(codes.filter((c) => COLOR_CODES.includes(c)))]
    .sort((a, b) => COLOR_CODES.indexOf(a) - COLOR_CODES.indexOf(b))

/** Les couleurs viennent du référentiel : liste figée, jamais de saisie libre. */
export default function ColorPicker({ value, onChange, colors }) {
  const available = colors?.length ? colors.map((c) => c.code) : COLOR_CODES

  function toggle(code) {
    const next = value.includes(code)
      ? value.filter((c) => c !== code)
      : [...value, code]
    onChange(sortColors(next))
  }

  return (
    <div className="chip-row">
      {available.map((code) => (
        <button
          key={code}
          type="button"
          className={`chip${value.includes(code) ? ' is-on' : ''}`}
          aria-pressed={value.includes(code)}
          onClick={() => toggle(code)}
        >
          {code} · {LABELS[code] ?? code}
        </button>
      ))}
    </div>
  )
}
