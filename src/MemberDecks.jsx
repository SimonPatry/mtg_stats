import { useEffect, useState } from 'react'
import DeckEditModal from './DeckEditModal'
import PlayersAddDesktopForms from './PlayersAddDesktopForms'
import PlayersAddModal from './PlayersAddModal'
import { loadDecks, saveDecks } from './decksApi'
import { loadUsers } from './usersApi'
import { api } from './lib/api.js'
import {
  addDeckToUser,
  asCommanderList,
  editDeckPowerLevel,
  formatCommanders,
  getDeckById,
  getDecksForUser,
} from './playersMapping'
import { emptyShowcase } from './admin/fields/ShowcaseFields.jsx'
import { fetchCommanderImage } from './scryfall'
import { useAuth } from './hooks/useAuth.js'

function unpackBracket(value) {
  if (!value) return { bracket: null, bracketVariation: null }
  const [raw, variation] = String(value).split('-')
  const bracket = Number(raw)
  if (Number.isNaN(bracket)) return { bracket: null, bracketVariation: null }
  return {
    bracket,
    bracketVariation: variation === 'low' || variation === 'high' ? variation : null,
  }
}

function formatBracketLine(bracket, bracketVariation) {
  if (bracket == null) return '—'
  const base = `B${bracket}`
  if (bracketVariation === 'low' || bracketVariation === 'high') {
    return `${base} - ${bracketVariation}`
  }
  return base
}

function usePlayersMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setMobile(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return mobile
}

function useDeckImages(deck) {
  const commanders = asCommanderList(deck.com)
  const [images, setImages] = useState(() =>
    commanders.map((name) => deck.comPrint?.[name]?.imageUrl || null),
  )

  useEffect(() => {
    let cancelled = false
    Promise.all(
      commanders.map(async (name) => {
        const stored = deck.comPrint?.[name]?.imageUrl
        if (stored) return stored
        try {
          return await fetchCommanderImage(name, 'small')
        } catch {
          return null
        }
      }),
    ).then((urls) => {
      if (!cancelled) setImages(urls)
    })
    return () => { cancelled = true }
  }, [deck.id, deck.com, deck.comPrint])

  return { commanders, images, isPartner: commanders.length > 1 }
}

function DeckTile({ deck, onZoom, onEdit }) {
  const { commanders, images, isPartner } = useDeckImages(deck)
  const label = formatCommanders(deck.com)
  const bracketLine = formatBracketLine(deck.bracket, deck.bracketVariation)

  return (
    <article className="roster-deck-tile" title={label}>
      <div className="roster-deck-card">
        <div
          className={`roster-deck-art${isPartner ? ' partner' : ''}${onZoom ? ' zoomable' : ''}`}
          onClick={(e) => {
            if (!onZoom) return
            e.stopPropagation()
            onZoom(commanders, e.currentTarget.getBoundingClientRect())
          }}
          title={label}
        >
          {commanders.map((name, i) => {
            const src = images[i]
            if (!src) {
              return <div key={name} className="commander-art loading roster-deck-art-img" title={name} />
            }
            return (
              <img
                key={name}
                className="commander-art roster-deck-art-img"
                src={src}
                alt={name}
                draggable={false}
              />
            )
          })}
        </div>
        <div className="roster-deck-body">
          <div className="roster-deck-title-row">
            <p className="roster-deck-name">{deck.name?.trim() || label}</p>
            {deck.deckUrl ? (
              <a
                className="roster-deck-link"
                href={deck.deckUrl}
                target="_blank"
                rel="noreferrer"
                title={`Ouvrir ${label}`}
              >
                link
              </a>
            ) : null}
          </div>
          <p className="roster-deck-meta">
            {bracketLine}
            {deck.showcase ? <span className="roster-deck-version">vitrine</span> : null}
          </p>
        </div>
        <button type="button" className="roster-deck-edit" onClick={() => onEdit(deck.id)}>
          edit
        </button>
      </div>
    </article>
  )
}

/**
 * Decks du membre connecté : créer + éditer (vitrine incluse), scoped à son joueur roster.
 */
