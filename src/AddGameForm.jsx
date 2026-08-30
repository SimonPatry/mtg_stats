import { useEffect, useMemo, useState } from 'react'
import { createGameId } from './gamesApi'
import {
  getCommanderOptionsFromPlayers,
  mergeGameDecksIntoPlayers,
} from './playersMapping'

const BRACKET_OPTIONS = [1, 2, 3, 4].flatMap((b) => [
  { value: String(b), label: `B${b}` },
  { value: `${b}-low`, label: `B${b} low` },
  { value: `${b}-high`, label: `B${b} high` },
])

/** "3-high" → { bracket: 3, bracketVariation: "high" } */
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

/** { bracket, bracketVariation } → "3-high" */
function packBracket(bracket, bracketVariation) {
  if (bracket == null || bracket === '') return ''
  const base = String(bracket)
  if (bracketVariation === 'low' || bracketVariation === 'high') {
    return `${base}-${bracketVariation}`
  }
  return base
}

const emptyDeck = (seatOrder) => ({
  commanderKey: '',
  player: '',
  bracketKey: '',
  seatOrder,
  result: null,
})

function buildGameDraft({
  gameId,
  date,
  turns,
  bracket,
  bracketVariation,
  hadWipe,
  winnerProtectedVictory,
  notes,
  decks,
  commanderOptions,
}) {
  const turnsNum = Number(turns)
  const bracketNum = Number(bracket)
  if (!date || !turns || Number.isNaN(turnsNum) || turnsNum < 1) return null
  if (!bracket || Number.isNaN(bracketNum) || bracketNum < 1 || bracketNum > 4) {
    return null
  }

  const resolvedDecks = []
  for (const d of decks) {
    const opt = commanderOptions.find((o) => o.key === d.commanderKey)
    if (!opt || !d.player.trim() || !unpackBracket(d.bracketKey).bracket) return null
    const { bracket: deckBracket, bracketVariation: deckVar } = unpackBracket(d.bracketKey)
    resolvedDecks.push({
      commanders: opt.commanders,
      player: d.player.trim(),
      bracket: deckBracket,
      bracketVariation: deckVar,
      seatOrder: d.seatOrder,
      result: d.result,
    })
  }

  if (resolvedDecks.length !== 4) return null

  return {
    id: gameId,
    date,
    turns: turnsNum,
    bracket: bracketNum,
    bracketVariation: bracketVariation || null,
    hadWipe,
    winnerProtectedVictory,
    notes: notes.trim(),
    decks: resolvedDecks,
  }
}

