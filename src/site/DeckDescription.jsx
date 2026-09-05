import { parseDescription } from './description.js'
import { useCardImage } from '../hooks/useCardImage.js'
import { previewHandlers } from '../components/preview-store.js'

/** Un nom de carte cité dans la description : survolable, comme dans le carrousel. */
function CardRef({ name }) {
  const { image } = useCardImage({ name })
  return (
    <span className="deck-banner__card-ref" tabIndex={0} {...previewHandlers({ name, image })}>
      {name}
    </span>
  )
}

export function DeckDescription({ text }) {
  const segments = parseDescription(text)
  if (segments.length === 0) return null

  return (
    <p className="deck-banner__description">
      {segments.map((segment, i) =>
        segment.type === 'card'
          ? <CardRef key={`c${i}`} name={segment.value} />
          : segment.value
      )}
    </p>
  )
}
