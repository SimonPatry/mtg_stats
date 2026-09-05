import { useLayoutEffect } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { Login } from './Login.jsx'
import StatsApp from './StatsApp.jsx'

import '../index.css'

/**
 * Point d'entrée de l'administration, chargé à la demande depuis App.jsx.
 *
 * La page de statistiques n'est pas publique : sans session valide, on
 * n'affiche que le formulaire de connexion — et surtout, l'API refuse de
 * répondre, ce qui est la seule protection qui compte.
 */
export default function AdminApp() {
  const { authenticated, signIn } = useAuth()

  /**
   * La feuille de l'administration part avec ce paquet chargé à la demande, et
   * une fois injectée elle ne repart plus. C'est cette classe qui délimite sa
   * portée : posée ici, retirée en quittant l'administration, elle rend à la
   * vitrine sa palette, sa police et son défilement.
   *
   * useLayoutEffect et non useEffect : la classe doit être là avant le premier
   * affichage, sinon l'écran clignote sur le thème de la vitrine.
   */
  useLayoutEffect(() => {
    document.body.classList.add('admin-theme')
    return () => document.body.classList.remove('admin-theme')
  }, [])

  if (authenticated === null) return <p className="loading">Ouverture du grimoire…</p>
  if (!authenticated) return <Login onSuccess={signIn} />

  return <StatsApp />
}