function AddGameForm({ players, onSave, onClose }) {
  const [gameId] = useState(() => createGameId())
  const commanderOptions = useMemo(
    () => getCommanderOptionsFromPlayers(players),
    [players],
  )
  const knownPlayers = useMemo(() => Object.keys(players).sort(), [players])

  const [date, setDate] = useState('')
  const [turns, setTurns] = useState('')
  const [bracket, setBracket] = useState('')
  const [bracketVariation, setBracketVariation] = useState('')
  const [hadWipe, setHadWipe] = useState(false)
  const [winnerProtectedVictory, setWinnerProtectedVictory] = useState(false)
  const [notes, setNotes] = useState('')
  const [decks, setDecks] = useState([
    emptyDeck(1),
    emptyDeck(2),
    emptyDeck(3),
    emptyDeck(4),
  ])
  const [gameJson, setGameJson] = useState('')
  const [playersJson, setPlayersJson] = useState('')
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
        hadWipe,
        winnerProtectedVictory,
        notes,
        decks,
        commanderOptions,
      }),
    [
      gameId,
      date,
      turns,
      bracket,
      bracketVariation,
      hadWipe,
      winnerProtectedVictory,
      notes,
      decks,
      commanderOptions,
    ],
  )

  const playersDraft = useMemo(() => {
    if (!gameDraft) return players
    return mergeGameDecksIntoPlayers(players, gameDraft.decks)
  }, [players, gameDraft])

  useEffect(() => {
    setGameJson(gameDraft ? JSON.stringify(gameDraft, null, 2) : '')
  }, [gameDraft])

  useEffect(() => {
    setPlayersJson(JSON.stringify(playersDraft, null, 2))
  }, [playersDraft])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function updateDeck(index, patch) {
    setDecks((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    )
  }

  function setCommander(index, commanderKey) {
    const opt = commanderOptions.find((o) => o.key === commanderKey)
    updateDeck(index, {
      commanderKey,
      player: opt?.player ?? '',
      bracketKey: opt
        ? packBracket(opt.bracket, opt.bracketVariation || null)
        : '',
    })
  }

  function setWinner(index) {
    setDecks((prev) =>
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
    const keys = decks.map((d) => d.commanderKey)
    if (keys.some((k) => !k) || keys.length !== 4) {
      return 'Choisis les 4 commandants.'
    }
    if (new Set(keys).size !== 4) {
      return 'Chaque commandant doit être différent.'
    }
    if (decks.some((d) => !d.player.trim())) {
      return 'Indique un joueur pour chaque deck.'
    }
    if (decks.some((d) => !unpackBracket(d.bracketKey).bracket)) {
      return 'Indique un bracket pour chaque deck.'
    }
    if (!decks.some((d) => d.result === 'win')) {
      return 'Sélectionne un gagnant.'
    }
    return null
  }

  function validateGamePayload(game) {
    if (!game?.id || !game.date || !Array.isArray(game.decks) || game.decks.length !== 4) {
      return 'JSON partie invalide.'
    }
    if (!game.decks.some((d) => d.result === 'win')) {
      return 'JSON partie : un gagnant requis.'
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

    let game
    let updatedPlayers
    try {
      game = JSON.parse(gameJson)
      updatedPlayers = JSON.parse(playersJson)
    } catch {
      setError('JSON invalide — vérifie les deux blocs.')
      return
    }

    const gameError = validateGamePayload(game)
    if (gameError) {
      setError(gameError)
      return
    }

    if (!updatedPlayers || typeof updatedPlayers !== 'object' || Array.isArray(updatedPlayers)) {
      setError('JSON mapping joueurs invalide.')
      return
    }

    setSaving(true)
    try {
      await onSave({ game, players: updatedPlayers })
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
        <datalist id="known-players">
          {knownPlayers.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="modal-header">
          <h2>Nouvelle partie</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          <label className="form-field">
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

          <label className="form-field">
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

          <label className="form-field">
            <span>Variation table</span>
            <select
              value={bracketVariation}
              onChange={(e) => setBracketVariation(e.target.value)}
            >
              <option value="">—</option>
              <option value="low">low</option>
              <option value="high">high</option>
            </select>
          </label>
        </div>

        <div className="form-checks">
          <label className="form-check">
            <input
              type="checkbox"
              checked={hadWipe}
              onChange={(e) => setHadWipe(e.target.checked)}
            />
            Board wipe
          </label>
          <label className="form-check">
            <input
              type="checkbox"
              checked={winnerProtectedVictory}
              onChange={(e) => setWinnerProtectedVictory(e.target.checked)}
            />
            Victoire protégée
          </label>
        </div>

        <fieldset className="form-decks">
          <legend>Decks (com + joueur + bracket + win)</legend>
          <div className="form-deck-head">
            <span>#</span>
            <span>Commandant</span>
            <span>Joueur</span>
            <span>Bracket</span>
            <span>Win</span>
          </div>
          {decks.map((deck, i) => (
            <div key={deck.seatOrder} className="form-deck-row">
              <span className="seat-label">#{deck.seatOrder}</span>
              <select
                value={deck.commanderKey}
                onChange={(e) => setCommander(i, e.target.value)}
                required
              >
                <option value="">Commandant…</option>
                {commanderOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                list="known-players"
                value={deck.player}
                onChange={(e) => updateDeck(i, { player: e.target.value })}
                placeholder="Joueur…"
                required
              />
              <select
                value={deck.bracketKey}
                onChange={(e) => updateDeck(i, { bracketKey: e.target.value })}
                required
              >
                <option value="">Bracket…</option>
                {BRACKET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <label className="form-check win-check">
                <input
                  type="radio"
                  name="winner"
                  checked={deck.result === 'win'}
                  onChange={() => setWinner(i)}
                  required={!decks.some((d) => d.result === 'win')}
                />
                Win
              </label>
            </div>
          ))}
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

        <div className="form-json-grid">
          <label className="form-field">
            <span>JSON partie (games_test.json)</span>
            <textarea
              className="json-editor"
              rows={10}
              value={gameJson}
              onChange={(e) => setGameJson(e.target.value)}
              spellCheck={false}
            />
          </label>
          <label className="form-field">
            <span>JSON mapping joueurs (players.json)</span>
            <textarea
              className="json-editor"
              rows={10}
              value={playersJson}
              onChange={(e) => setPlayersJson(e.target.value)}
              spellCheck={false}
            />
          </label>
        </div>
        <p className="form-hint">
          Le mapping se complète si com + bracket + variation diffèrent d&apos;une entrée existante.
        </p>

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
