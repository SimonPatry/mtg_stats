import { useLocation } from '../lib/router.js'

/**
 * Lien interne : navigation sans rechargement, mais clic milieu, Ctrl+clic et
 * « ouvrir dans un nouvel onglet » continuent de fonctionner normalement.
 *
 * Dans un .jsx et non dans lib/router.js, qui reste du code pur sans balisage.
 */
export function Link({ to, children, onClick, ...rest }) {
  const [, navigate] = useLocation()
  return (
    <a
      href={to}
      {...rest}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
