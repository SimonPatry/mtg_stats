import { useCallback, useSyncExternalStore } from 'react'

/**
 * Routeur minimal : deux surfaces, « / » et « /admin ».
 *
 * L'administration gère ses propres vues par un état interne ; il n'y a donc
 * rien à router à l'intérieur. Une trentaine de lignes suffisent, et évitent
 * d'ajouter une bibliothèque pour une seule bifurcation.
 *
 * Le chemin est lu par `useSyncExternalStore` et non gardé dans un `useState`
 * par composant. La nuance est décisive : avec un état local, chaque appel de
 * `useLocation` avait sa propre copie, si bien qu'un lien mettait à jour la
 * sienne pendant que la racine de l'application gardait l'ancienne — l'URL
 * changeait, l'écran non. Ici tout le monde lit la même source, `location`.
 */
const LOCATION_CHANGED = 'app:locationchange'

function subscribe(onChange) {
  // `popstate` couvre les boutons Précédent/Suivant du navigateur ;
  // l'évènement maison couvre nos propres `pushState`, qui n'en émettent pas.
  window.addEventListener('popstate', onChange)
  window.addEventListener(LOCATION_CHANGED, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(LOCATION_CHANGED, onChange)
  }
}

const getPathname = () => window.location.pathname

export function useLocation() {
  // Troisième argument : la valeur servie en rendu serveur, où `window`
  // n'existe pas. Le site n'en fait pas, mais l'oublier casse le jour où.
  const pathname = useSyncExternalStore(subscribe, getPathname, () => '/')

  const navigate = useCallback((to) => {
    if (to === window.location.pathname) return
    window.history.pushState({}, '', to)
    window.dispatchEvent(new Event(LOCATION_CHANGED))
    window.scrollTo(0, 0)
  }, [])

  return [pathname, navigate]
}
