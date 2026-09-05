import { useEffect, useMemo, useState } from 'react'
import { createGameId } from './gamesApi'
import {
  getActiveUsers,
  getCommanderOptionsForUser,
  getDeckOptionById,
  mergeGameDecksIntoCatalog,
  formatBracketLine,
} from './playersMapping'
import { validateCatalogEdits } from './jsonGuard'
import Select from './Select'
import NumberStepper from './NumberStepper'
import { composeGameNotes } from './gameDetails'
import { WIN_STYLES } from './tempGame'
import {
  DEFAULT_SEATS,
  MAX_SEATS,
  MIN_SEATS,
  isValidSeatCount,
  makeSeatRange,
  renumberSeats,
} from './seats'

const emptyDeck = (seatOrder) => ({
  userId: '',
  deckId: '',
  player: '',
  seatOrder,
  result: null,
})

function defaultFormDecks(count = DEFAULT_SEATS) {
  return makeSeatRange(count).map((n) => emptyDeck(n))
}

function buildGameDraft({
  gameId,
  date,
  turns,
  bracket,
  bracketVariation,
  boardWipes,
  winnerProtectedVictory,
  lastPlayer,
  lastSeatOrder,
  winStyle,
  wipeEvents,
  deathEvents,
  manaEvents,
  notes,
  decks,
  users,
  catalogDecks,
}) {
  const turnsNum = Number(turns)
  const bracketNum = Number(bracket)
  if (!date || !turns || Number.isNaN(turnsNum) || turnsNum < 1) return null
  if (!bracket || Number.isNaN(bracketNum) || bracketNum < 1 || bracketNum > 4) {
    return null
  }

  const resolvedDecks = []
  for (const d of decks) {
    const opt = getDeckOptionById(users, catalogDecks, d.deckId)
    if (!opt || !d.player.trim() || opt.bracket == null) return null
    resolvedDecks.push({
      commanders: opt.commanders,
      player: d.player.trim(),
      bracket: opt.bracket,
      bracketVariation: opt.bracketVariation || null,
      seatOrder: d.seatOrder,
      result: d.result,
      deckId: opt.deckId,
    })
  }

  if (!isValidSeatCount(resolvedDecks.length)) return null
  if (!lastPlayer?.trim()) return null

  return {
    id: gameId,
    date,
    turns: turnsNum,
    bracket: bracketNum,
    bracketVariation: bracketVariation || null,
    boardWipes: Math.max(0, Number(boardWipes) || 0),
    winnerProtectedVictory,
    lastPlayer: lastPlayer.trim(),
    ...(lastSeatOrder != null ? { lastSeatOrder } : {}),
    ...(winStyle ? { winStyle } : {}),
    ...(wipeEvents?.length ? { wipeEvents } : {}),
    ...(manaEvents?.length ? { manaEvents } : {}),
    ...(deathEvents?.length ? { deathEvents } : {}),
    notes: notes.trim(),
    decks: resolvedDecks,
  }
}

