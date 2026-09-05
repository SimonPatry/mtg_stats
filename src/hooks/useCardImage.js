import { useEffect, useState } from 'react'
import { resolveCard } from '../lib/scryfall.js'

/**
 * Résout l'illustration d'une carte. Rend { image, uri, status } où status
 * vaut 'loading' | 'ready' | 'missing'.
 *
 * Chaque carte résout la sienne : la file d'attente de lib/scryfall.js se
 * charge d'espacer les appels, et le cache évite de les refaire.
 */
export function useCardImage({ name, set = '', collectorNumber = '' }) {
  const [state, setState] = useState({ image: null, uri: null, status: 'loading' })

  useEffect(() => {
    let cancelled = false
    if (!name) {
      setState({ image: null, uri: null, status: 'missing' })
      return undefined
    }

    setState({ image: null, uri: null, status: 'loading' })
    resolveCard({ name, set, collectorNumber })
      .then((card) => {
        if (cancelled) return
        setState(
          card?.image
            ? { image: card.image, uri: card.uri, status: 'ready' }
            : { image: null, uri: null, status: 'missing' }
        )
      })
      .catch(() => {
        if (!cancelled) setState({ image: null, uri: null, status: 'missing' })
      })

    return () => { cancelled = true }
  }, [name, set, collectorNumber])

  return state
}
