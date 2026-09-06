import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import CommanderPicker from './CommanderPicker'
import Select from './Select'
import ShowcaseFields from './admin/fields/ShowcaseFields.jsx'

const BRACKET_OPTIONS = [1, 2, 3, 4].flatMap((b) => [
  { value: String(b), label: `B${b}` },
  { value: `${b}-low`, label: `B${b} low` },
  { value: `${b}-high`, label: `B${b} high` },
])

export default function PlayersAddModal({
  onClose,
  saving,
  userNames,
  selectedUserId,
  onSelectedUserId,
  hidePlayerSelect = false,
  commanders,
  onCommanders,
  comPrint,
  onComPrint,
  commanderPickerKey,
  bracketKey,
  onBracketKey,
  deckUrl,
  showcase,
  onShowcase,
  tags,
  onTagsChange,
  colorRef,
  onDeckUrl,
  onAddDeck,
  onZoom,
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div className="modal-backdrop players-add-modal-backdrop" onClick={onClose}>
      <div
        className="modal players-add-modal"
        role="dialog"
        aria-labelledby="players-add-modal-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="players-add-modal-title">Nouveau deck</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <form className="players-add-form" onSubmit={onAddDeck}>
          <div className="players-add-modal-body">
            <div className="players-form-grid">
              {!hidePlayerSelect && (
                <label className="form-field">
                  <span>Joueur</span>
                  <Select
                    value={selectedUserId}
                    onChange={(e) => onSelectedUserId(e.target.value)}
                  >
                    <option value="">— Choisir —</option>
                    {userNames.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                        {user.accountUsername ? ` (@${user.accountUsername})` : ''}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
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
            </div>
            <div className="form-field">
              <span>Commandant(s)</span>
              <CommanderPicker
                key={commanderPickerKey}
                value={commanders}
                comPrint={comPrint}
                onChange={onCommanders}
                onComPrintChange={onComPrint}
                onColorIdentityChange={(colors) => onShowcase({ ...showcase, colors })}
                onZoom={onZoom}
                disabled={saving}
              />
            </div>
            <label className="form-field">
              <span>URL deck</span>
              <input
                type="url"
                value={deckUrl}
                onChange={(e) => onDeckUrl(e.target.value)}
                placeholder="https://moxfield.com/decks/…"
              />
            </label>
            <ShowcaseFields
              value={showcase}
              onChange={onShowcase}
              tags={tags}
              onTagsChange={onTagsChange}
              colors={colorRef}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
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
    </div>,
    document.body,
  )
}
