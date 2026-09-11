import { useCardImage } from '../hooks/useCardImage.js'
import { previewHandlers } from './preview-store.js'

/**
 * Une carte du carrousel : résout sa propre illustration (impression choisie
 * si set/collector fournis), et déclenche l'aperçu au survol.
 */
export function CardImage({ name, set = '', collectorNumber = '' }) {
  const { image, status } = useCardImage({ name, set, collectorNumber })
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
