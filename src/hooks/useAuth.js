import { useEffect } from 'react'
import { createStore } from '../lib/store.js'
import { api } from '../lib/api.js'

/**
 * Session d'administration. `null` signifie « on ne sait pas encore ».
 *
 * Volontairement hors de React : /api/auth/me n'est appelé qu'une fois, et
 * seulement sous /admin — un visiteur de la vitrine ne déclenche aucune
 * requête d'authentification.
 */
const store = createStore(null)
let inFlight = null

/**
 * Ferme la session.
 *
 * L'écran bascule d'abord, la requête part ensuite. Attendre la réponse avant
 * de changer quoi que ce soit faisait payer à l'utilisateur un aller-retour
 * réseau pour un geste dont l'issue ne fait aucun doute — et sur une liaison
 * lente, ce n'est plus dix millisecondes.
 *
 * Exportée à part, sans abonnement au magasin : un composant qui veut
 * seulement pouvoir déconnecter n'a aucune raison de se redessiner à chaque
 * changement d'état de session.
 */
export function signOut() {
  store.set(false)
  return api.logout().catch(() => {
    // Le cookie est httpOnly : sans réponse du serveur on ne peut pas le
    // retirer soi-même. On reste déconnecté côté écran, et la prochaine route
    // protégée tranchera.
  })
}

export function useAuth() {
  const authenticated = store.use()

  useEffect(() => {
    if (store.get() !== null || inFlight) return
    inFlight = api.me()
      .then((r) => store.set(Boolean(r.authenticated)))
      .catch(() => store.set(false))
      .finally(() => { inFlight = null })
  }, [])

  return {
    authenticated,
    signIn: () => store.set(true),
    signOut,
  }
}