function AddGameForm({ users, decks, onSave, onClose, fromTempGame = null }) {
  const initial = fromTempGame ? fromTempGame : null
  const [gameId] = useState(() => initial?.gameId ?? createGameId())
  const activeUsers = useMemo(
    () => getActiveUsers(users).sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  )

  const [date, setDate] = useState(() => initial?.date ?? '')
  const [turns, setTurns] = useState(() => initial?.turns ?? '')
  const [bracket, setBracket] = useState('')
  const [bracketVariation, setBracketVariation] = useState('')
  const [boardWipes, setBoardWipes] = useState(() => initial?.boardWipes ?? 0)
  const [winnerProtectedVictory, setWinnerProtectedVictory] = useState(false)
  const [winStyle, setWinStyle] = useState('')
  const [lastPlayerIndex, setLastPlayerIndex] = useState(null)
  const [notes, setNotes] = useState(() => initial?.notes ?? '')
  const [formDecks, setFormDecks] = useState(() =>
    initial?.formDecks ?? defaultFormDecks(),
  )
  const [liveWipeEvents] = useState(() => initial?.wipeEvents ?? [])
  const [liveManaEvents] = useState(() => initial?.manaEvents ?? [])
  const [liveDeathEvents] = useState(() => initial?.deathEvents ?? [])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const lastPlayer =
    lastPlayerIndex != null ? formDecks[lastPlayerIndex]?.player?.trim() ?? '' : ''
  const lastSeatOrder =
    lastPlayerIndex != null ? formDecks[lastPlayerIndex]?.seatOrder ?? null : null

  const eventPayload = useMemo(
    () => ({
      wipeEvents: liveWipeEvents,
      manaEvents: liveManaEvents,
      deathEvents: liveDeathEvents,
    }),
    [liveWipeEvents, liveManaEvents, liveDeathEvents],
  )

  const composedNotes = useMemo(
    () => composeGameNotes(notes, eventPayload),
    [notes, eventPayload],
  )

  const gameDraft = useMemo(
    () =>
      buildGameDraft({
        gameId,
        date,
        turns,
        bracket,
        bracketVariation,
        boardWipes,
        winnerProtectedVictory,
        lastPlayer,
        lastSeatOrder,
        winStyle: winStyle || null,
        wipeEvents: liveWipeEvents,
        manaEvents: liveManaEvents,
        deathEvents: liveDeathEvents,
        notes: composedNotes,
        decks: formDecks,
        users,
        catalogDecks: decks,
      }),
    [
      gameId,
      date,
      turns,
      bracket,
      bracketVariation,
      boardWipes,
      winnerProtectedVictory,
      lastPlayer,
      lastSeatOrder,
      winStyle,
      liveWipeEvents,
      liveManaEvents,
      liveDeathEvents,
      composedNotes,
      formDecks,
      users,
      decks,
    ],
  )

  const catalogDraft = useMemo(() => {
    if (!gameDraft) return { users, decks }
    return mergeGameDecksIntoCatalog(users, decks, gameDraft.decks)
  }, [users, decks, gameDraft])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function updateDeck(index, patch) {
    setFormDecks((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    )
  }

  function commanderOptionsForRow(rowIndex, userId, currentDeckId) {
    const takenDeckIds = new Set(
      formDecks
        .filter((_, i) => i !== rowIndex)
        .map((d) => d.deckId)
        .filter(Boolean),
    )
    let options = getCommanderOptionsForUser(users, decks, userId).filter(
      (opt) => !takenDeckIds.has(opt.deckId),
    )
    if (
      currentDeckId &&
      !options.some((opt) => opt.deckId === currentDeckId)
    ) {
      const current = getDeckOptionById(users, decks, currentDeckId)
      if (current) {
        options = [...options, current].sort((a, b) =>
          a.label.localeCompare(b.label),
        )
      }
    }
    return options
  }

  function setPlayer(index, userId) {
    const user = activeUsers.find((u) => u.id === userId)
    updateDeck(index, {
      userId,
      player: user?.name ?? '',
      deckId: '',
    })
  }

  function setDeck(index, deckId) {
    const opt = getDeckOptionById(users, decks, deckId)
    updateDeck(index, {
      deckId,
      userId: opt?.userId ?? formDecks[index].userId,
      player: opt?.player ?? formDecks[index].player,
    })
  }

  function setWinner(index) {
    setFormDecks((prev) =>
      prev.map((d, i) => ({
        ...d,
        result: i === index ? 'win' : 'loss',
      })),
    )
  }

  function setLastPlayer(index) {
    setLastPlayerIndex(index)
  }

  function addSeat() {
    setFormDecks((prev) => {
      if (prev.length >= MAX_SEATS) return prev
      return [...prev, emptyDeck(prev.length + 1)]
    })
  }

  function removeSeat(index) {
    if (formDecks.length <= MIN_SEATS) return
    setFormDecks((prev) => renumberSeats(prev.filter((_, i) => i !== index)))
    setLastPlayerIndex((cur) => {
      if (cur == null) return null
      if (cur === index) return null
      return cur > index ? cur - 1 : cur
    })
  }

  function validateForm() {
    if (!date) return 'Choisis une date.'
    const turnsNum = Number(turns)
    if (!turns || Number.isNaN(turnsNum) || turnsNum < 1) {
      return 'Indique le nombre de tours.'
    }
    const bracketNum = Number(bracket)
    if (!bracket || Number.isNaN(bracketNum) || bracketNum < 1 || bracketNum > 4) {
      return 'Choisis un bracket de table (B1–B4).'
    }
    if (!isValidSeatCount(formDecks.length)) {
      return `Il faut entre ${MIN_SEATS} et ${MAX_SEATS} joueurs.`
    }
    const deckIds = formDecks.map((d) => d.deckId)
    if (deckIds.some((id) => !id)) {
      return `Choisis les ${formDecks.length} decks.`
    }
    if (new Set(deckIds).size !== formDecks.length) {
      return 'Chaque deck doit être différent.'
    }
    const playerIds = formDecks.map((d) => d.userId)
    if (playerIds.some((id) => !id) || new Set(playerIds).size !== formDecks.length) {
      return 'Chaque joueur ne peut apparaître qu\'une fois.'
    }
    if (!formDecks.some((d) => d.result === 'win')) {
      return 'Sélectionne un gagnant.'
    }
    if (lastPlayerIndex == null || !lastPlayer) {
      return 'Sélectionne le dernier joueur à avoir joué.'
    }
    if (fromTempGame && !winStyle) {
      return 'Indique le style de victoire.'
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const formError = validateForm()
    if (formError) {
      setError(formError)
      return
    }

    if (!gameDraft) {
      setError('Formulaire incomplet.')
      return
    }

    try {
      validateCatalogEdits({
        usersBefore: users,
        usersAfter: catalogDraft.users,
        decksBefore: decks,
        decksAfter: catalogDraft.decks,
      })
    } catch (err) {
      setError(err.message)
      return
    }

    setSaving(true)
    try {
      await onSave({
        game: gameDraft,
        users: catalogDraft.users,
        decks: catalogDraft.decks,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal add-game-form"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h2>{fromTempGame ? 'Finaliser la partie' : 'Nouvelle partie'}</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-grid">
          <label className="form-field add-game-date">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          <label className="form-field add-game-turns">
            <span>Tours</span>
            <input
              type="number"
              min="1"
              value={turns}
              onChange={(e) => setTurns(e.target.value)}
              placeholder="—"
              required
            />
          </label>

          <label className="form-field add-game-bracket">
            <span>Bracket</span>
            <Select
              value={bracket}
              onChange={(e) => setBracket(e.target.value)}
              required
            >
              <option value="">—</option>
              <option value="1">B1</option>
              <option value="2">B2</option>
              <option value="3">B3</option>
              <option value="4">B4</option>
            </Select>
          </label>

          <label className="form-field add-game-variation">
            <span>Var.</span>
            <Select
              value={bracketVariation}
              onChange={(e) => setBracketVariation(e.target.value)}
            >
              <option value="">—</option>
              <option value="low">low</option>
              <option value="high">high</option>
            </Select>
          </label>

          <label className="form-field add-game-wipes">
            <span>Wipes</span>
            <NumberStepper
              min={0}
              step={1}
              inputMode="numeric"
              value={boardWipes}
              onChange={setBoardWipes}
            />
          </label>

          <label className="form-check add-game-protected">
            <input
              type="checkbox"
              checked={winnerProtectedVictory}
              onChange={(e) => setWinnerProtectedVictory(e.target.checked)}
            />
            Victoire protégée
          </label>
        </div>

        {fromTempGame && (liveWipeEvents.length > 0 || liveManaEvents.length > 0 || liveDeathEvents.length > 0) && (
          <p className="temp-game-prefill-banner">
            Données live pré-remplies — {liveWipeEvents.length} wipe
            {liveWipeEvents.length !== 1 ? 's' : ''}, {liveManaEvents.length} mana,{' '}
            {liveDeathEvents.length} mort
            {liveDeathEvents.length !== 1 ? 's' : ''}. Il reste les decks et le gagnant.
          </p>
        )}

        <fieldset className="form-decks">
          <legend>
            Decks ({formDecks.length} joueurs — {MIN_SEATS} à {MAX_SEATS})
          </legend>
          <div className="form-seats-toolbar">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => removeSeat(formDecks.length - 1)}
              disabled={formDecks.length <= MIN_SEATS}
            >
              − Joueur
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={addSeat}
              disabled={formDecks.length >= MAX_SEATS}
            >
              + Joueur
            </button>
          </div>
          <div className="form-deck-head">
            <span>#</span>
            <span>Joueur</span>
            <span>Commandant</span>
            <span>Win</span>
            <span>Last</span>
          </div>
          {formDecks.map((deck, i) => {
            const takenUserIds = new Set(
              formDecks
                .filter((_, j) => j !== i)
                .map((d) => d.userId)
                .filter(Boolean),
            )
            const deckOptions = commanderOptionsForRow(i, deck.userId, deck.deckId)
            const deckOpt = deck.deckId
              ? getDeckOptionById(users, decks, deck.deckId)
              : null

            return (
            <div key={deck.seatOrder} className="form-deck-row">
              <span className="seat-label">#{deck.seatOrder}</span>
              <div className="form-deck-player-cell">
                <span className="form-deck-field-label">Joueur</span>
                <Select
                  value={deck.userId}
                  onChange={(e) => setPlayer(i, e.target.value)}
                  required
                >
                  <option value="">Joueur…</option>
                  {activeUsers.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                      disabled={takenUserIds.has(user.id)}
                    >
                      {user.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-deck-commander-cell">
                <span className="form-deck-field-label">Commandant</span>
                <Select
                  value={deck.deckId}
                  onChange={(e) => setDeck(i, e.target.value)}
                  required
                  disabled={!deck.userId}
                >
                  <option value="">
                    {deck.userId ? 'Commandant…' : 'Choisis un joueur…'}
                  </option>
                  {deckOptions.map((opt) => (
                    <option key={opt.deckId} value={opt.deckId}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                {deckOpt ? (
                  <span className="form-deck-bracket-tag">
                    {formatBracketLine(deckOpt.bracket, deckOpt.bracketVariation || null)}
                  </span>
                ) : null}
              </div>
              <label className="form-check win-check form-deck-win">
                <input
                  type="radio"
                  name="winner"
                  checked={deck.result === 'win'}
                  onChange={() => setWinner(i)}
                  required={!formDecks.some((d) => d.result === 'win')}
                />
                Win
              </label>
              <label className="form-check last-check form-deck-last">
                <input
                  type="radio"
                  name="lastPlayer"
                  checked={lastPlayerIndex === i}
                  onChange={() => setLastPlayer(i)}
                  required={lastPlayerIndex == null}
                />
                Last
              </label>
            </div>
            )
          })}
        </fieldset>

        {fromTempGame && (
          <label className="form-field">
            <span>Style de victoire</span>
            <Select value={winStyle} onChange={(e) => setWinStyle(e.target.value)} required>
              <option value="">Style…</option>
              {WIN_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>
        )}

        <label className="form-field add-game-notes">
          <span>Notes</span>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optionnel"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : fromTempGame ? 'Enregistrer la partie' : 'Ajouter'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddGameForm
