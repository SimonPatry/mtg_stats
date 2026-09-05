import { useCardImage } from '../hooks/useCardImage.js'
import { previewHandlers } from './preview-store.js'

/**
 * Une carte du carrousel : résout sa propre illustration, et déclenche
 * l'aperçu au survol. Tant que l'image n'est pas là, la vignette garde sa
 * place — la page ne saute pas quand les images arrivent.
 */
export function CardImage({ name }) {
  const { image, status } = useCardImage({ name })
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
