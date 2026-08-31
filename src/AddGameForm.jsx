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

const emptyDeck = (seatOrder) => ({
  userId: '',
  deckId: '',
  player: '',
  seatOrder,
  result: null,
})

function buildGameDraft({
  gameId,
  date,
  turns,
  bracket,
  bracketVariation,
  boardWipes,
  winnerProtectedVictory,
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

  if (resolvedDecks.length !== 4) return null

  return {
    id: gameId,
    date,
    turns: turnsNum,
    bracket: bracketNum,
    bracketVariation: bracketVariation || null,
    boardWipes: Math.max(0, Number(boardWipes) || 0),
    winnerProtectedVictory,
    notes: notes.trim(),
    decks: resolvedDecks,
  }
}

function NumberStepper({ value, onChange, min = 0, max, step = 1, ...rest }) {
  function clamp(n) {
    let next = n
    if (max != null) next = Math.min(max, next)
    return Math.max(min, next)
  }

  function bump(delta) {
    onChange(clamp((Number(value) || 0) + delta))
  }

  function handleChange(e) {
    const raw = e.target.value
    if (raw === '') {
      onChange(min)
      return
    }
    const n = Number.parseInt(raw, 10)
    onChange(Number.isNaN(n) ? min : clamp(n))
  }

  return (
    <div className="number-stepper">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        {...rest}
      />
      <div className="number-stepper-spin">
        <button
          type="button"
          className="number-stepper-btn"
          tabIndex={-1}
          aria-label="Augmenter"
          onClick={() => bump(step)}
        >
          ▲
        </button>
        <button
          type="button"
          className="number-stepper-btn"
          tabIndex={-1}
          aria-label="Diminuer"
          disabled={value <= min}
          onClick={() => bump(-step)}
        >
          ▼
        </button>
      </div>
    </div>
  )
}

function AddGameForm({ users, decks, onSave, onClose }) {
  const [gameId] = useState(() => createGameId())
  const activeUsers = useMemo(
    () => getActiveUsers(users).sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  )

  const [date, setDate] = useState('')
  const [turns, setTurns] = useState('')
  const [bracket, setBracket] = useState('')
  const [bracketVariation, setBracketVariation] = useState('')
  const [boardWipes, setBoardWipes] = useState(0)
  const [winnerProtectedVictory, setWinnerProtectedVictory] = useState(false)
  const [notes, setNotes] = useState('')
  const [formDecks, setFormDecks] = useState([
    emptyDeck(1),
    emptyDeck(2),
    emptyDeck(3),
    emptyDeck(4),
  ])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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
        notes,
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
      notes,
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

  function validateForm() {
    if (!date) return 'Choisis une date.'
    const turnsNum = Number(turns)
    if (!turns || Number.isNaN(turnsNum) || turnsNum < 1) {
      return 'Indique le nombre de tours.'
    }
    const bracketNum = Number(bracket)
    if (!bracket || Number.isNaN(bracketNum) || bracketNum < 1 || bracketNum > 4) {
      return 'Indique un bracket de table (1–4).'
    }
    const deckIds = formDecks.map((d) => d.deckId)
    if (deckIds.some((id) => !id) || deckIds.length !== 4) {
      return 'Choisis les 4 decks.'
    }
    if (new Set(deckIds).size !== 4) {
      return 'Chaque deck doit être différent.'
    }
    const playerIds = formDecks.map((d) => d.userId)
    if (playerIds.some((id) => !id) || new Set(playerIds).size !== 4) {
      return 'Chaque joueur ne peut apparaître qu\'une fois.'
    }
    if (!formDecks.some((d) => d.result === 'win')) {
      return 'Sélectionne un gagnant.'
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
          <h2>Nouvelle partie</h2>
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
            <span>Bracket table</span>
            <input
              type="number"
              min="1"
              max="4"
              value={bracket}
              onChange={(e) => setBracket(e.target.value)}
              placeholder="—"
              required
            />
          </label>

          <label className="form-field add-game-variation">
            <span>Variation table</span>
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
            <span>Board wipes</span>
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

        <fieldset className="form-decks">
          <legend>Decks (joueur + commandant + win)</legend>
          <div className="form-deck-head">
            <span>#</span>
            <span>Joueur</span>
            <span>Commandant</span>
            <span>Win</span>
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
              <label className="form-deck-field">
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
              </label>
              <label className="form-deck-field">
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
              </label>
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
            </div>
            )
          })}
        </fieldset>

        <label className="form-field">
          <span>Notes</span>
          <textarea
            rows={2}
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
            {saving ? 'Enregistrement…' : 'Ajouter'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddGameForm
