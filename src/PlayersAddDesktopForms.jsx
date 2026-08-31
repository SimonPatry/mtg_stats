import CommanderPicker from './CommanderPicker'
import Select from './Select'

const BRACKET_OPTIONS = [1, 2, 3, 4].flatMap((b) => [
  { value: String(b), label: `B${b}` },
  { value: `${b}-low`, label: `B${b} low` },
  { value: `${b}-high`, label: `B${b} high` },
])

export default function PlayersAddDesktopForms({
  saving,
  userNames,
  newPlayerName,
  onNewPlayerName,
  onAddPlayer,
  selectedUserId,
  onSelectedUserId,
  commanders,
  onCommanders,
  comPrint,
  onComPrint,
  commanderPickerKey,
  bracketKey,
  onBracketKey,
  deckUrl,
  onDeckUrl,
  onAddDeck,
  onZoom,
}) {
  return (
    <div className="players-manager-forms">
      <form className="players-form players-form-compact panel" onSubmit={onAddPlayer}>
        <h3>Nouveau joueur</h3>
        <label className="form-field">
          <span>Nom</span>
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => onNewPlayerName(e.target.value)}
            placeholder="Ex. Léa"
            autoComplete="off"
          />
        </label>
        <div className="players-form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !newPlayerName.trim()}
          >
            Ajouter le joueur
          </button>
        </div>
      </form>

      <form className="players-form players-form-deck panel" onSubmit={onAddDeck}>
        <h3>Nouveau deck</h3>
        <label className="form-field">
          <span>Joueur</span>
          <Select value={selectedUserId} onChange={(e) => onSelectedUserId(e.target.value)}>
            <option value="">— Choisir —</option>
            {userNames.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </label>
        <div className="form-field">
          <span>Commandant(s)</span>
          <CommanderPicker
            key={commanderPickerKey}
            value={commanders}
            comPrint={comPrint}
            onChange={onCommanders}
            onComPrintChange={onComPrint}
            onZoom={onZoom}
            disabled={saving}
          />
        </div>
        <label className="form-field">
          <span>Bracket</span>
          <Select value={bracketKey} onChange={(e) => onBracketKey(e.target.value)}>
            <option value="">— Choisir —</option>
            {BRACKET_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="form-field">
          <span>URL deck (optionnel)</span>
          <input
            type="url"
            value={deckUrl}
            onChange={(e) => onDeckUrl(e.target.value)}
            placeholder="https://moxfield.com/decks/…"
          />
        </label>
        <div className="players-form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !selectedUserId || !commanders.trim() || !bracketKey}
          >
            Ajouter le deck
          </button>
        </div>
      </form>
    </div>
  )
}
