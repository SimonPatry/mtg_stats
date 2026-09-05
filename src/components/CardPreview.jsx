import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePreview, hidePreview } from './preview-store.js'

const MARGIN = 12

/**
 * Aperçu agrandi de la carte survolée. Monté une seule fois à la racine.
 *
 * Positionné en coordonnées viewport : on le centre sur la carte survolée,
 * puis on le ramène à l'intérieur de l'écran s'il déborde (carte tout en
 * haut, tout au bord…).
 */
export function CardPreview() {
  const el = useRef(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const current = usePreview()

  useLayoutEffect(() => {
    if (!current || !el.current) return
    const anchor = current.anchor.getBoundingClientRect()
    const { offsetWidth: w, offsetHeight: h } = el.current

    const clamp = (value, max) => Math.max(MARGIN, Math.min(value, max - MARGIN))
    setPosition({
      left: clamp(anchor.left + anchor.width / 2 - w / 2, window.innerWidth - w),
      top: clamp(anchor.top + anchor.height / 2 - h / 2, window.innerHeight - h),
    })
  }, [current])

  // L'aperçu est positionné en coordonnées viewport : il devient faux dès que
  // la page défile ou change de taille. On le ferme plutôt que de le suivre.
  useEffect(() => {
    if (!current) return undefined
    window.addEventListener('scroll', hidePreview, { passive: true })
    window.addEventListener('resize', hidePreview)
    return () => {
      window.removeEventListener('scroll', hidePreview)
      window.removeEventListener('resize', hidePreview)
    }
  }, [current])

  if (!current) return null

  const { card } = current
  return (
    <div
      ref={el}
      className="deck-card-preview is-visible"
      aria-hidden="true"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
    >
      {card.image
        ? <img src={card.image} alt={card.name} />
        : <p className="deck-card-preview__missing">{card.name}</p>}
    </div>
  )
}