export default function MemberDecks({ users, decks, onSave, onZoom }) {
  const { user } = useAuth()
  const playerId = user?.playerId ?? null
  const myDecks = playerId ? getDecksForUser(decks, playerId, { activeOnly: false }) : []

  const [commanders, setCommanders] = useState('')
  const [comPrint, setComPrint] = useState({})
  const [commanderPickerKey, setCommanderPickerKey] = useState(0)
  const [bracketKey, setBracketKey] = useState('')
  const [deckUrl, setDeckUrl] = useState('')
  const [showcase, setShowcase] = useState(emptyShowcase)
  const [tags, setTags] = useState([])
  const [colorRef, setColorRef] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingDeckId, setEditingDeckId] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const isMobile = usePlayersMobile()

  const editingDeck = editingDeckId ? getDeckById(decks, editingDeckId) : null

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.listTags().catch(() => []),
      api.reference().catch(() => ({ colors: [] })),
    ]).then(([tagList, reference]) => {
      if (cancelled) return
      setTags(tagList)
      setColorRef(reference.colors ?? [])
    })
    return () => { cancelled = true }
  }, [])

  async function persist(nextUsers, nextDecks) {
    setSaving(true)
    setError('')
    try {
      await saveDecks(nextDecks, decks)
      const [freshUsers, freshDecks] = await Promise.all([loadUsers(), loadDecks()])
      onSave({ users: freshUsers, decks: freshDecks })
    } finally {
      setSaving(false)
    }
  }

  async function handleAddDeck(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!playerId) {
      setError('Aucun joueur associé à ce compte.')
      return
    }

    const { bracket, bracketVariation } = unpackBracket(bracketKey)
    if (!bracket) {
      setError('Indique un bracket.')
      return
    }
    if (showcase.showcase && !showcase.name.trim()) {
      setError('Un deck affiché sur le site doit avoir un titre.')
      return
    }

    try {
      const updatedDecks = addDeckToUser(decks, users, playerId, {
        commanders,
        bracket,
        bracketVariation,
        deckUrl: deckUrl.trim(),
        comPrint,
        showcase: showcase.showcase,
        name: showcase.name.trim(),
        description: showcase.description.trim(),
        colors: showcase.colors,
        tagIds: showcase.tagIds,
      })
      await persist(users, updatedDecks)
      setCommanders('')
      setComPrint({})
      setCommanderPickerKey((k) => k + 1)
      setBracketKey('')
      setDeckUrl('')
      setShowcase(emptyShowcase())
      setSuccess('Deck ajouté.')
      if (isMobile) setAddModalOpen(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleEditDeckSave(payload) {
    if (!editingDeckId) return
    if (!payload.versionChanged) {
      await persist(users, decks)
      setEditingDeckId(null)
      setError('')
      setSuccess('Vitrine mise à jour.')
      return
    }
    const updatedDecks = editDeckPowerLevel(decks, editingDeckId, payload)
    await persist(users, updatedDecks)
    setEditingDeckId(null)
    setError('')
    setSuccess(
      !payload.reason
        ? 'URL du deck mise à jour.'
        : payload.reason === 'newVersion'
          ? 'Nouvelle version du deck créée.'
          : 'Niveau du deck mis à jour (historique enregistré).',
    )
  }

  const formProps = {
    saving,
    userNames: [],
    selectedUserId: playerId || '',
    onSelectedUserId: () => {},
    hidePlayerSelect: true,
    commanders,
    onCommanders: setCommanders,
    comPrint,
    onComPrint: setComPrint,
    commanderPickerKey,
    bracketKey,
    onBracketKey: setBracketKey,
    deckUrl,
    onDeckUrl: setDeckUrl,
    showcase,
    onShowcase: setShowcase,
    tags,
    onTagsChange: setTags,
    colorRef,
    onAddDeck: handleAddDeck,
    onZoom,
  }

  if (!playerId) {
    return (
      <div className="players-manager">
        <p className="json-editor-error">
          Aucun joueur roster lié à ton compte — reconnecte-toi ou contacte un admin.
        </p>
      </div>
    )
  }

  return (
    <div className="players-manager member-decks">
      {editingDeck && (
        <DeckEditModal
          deck={editingDeck}
          decks={decks}
          saving={saving}
          tags={tags}
          onTagsChange={setTags}
          colorRef={colorRef}
          onClose={() => setEditingDeckId(null)}
          onSave={handleEditDeckSave}
        />
      )}
      {isMobile && addModalOpen && (
        <PlayersAddModal onClose={() => setAddModalOpen(false)} {...formProps} />
      )}
      {error && <p className="json-editor-error">{error}</p>}
      {success && <p className="json-editor-success">{success}</p>}

      <div className="players-manager-body">
        {!isMobile && <PlayersAddDesktopForms {...formProps} />}
        <aside className="players-roster panel">
          <h3>Mes decks ({myDecks.length})</h3>
          {myDecks.length === 0 ? (
            <p className="players-roster-empty">Aucun deck pour l’instant — ajoute-en un.</p>
          ) : (
            <ul className="roster-deck-grid">
              {myDecks.map((deck) => (
                <li key={deck.id}>
                  <DeckTile deck={deck} onZoom={onZoom} onEdit={setEditingDeckId} />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {isMobile && (
        <button
          type="button"
          className="players-add-fab"
          aria-label="Ajouter un deck"
          onClick={() => {
            setError('')
            setAddModalOpen(true)
          }}
        >
          <svg
            className="players-add-fab-icon"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>
  )
}
