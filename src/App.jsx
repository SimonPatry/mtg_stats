import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.js'
import { PublicSite } from './site/PublicSite.jsx'
import { CardPreview } from './components/CardPreview.jsx'
import { ROUTES } from './lib/routes.js'

/**
 * Surfaces : vitrine (/) publique ; /stats et /decks réservés aux comptes
 * connectés ; /admin réservé aux admins (contrôle dans AdminApp).
 */
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

function RequireAuth({ children }) {
  const { authenticated } = useAuth()
  if (authenticated === null) {
    return <p className="member-shell__loading">Vérification de la session…</p>
  }
  if (!authenticated) {
    return <Navigate to={ROUTES.vitrine} replace />
  }
  return children
}

export default function App() {
  return (
    <>
      <Routes>
        <Route
          path={ROUTES.admin}
          element={(
            <Suspense fallback={<p className="loading">Chargement de l’administration…</p>}>
              <AdminApp />
            </Suspense>
          )}
        />
        <Route path={ROUTES.vitrine} element={<PublicSite />} />
        <Route
          path={ROUTES.stats}
          element={(
            <RequireAuth>
              <PublicSite />
            </RequireAuth>
          )}
        />
        <Route
          path={ROUTES.decks}
          element={(
            <RequireAuth>
              <PublicSite />
            </RequireAuth>
          )}
        />
        <Route path="*" element={<Navigate to={ROUTES.vitrine} replace />} />
      </Routes>
      {/* Monté une seule fois pour toute l'application : l'aperçu de carte au
          survol est unique, quel que soit le deck ou la carte. */}
      <CardPreview />
    </>
  )
}
