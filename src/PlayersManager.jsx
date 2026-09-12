import { useEffect, useState } from 'react'
import DeckEditModal from './DeckEditModal'
import PlayersAddDesktopForms from './PlayersAddDesktopForms'
import PlayersAddModal from './PlayersAddModal'
import AccountEditModal from './admin/AccountEditModal.jsx'
import { loadDecks, saveDecks } from './decksApi'
import { loadUsers, saveUsers } from './usersApi'
import {
  addDeckToUser,
  asCommanderList,
  editDeckPowerLevel,
  formatCommanders,
  getDeckById,
  getDecksForUser,
  getUserName,
} from './playersMapping'
import { fetchCommanderImage } from './scryfall'
import { api } from './lib/api.js'
import { emptyShowcase } from './admin/fields/ShowcaseFields.jsx'
import { cleanInspirations } from './admin/fields/InspirationEditor.jsx'

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
  const printKey = commanders
    .map((name) => {
      const p = deck.comPrint?.[name]
      return `${name}|${p?.set || ''}|${p?.collectorNumber || ''}|${p?.imageUrl || ''}`
    })
    .join('~')
  const [images, setImages] = useState(() =>
    commanders.map((name) => deck.comPrint?.[name]?.imageUrl || null),
  )

  useEffect(() => {
    let cancelled = false

    Promise.all(
      commanders.map(async (name) => {
        const print = deck.comPrint?.[name]
        if (print?.imageUrl) return print.imageUrl
        try {
          return await fetchCommanderImage(name, 'small', print)
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
  }, [deck.id, printKey])

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
    onZoom(commanders, e.currentTarget.getBoundingClientRect(), deck.comPrint)
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
        {/* Bracket et marque de version sur la MÊME ligne : en dessous, la
            carte changeait de hauteur selon qu'un deck succédait ou non à un
            autre, et la grille devenait irrégulière. */}
        <p className="roster-deck-meta">
          {bracketLine}
          {deck.previousDeckId ? (
            <span className="roster-deck-version" title={deck.previousDeckId}>
              suite v. préc.
            </span>
          ) : null}
          {deck.archived ? (
            <span className="roster-deck-version" title="Archivé — visible admin uniquement">
              archivé
            </span>
          ) : null}
        </p>
      </div>
      <button type="button" className="roster-deck-edit" onClick={handleEdit}>
        edit
      </button>
    </div>
  )

  return (
    <article
      className={`roster-deck-tile${deck.archived ? ' is-archived' : ''}`}
      title={label}
    >
      {card}
    </article>
  )
}

function RosterPlayer({ user, decks, onZoom, onEditDeck, onEditUser }) {
  // Admin : inclut les archivés (trace). Les membres ne les reçoivent pas de l'API.
  const userDecks = getDecksForUser(decks, user.id, { includeArchived: true })
  const roleLabel = user.accountRole === 'admin' ? 'Admin' : 'Membre'

  return (
    <li className="roster-player-card">
      <header className="roster-player-head">
        <RosterAvatar userId={user.id} name={user.name} />
        <div className="roster-player-meta">
          <h4 className="roster-player-name">
            {user.name}
            <span className={`roster-role-pill roster-role-pill--${user.accountRole || 'user'}`}>
              {roleLabel}
            </span>
          </h4>
          <span className="roster-player-count">
            @{user.accountUsername || '—'}
            {' · '}
            {userDecks.length === 0
              ? 'Aucun deck'
              : `${userDecks.length} deck${userDecks.length > 1 ? 's' : ''}`}
            {!user.active ? ' · inactif' : ''}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm roster-player-edit"
          onClick={() => onEditUser?.(user)}
        >
          Éditer
        </button>
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
  // Roster admin = comptes inscrits (y compris inactifs, pour pouvoir les réactiver).
  const registered = users.filter((u) => u.accountId)
  const userNames = [...registered].sort((a, b) => a.name.localeCompare(b.name))

  const [selectedUserId, setSelectedUserId] = useState('')
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
  const [editingUser, setEditingUser] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const isMobile = usePlayersMobile()

  const editingDeck = editingDeckId
    ? getDeckById(decks, editingDeckId)
    : null

  // Vocabulaire de tags et référentiel de couleurs, pour le bloc vitrine du
  // formulaire d'ajout. Un échec ne bloque rien : sans eux, seule la partie
  // vitrine est indisponible.
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

  async function persist(updatedUsers, updatedDecks) {
    setSaving(true)
    try {
      await saveUsers(updatedUsers, users)
      await saveDecks(updatedDecks, decks)

      // On relit plutôt que de garder les lignes fabriquées localement : elles
      // portent un identifiant provisoire et, surtout, pas de `lineageId` —
      // sans lui l'écran d'édition ne sait pas retrouver la face vitrine du
      // deck qu'on vient de créer.
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

    if (!selectedUserId) {
      setError('Choisis un joueur.')
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
    const emptySection = (showcase.slider ?? []).find(
      (s) => !s.title.trim() || s.cards.some((c) => !c.name.trim()),
    )
    if (showcase.showcase && emptySection) {
      setError('Chaque section de carrousel a besoin d’un titre et de cartes nommées.')
      return
    }

    try {
      const updatedDecks = addDeckToUser(decks, users, selectedUserId, {
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
        slider: showcase.showcase ? (showcase.slider ?? []) : [],
        inspirations: showcase.showcase
          ? cleanInspirations(showcase.inspirations)
          : [],
      })
      await persist(users, updatedDecks)
      setCommanders('')
      setComPrint({})
      setCommanderPickerKey((k) => k + 1)
      setBracketKey('')
      setDeckUrl('')
      setShowcase(emptyShowcase())
      setSuccess(`Deck ajouté pour ${getUserName(users, selectedUserId)}.`)
      if (isMobile) setAddModalOpen(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleEditDeckSave(payload) {
    if (!editingDeckId) return

    // La face vitrine a déjà été écrite par le modal via api.updateDeck.
    if (!payload.versionChanged) {
      setEditingDeckId(null)
      setError('')
      setSuccess(payload.showcaseSaved ? 'Vitrine mise à jour.' : 'Enregistré.')
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

  async function handleEditUserSave({ name, active, role, accountId }) {
    if (!editingUser) return
    setSaving(true)
    setError('')
    try {
      await api.updateUser(editingUser.id, { name, active })
      if (accountId && role && role !== editingUser.accountRole) {
        await api.updateAccount(accountId, { role })
      }
      const [freshUsers, freshDecks] = await Promise.all([loadUsers(), loadDecks()])
      onSave({ users: freshUsers, decks: freshDecks })
      setEditingUser(null)
      setSuccess(`« ${name} » mis à jour.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="players-manager">
      {editingUser && (
        <AccountEditModal
          user={editingUser}
          saving={saving}
          onClose={() => setEditingUser(null)}
          onSave={handleEditUserSave}
        />
      )}
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
        <PlayersAddModal
          onClose={() => setAddModalOpen(false)}
          saving={saving}
          userNames={userNames}
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
          showcase={showcase}
          onShowcase={setShowcase}
          tags={tags}
          onTagsChange={setTags}
          colorRef={colorRef}
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
            showcase={showcase}
            onShowcase={setShowcase}
            tags={tags}
            onTagsChange={setTags}
            colorRef={colorRef}
            onAddDeck={handleAddDeck}
            onZoom={onZoom}
          />
        )}
        <aside className="players-roster panel">
          <h3>Inscrits ({userNames.length})</h3>
          {userNames.length === 0 ? (
            <p className="players-roster-empty">Aucun compte inscrit pour l’instant.</p>
          ) : (
            <ul className="roster-player-list">
              {userNames.map((user) => (
                <RosterPlayer
                  key={user.id}
                  user={user}
                  decks={decks}
                  onZoom={onZoom}
                  onEditDeck={setEditingDeckId}
                  onEditUser={setEditingUser}
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
