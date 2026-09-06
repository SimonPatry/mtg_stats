import { useEffect, useState } from 'react'
import { loadShowcase } from '../lib/api.js'

/**
 * Charge la liste des decks une fois, et l'expose telle quelle.
 *
 * Volontairement, ce hook n'attend PAS la résolution des illustrations :
 * les bandes s'affichent dès la réponse de l'API, chaque carte va chercher
 * son image de son côté (voir useCardImage). L'ancienne version attendait
 * que tout soit résolu — plusieurs secondes d'écran vide — avant de dessiner
 * quoi que ce soit.
 */
export function useDecks() {
  const [state, setState] = useState({ decks: null, stale: false, savedAt: null, error: null })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, decks: prev.decks, error: null }))
    loadShowcase()
      .then((result) => { if (!cancelled) setState({ ...result, error: null }) })
      .catch((error) => { if (!cancelled) setState({ decks: [], stale: false, savedAt: null, error }) })
    return () => { cancelled = true }
  }, [reloadToken])

  return {
    ...state,
    loading: state.decks === null,
    reload: () => setReloadToken((n) => n + 1),
  }
}
