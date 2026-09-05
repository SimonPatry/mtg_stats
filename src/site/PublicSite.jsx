import { useState } from 'react'
import { useDecks } from '../hooks/useDecks.js'
import { SiteHeader } from './SiteHeader.jsx'
import { DeckMenu } from './DeckMenu.jsx'
import { DeckBand } from './DeckBand.jsx'

const formatDate = (date) =>
  date ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''

export function PublicSite() {
  const { decks, loading, error, stale, savedAt } = useDecks()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <SiteHeader menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} />
      <DeckMenu decks={decks ?? []} open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* L'API est injoignable mais on a une copie locale : la vitrine reste
          lisible, en annonçant honnêtement qu'elle n'est plus fraîche. */}
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

        {!loading && !error && decks.length === 0 && (
          <p className="decks__empty">Aucun deck n'est encore prêt. Ajoutez-en un depuis l'administration.</p>
        )}

        {decks?.map((deck, index) => (
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
  )
}
