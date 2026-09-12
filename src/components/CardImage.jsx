import { useCardImage } from '../hooks/useCardImage.js'
import { previewHandlers } from './preview-store.js'

/**
 * Une carte du carrousel : utilise `image_url` en base si présent, sinon
 * résout via Scryfall (cache / collection).
 */
export function CardImage({
  name,
  set = '',
  collectorNumber = '',
  imageUrl = '',
}) {
  const { image, status } = useCardImage({
    name,
    set,
    collectorNumber,
    imageUrl,
  })
  const card = { name, image }

  return (
    <li
      className={`deck-slider__card ${image ? '' : 'deck-slider__card--missing'}`}
      {...previewHandlers(card)}
    >
      {image
        ? <img src={image} alt={name} loading="lazy" />
        : status === 'loading' ? null : name}
    </li>
  )
}
