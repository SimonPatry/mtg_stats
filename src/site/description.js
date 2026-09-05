const CARD_REF = /\[([^[\]]+)\]/g

/**
 * Découpe une description en segments : du texte, et des références de carte
 * écrites entre [crochets].
 *
 * Fonction pure, sans DOM ni Preact : c'est elle qui remplace l'ancien
 * renderDescriptionHtml, qui recousait une chaîne HTML à la main et devait
 * donc échapper chaque morceau. Ici il n'y a plus de HTML du tout — JSX
 * échappe le texte par construction.
 */
export function parseDescription(text) {
  const source = text || ''
  const segments = []
  let last = 0
  let match

  CARD_REF.lastIndex = 0
  while ((match = CARD_REF.exec(source)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', value: source.slice(last, match.index) })
    }
    segments.push({ type: 'card', value: match[1].trim() })
    last = CARD_REF.lastIndex
  }

  const tail = source.slice(last)
  if (tail) segments.push({ type: 'text', value: tail })

  return segments
}
