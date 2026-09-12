import { useEffect, useState } from 'react'
import { peekCard, resolveCard } from '../lib/scryfall.js'

/**
 * Résout l'illustration d'une carte. Rend { image, uri, status }.
 *
 * Si `imageUrl` est fourni (URL déjà en base), aucun appel Scryfall.
 * Sinon cache local, puis API.
 */
export function useCardImage({
  name,
  set = '',
  collectorNumber = '',
  imageUrl = '',
}) {
  const stored = String(imageUrl || '').trim()

  const [state, setState] = useState(() => {
    if (stored) {
      return { image: stored, uri: null, status: 'ready' }
    }
    const cached = peekCard(name, set, collectorNumber)
    if (cached?.image) {
      return { image: cached.image, uri: cached.uri, status: 'ready' }
    }
    return { image: null, uri: null, status: name ? 'loading' : 'missing' }
  })

  useEffect(() => {
    let cancelled = false
    if (!name) {
      setState({ image: null, uri: null, status: 'missing' })
      return undefined
    }

    if (stored) {
      setState({ image: stored, uri: null, status: 'ready' })
      return undefined
    }

    const cached = peekCard(name, set, collectorNumber)
    if (cached?.image) {
      setState({ image: cached.image, uri: cached.uri, status: 'ready' })
      return undefined
    }

    setState({ image: null, uri: null, status: 'loading' })
    resolveCard({ name, set, collectorNumber })
      .then((card) => {
        if (cancelled) return
        setState(
          card?.image
            ? { image: card.image, uri: card.uri, status: 'ready' }
            : { image: null, uri: null, status: 'missing' },
        )
      })
      .catch(() => {
        if (!cancelled) setState({ image: null, uri: null, status: 'missing' })
      })

    return () => {
      cancelled = true
    }
  }, [name, set, collectorNumber, stored])

  return state
}
