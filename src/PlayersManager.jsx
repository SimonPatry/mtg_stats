import { useEffect, useState } from 'react'
import DeckEditModal from './DeckEditModal'
import PlayersAddDesktopForms from './PlayersAddDesktopForms'
import PlayersAddModal from './PlayersAddModal'
import { saveDecks } from './decksApi'
import { saveUsers } from './usersApi'
import {
  addDeckToUser,
  addUser,
  asCommanderList,
  editDeckPowerLevel,
  formatCommanders,
  getDeckById,
  getDecksForUser,
  getActiveUsers,
  getUserName,
} from './playersMapping'
import { fetchCommanderImage } from './scryfall'

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


const AVATAR_STYLES = [
  'notionists',
  'adventurer',
  'bottts',
  'pixel-art',
  'fun-emoji',
  'lorelei',
]

const avatarSeeds = new Map()

function getAvatarSeed(userId) {
  if (!avatarSeeds.has(userId)) {
    avatarSeeds.set(userId, Math.random().toString(36).slice(2, 14))
  }
  return avatarSeeds.get(userId)
}

function avatarUrl(userId) {
  const seed = getAvatarSeed(userId)
  const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)]
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`
}

function RosterAvatar({ userId, name }) {
  const [src] = useState(() => avatarUrl(userId))

  return (
    <img
      className="roster-avatar"
      src={src}
      alt=""
      title={name}
      draggable={false}
    />
  )
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

    return () => {
      cancelled = true
    }
  }, [deck.id, deck.com, deck.comPrint])

  return { commanders, images, isPartner: commanders.length > 1 }
}

function formatBracketLine(bracket, bracketVariation) {
  if (bracket == null) return '—'
  const base = `B${bracket}`
  if (bracketVariation === 'low' || bracketVariation === 'high') {
    return `${base} - ${bracketVariation}`
  }
  return base
}

function RosterDeckCard({ deck, onZoom, onEdit }) {
  const { commanders, images, isPartner } = useDeckImages(deck)
  const label = formatCommanders(deck.com)
  const bracketLine = formatBracketLine(deck.bracket, deck.bracketVariation)

  function handleArtZoom(e) {
    if (!onZoom) return
    e.stopPropagation()
    onZoom(commanders, e.currentTarget.getBoundingClientRect())
  }

  function handleEdit(e) {
    e.stopPropagation()
    onEdit(deck.id)
  }

  const card = (
    <div className="roster-deck-card">
      <div
        className={`roster-deck-art${isPartner ? ' partner' : ''}${onZoom ? ' zoomable' : ''}`}
        onClick={handleArtZoom}
        title={label}
      >
        {commanders.map((name, i) => {
          const src = images[i]
          if (!src) {
            return (
              <div
                key={name}
                className="commander-art loading roster-deck-art-img"
                title={name}
              />
            )
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
          <p className="roster-deck-name">{label}</p>
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
        <p className="roster-deck-meta">{bracketLine}</p>
        {deck.previousDeckId ? (
          <p className="roster-deck-version" title={deck.previousDeckId}>
            suite v. préc.
          </p>
        ) : null}
      </div>
      <button type="button" className="roster-deck-edit" onClick={handleEdit}>
        edit
      </button>
    </div>
  )

  return (
    <article className="roster-deck-tile" title={label}>
      {card}
    </article>
  )
}

function RosterPlayer({ user, decks, onZoom, onEditDeck }) {
  const userDecks = getDecksForUser(decks, user.id)

  return (
    <li className="roster-player-card">
      <header className="roster-player-head">
        <RosterAvatar userId={user.id} name={user.name} />
        <div className="roster-player-meta">
          <h4 className="roster-player-name">{user.name}</h4>
          <span className="roster-player-count">
            {userDecks.length === 0
              ? 'Aucun deck'
              : `${userDecks.length} deck${userDecks.length > 1 ? 's' : ''}`}
          </span>
        </div>
      </header>

      {userDecks.length > 0 && (
        <div className="roster-deck-grid">
          {userDecks.map((deck) => (
            <RosterDeckCard
              key={deck.id}
              deck={deck}
              onZoom={onZoom}
              onEdit={onEditDeck}
            />
          ))}
        </div>
      )}
    </li>
  )
}

function usePlayersMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 768px)').matches
      : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setMobile(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return mobile
}

export default function PlayersManager({ users, decks, onSave, onZoom }) {
  const activeUsers = getActiveUsers(users)
  const userNames = [...activeUsers].sort((a, b) => a.name.localeCompare(b.name))

  const [newPlayerName, setNewPlayerName] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [commanders, setCommanders] = useState('')
  const [comPrint, setComPrint] = useState({})
  const [commanderPickerKey, setCommanderPickerKey] = useState(0)
  const [bracketKey, setBracketKey] = useState('')
  const [deckUrl, setDeckUrl] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingDeckId, setEditingDeckId] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addModalTab, setAddModalTab] = useState('deck')
  const isMobile = usePlayersMobile()

  const editingDeck = editingDeckId
    ? getDeckById(decks, editingDeckId)
    : null

  async function persist(updatedUsers, updatedDecks) {
    setSaving(true)
    try {
      await saveUsers(updatedUsers)
      await saveDecks(updatedDecks)
      onSave({ users: updatedUsers, decks: updatedDecks })
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPlayer(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const updatedUsers = addUser(users, newPlayerName)
      const trimmed = newPlayerName.trim()
      await persist(updatedUsers, decks)
      setNewPlayerName('')
      const created = updatedUsers.find((u) => u.name === trimmed)
      if (created) setSelectedUserId(created.id)
      setSuccess(`Joueur « ${trimmed} » ajouté.`)
      if (isMobile) {
        setAddModalOpen(false)
        setAddModalTab('deck')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddDeck(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedUserId) {
      setError('Choisis un joueur.')
      return
    }

    const { bracket, bracketVariation } = unpackBracket(bracketKey)
    if (!bracket) {
      setError('Indique un bracket.')
      return
    }

    try {
      const updatedDecks = addDeckToUser(decks, users, selectedUserId, {
        commanders,
        bracket,
        bracketVariation,
        deckUrl: deckUrl.trim(),
        comPrint,
      })
      await persist(users, updatedDecks)
      setCommanders('')
      setComPrint({})
      setCommanderPickerKey((k) => k + 1)
      setBracketKey('')
      setDeckUrl('')
      setSuccess(`Deck ajouté pour ${getUserName(users, selectedUserId)}.`)
      if (isMobile) setAddModalOpen(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleEditDeckSave(payload) {
    if (!editingDeckId) return

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

  return (
    <div className="players-manager">
      {editingDeck && (
        <DeckEditModal
          deck={editingDeck}
          decks={decks}
          saving={saving}
          onClose={() => setEditingDeckId(null)}
          onSave={handleEditDeckSave}
        />
      )}
      {isMobile && addModalOpen && (
        <PlayersAddModal
          tab={addModalTab}
          onTab={setAddModalTab}
          onClose={() => setAddModalOpen(false)}
          saving={saving}
          userNames={userNames}
          newPlayerName={newPlayerName}
          onNewPlayerName={setNewPlayerName}
          onAddPlayer={handleAddPlayer}
          selectedUserId={selectedUserId}
          onSelectedUserId={setSelectedUserId}
          commanders={commanders}
          onCommanders={setCommanders}
          comPrint={comPrint}
          onComPrint={setComPrint}
          commanderPickerKey={commanderPickerKey}
          bracketKey={bracketKey}
          onBracketKey={setBracketKey}
          deckUrl={deckUrl}
          onDeckUrl={setDeckUrl}
          onAddDeck={handleAddDeck}
          onZoom={onZoom}
        />
      )}
      {error && <p className="json-editor-error">{error}</p>}
      {success && <p className="json-editor-success">{success}</p>}

      <div className="players-manager-body">
        {!isMobile && (
          <PlayersAddDesktopForms
            saving={saving}
            userNames={userNames}
            newPlayerName={newPlayerName}
            onNewPlayerName={setNewPlayerName}
            onAddPlayer={handleAddPlayer}
            selectedUserId={selectedUserId}
            onSelectedUserId={setSelectedUserId}
            commanders={commanders}
            onCommanders={setCommanders}
            comPrint={comPrint}
            onComPrint={setComPrint}
            commanderPickerKey={commanderPickerKey}
            bracketKey={bracketKey}
            onBracketKey={setBracketKey}
            deckUrl={deckUrl}
            onDeckUrl={setDeckUrl}
            onAddDeck={handleAddDeck}
            onZoom={onZoom}
          />
        )}
        <aside className="players-roster panel">
          <h3>Roster ({userNames.length})</h3>
          {userNames.length === 0 ? (
            <p className="players-roster-empty">Aucun joueur pour l&apos;instant.</p>
          ) : (
            <ul className="roster-player-list">
              {userNames.map((user) => (
                <RosterPlayer
                  key={user.id}
                  user={user}
                  decks={decks}
                  onZoom={onZoom}
                  onEditDeck={setEditingDeckId}
                />
              ))}
            </ul>
          )}
        </aside>
      </div>

      {isMobile && (
        <button
          type="button"
          className="players-add-fab"
          aria-label="Ajouter un joueur ou un deck"
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
