import { lazy, Suspense } from 'react'
import { useLocation } from './lib/router.js'
import { PublicSite } from './site/PublicSite.jsx'
import { CardPreview } from './components/CardPreview.jsx'

/**
 * Deux surfaces, une seule application.
 *
 * L'administration est chargée à la demande : un visiteur de la vitrine ne
 * télécharge ni le tableau de bord, ni les formulaires de saisie, ni la
 * bibliothèque d'export Excel — soit l'essentiel du poids du bundle.
 */
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

export default function App() {
  const [pathname] = useLocation()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <>
      {isAdmin ? (
        <Suspense fallback={<p className="loading">Chargement de l’administration…</p>}>
          <AdminApp />
        </Suspense>
      ) : (
        <PublicSite />
      )}
      {/* Monté une seule fois pour toute l'application : l'aperçu de carte au
          survol est unique, quel que soit le deck ou la carte. */}
      <CardPreview />
    </>
  )
}
