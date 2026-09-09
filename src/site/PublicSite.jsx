import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useDecks } from '../hooks/useDecks.js'
import { useAuth } from '../hooks/useAuth.js'
import { useSiteMenu } from '../hooks/useSiteMenu.js'
import {
  ROUTES,
  memberViewFromPath,
  pathForMemberView,
} from '../lib/routes.js'
import { SiteHeader } from './SiteHeader.jsx'
import { DeckMenu } from './DeckMenu.jsx'
import { DeckBand } from './DeckBand.jsx'
import { collectTagLabels, matchesSelectedTags } from '../components/TagFilter.jsx'
import { deckAnchorId, scrollToDeckAnchorWhenReady } from './deckAnchors.js'

const StatsApp = lazy(() => import('../admin/StatsApp.jsx'))

const formatDate = (date) =>
  date ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''

/**
 * Vitrine Forge + espace membre.
 * Routes : / (vitrine), /stats, /decks. Header = navigation URL ; menu = filtres.
 */
export function PublicSite() {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const { decks, loading, error, stale, savedAt, reload } = useDecks()
  const { isMember, authenticated } = useAuth()
  const { menuOpen, toggleMenu, closeMenu } = useSiteMenu()
  const [selectedTags, setSelectedTags] = useState([])

  const memberView = memberViewFromPath(pathname)
  const showMember = Boolean(isMember && memberView)
  const onVitrine = pathname === ROUTES.vitrine
  const allDecks = decks ?? []
  const tagOptions = useMemo(() => collectTagLabels(allDecks), [allDecks])
  const visibleDecks = useMemo(() => {
    if (!selectedTags.length) return allDecks
    return allDecks.filter((d) => matchesSelectedTags(d.tags, selectedTags))
  }, [allDecks, selectedTags])

  const onMemberViewChange = useCallback((view) => {
    const next = pathForMemberView(view)
    if (next !== pathname) navigate(next)
  }, [navigate, pathname])

  const onBackToForge = useCallback(() => {
    reload()
    navigate(ROUTES.vitrine)
  }, [navigate, reload])

  useLayoutEffect(() => {
    if (!showMember) return undefined
    document.body.classList.add('admin-theme')
    return () => document.body.classList.remove('admin-theme')
  }, [showMember])

  useEffect(() => {
    if (showMember) closeMenu()
  }, [showMember])

  // Ancres #deck-… : react-router ne scroll pas tout seul.
  useEffect(() => {
    if (!onVitrine || showMember || loading || !hash) return undefined
    const raw = hash.replace(/^#/, '')
    if (!raw.startsWith('deck-')) return undefined
    const deckId = raw.slice('deck-'.length)
    if (!deckId) return undefined
    return scrollToDeckAnchorWhenReady(deckId)
  }, [onVitrine, showMember, loading, hash, visibleDecks])

  // Ceinture : RequireAuth protège déjà /stats et /decks ; si la session tombe
  // pendant la visite, on renvoie à la vitrine.
  if (memberView && authenticated === false) {
    return <Navigate to={ROUTES.vitrine} replace />
  }

  function openDeck(deckId) {
    closeMenu()
    const id = deckAnchorId(deckId)
    // Si un filtre tags masque la cible, on l’enlève pour que la bande existe.
    if (selectedTags.length) setSelectedTags([])
    navigate({ pathname: ROUTES.vitrine, hash: id }, { preventScrollReset: true })
    // Scroll immédiat si la bande est déjà là (même page).
    scrollToDeckAnchorWhenReady(deckId)
  }

  return (
    <>
      <SiteHeader
        menuOpen={menuOpen}
        onToggleMenu={toggleMenu}
        showMenuToggle={!showMember}
      />
      {!showMember && (
        <DeckMenu
          decks={allDecks}
          open={menuOpen}
          onClose={closeMenu}
          onOpenDeck={openDeck}
          selectedTags={selectedTags}
          onSelectedTags={setSelectedTags}
          tagOptions={tagOptions}
        />
      )}
      <div className="site-main">
        {showMember ? (
          <Suspense fallback={<p className="member-shell__loading">Ouverture de l’espace membre…</p>}>
            <div className="member-shell">
              <StatsApp
                mode="member"
                embedded
                initialView={memberView}
                onMemberViewChange={onMemberViewChange}
                onBackToForge={onBackToForge}
              />
            </div>
          </Suspense>
        ) : (
          <>
            {stale && (
              <p className="site-notice">
                L'administration est injoignable — decks affichés depuis la dernière
                copie locale{savedAt ? ` du ${formatDate(savedAt)}` : ''}.
              </p>
            )}

            <main id="decks" className="decks" aria-live="polite">
              {loading && <p className="decks__loading">Invocation des decks…</p>}

              {error && (
                <p className="decks__empty">
                  Impossible de charger le grimoire des decks ({error.message}), et
                  aucune copie locale n'est disponible.
                </p>
              )}

              {!loading && !error && allDecks.length === 0 && (
                <p className="decks__empty">Aucun deck n'est encore prêt. Ajoute-en un depuis Mes decks.</p>
              )}

              {!loading && !error && allDecks.length > 0 && visibleDecks.length === 0 && (
                <p className="decks__empty">Aucun deck ne correspond à ces tags.</p>
              )}

              {visibleDecks.map((deck, index) => (
                <DeckBand key={deck.id} deck={deck} index={index} />
              ))}
            </main>

            <footer className="site-footer">
              <p>
                Images et données de cartes via{' '}
                <a href="https://scryfall.com" target="_blank" rel="noopener">Scryfall</a>.
                {' '}Magic: The Gathering est une marque de Wizards of the Coast.
              </p>
            </footer>
          </>
        )}
      </div>
    </>
  )
}
