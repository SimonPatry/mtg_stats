import { useEffect, useRef } from 'react'
import { Link } from '../components/Link.jsx'
import { useLocation } from '../lib/router.js'
import { useAuth } from '../hooks/useAuth.js'

/**
 * En-tête collant. Il publie sa hauteur dans --header-height, dont se sert le
 * scroll-margin-top des bandes pour qu'une ancre ne passe pas dessous.
 *
 * L'ancienne version recalculait ça sur l'évènement resize de la fenêtre ;
 * un ResizeObserver suit aussi les changements de hauteur qui ne viennent
 * pas d'un redimensionnement (retour à la ligne du titre, polices chargées
 * après coup).
 */
export function SiteHeader({ menuOpen, onToggleMenu }) {
  const header = useRef(null)
  const [pathname] = useLocation()
  const { isAdmin } = useAuth()
  const onAdmin = pathname.startsWith('/admin')

  useEffect(() => {
    const el = header.current
    if (!el) return undefined
    const publish = () =>
      document.documentElement.style.setProperty('--header-height', `${el.offsetHeight}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <header className="site-header" ref={header}>
      <button
        type="button"
        className="site-header__menu-toggle"
        aria-expanded={menuOpen ? 'true' : 'false'}
        aria-controls="deck-menu"
        aria-label={menuOpen ? 'Fermer la liste des decks' : 'Ouvrir la liste des decks'}
        onClick={onToggleMenu}
      >
        <span className="site-header__menu-icon" />
      </button>
      <div className="site-header__inner">
        <p className="site-header__eyebrow">Grimoire de decks</p>
        <h1 className="site-header__title">Forge Arcanique</h1>
      </div>

      {/* Clé admin ↔ vitrine : réservée aux comptes admin connectés. */}
      {isAdmin ? (
        <Link
          to={onAdmin ? '/' : '/admin'}
          className={`site-header__admin${onAdmin ? ' is-active' : ''}`}
          title={onAdmin ? 'Retour à la vitrine' : 'Administration'}
          aria-label={onAdmin ? 'Retour à la vitrine' : 'Administration'}
          aria-current={onAdmin ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="8.5" cy="8.5" r="4.25" />
            <path d="M11.6 11.6 L19.5 19.5" />
            <path d="M17 17 L15 19" />
            <path d="M19.5 19.5 L17.5 21.5" />
          </svg>
        </Link>
      ) : null}
    </header>
  )
}
