import { lazy, Suspense, useLayoutEffect, useMemo, useState } from 'react'
import { useDecks } from '../hooks/useDecks.js'
import { useAuth } from '../hooks/useAuth.js'
import { useSiteMenu } from '../hooks/useSiteMenu.js'
import { SiteHeader } from './SiteHeader.jsx'
import { DeckMenu } from './DeckMenu.jsx'
import { DeckBand } from './DeckBand.jsx'
import TagFilter, { collectTagLabels, matchesSelectedTags } from '../components/TagFilter.jsx'
import { consumeOpenMemberIntent } from './memberHandoff.js'

const StatsApp = lazy(() => import('../admin/StatsApp.jsx'))

const formatDate = (date) =>
  date ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''

/**
 * Vitrine Forge : liste des decks + espace membre (stats / parties) après login.
 * Header + menu gauche restent partagés : stats s’ouvre dans le même cadre.
 * Menu = colonne dans la page (pas un overlay) : fermé = 100 %, ouvert ≈ 15 / 85.
 */
export function PublicSite() {
  const { decks, loading, error, stale, savedAt, reload } = useDecks()
  const { isMember } = useAuth()
  const { menuOpen, toggleMenu, closeMenu } = useSiteMenu()
  const [memberOpen, setMemberOpen] = useState(false)
  const [memberView, setMemberView] = useState('dashboard')
  const [selectedTags, setSelectedTags] = useState([])

  const showMember = memberOpen && isMember
  const allDecks = decks ?? []
  const tagOptions = useMemo(() => collectTagLabels(allDecks), [allDecks])
  const visibleDecks = useMemo(() => {
    if (!selectedTags.length) return allDecks
    return allDecks.filter((d) => matchesSelectedTags(d.tags, selectedTags))
  }, [allDecks, selectedTags])

  useLayoutEffect(() => {
    if (!showMember) return undefined
    document.body.classList.add('admin-theme')
    return () => document.body.classList.remove('admin-theme')
  }, [showMember])

  useLayoutEffect(() => {
    if (!isMember) {
      setMemberOpen(false)
      return
    }
    const intent = consumeOpenMemberIntent()
    if (intent) {
      setMemberView(intent)
      setMemberOpen(true)
    }
  }, [isMember])

  function openMember(view = 'dashboard') {
    setMemberView(view === 'myDecks' ? 'myDecks' : 'dashboard')
    setMemberOpen(true)
  }

  function backToVitrine() {
    setMemberOpen(false)
    reload()
  }

  function openDeck(deckId) {
    closeMenu()
    if (showMember) {
      setMemberOpen(false)
      requestAnimationFrame(() => {
        window.location.hash = `deck-${deckId}`
      })
      return
    }
    window.location.hash = `deck-${deckId}`
  }

  return (
    <>
      <SiteHeader menuOpen={menuOpen} onToggleMenu={toggleMenu} />
      <div className={`site-shell${menuOpen ? ' is-menu-open' : ''}`}>
        <DeckMenu
          decks={allDecks}
          open={menuOpen}
          onClose={closeMenu}
          memberActive={showMember}
          memberView={memberView}
          onOpenMember={openMember}
          onBackToVitrine={backToVitrine}
          onOpenDeck={openDeck}
          selectedTags={selectedTags}
          onSelectedTags={setSelectedTags}
          tagOptions={tagOptions}
        />
        <div
          className="site-main"
          onClick={menuOpen ? closeMenu : undefined}
        >
          {showMember ? (
            <Suspense fallback={<p className="member-shell__loading">Ouverture de l’espace membre…</p>}>
              <div className="member-shell">
                <StatsApp
                  mode="member"
                  embedded
                  initialView={memberView}
                  onMemberViewChange={setMemberView}
                  onBackToForge={backToVitrine}
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

              {tagOptions.length > 0 && (
                <div className="showcase-filters" onClick={(e) => e.stopPropagation()}>
                  <TagFilter
                    tags={tagOptions}
                    value={selectedTags}
                    onChange={setSelectedTags}
                  />
                  {selectedTags.length > 0 && (
                    <p className="showcase-filters__count">
                      {visibleDecks.length}/{allDecks.length} deck{visibleDecks.length === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
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
      </div>
    </>
  )
}
