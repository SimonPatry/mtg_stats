import { useEffect, useState } from 'react'
import { formatBracketLine, formatCommanders, getDeckChainHistory } from './playersMapping'
import Select from './Select'

const BRACKET_OPTIONS = [1, 2, 3, 4].flatMap((b) => [
  { value: String(b), label: `B${b}` },
  { value: `${b}-low`, label: `B${b} low` },
  { value: `${b}-high`, label: `B${b} high` },
])

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

function packBracket(bracket, bracketVariation) {
  if (bracket == null || bracket === '') return ''
  const base = String(bracket)
  if (bracketVariation === 'low' || bracketVariation === 'high') {
    return `${base}-${bracketVariation}`
  }
  return base
}


export default function DeckEditModal({ deck, decks, onSave, onClose, saving }) {
  const [bracketKey, setBracketKey] = useState(() =>
    packBracket(deck.bracket, deck.bracketVariation),
  )
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const { bracket, bracketVariation } = unpackBracket(bracketKey)
    if (!bracket) {
      setError('Choisis un bracket.')
      return
    }
    if (!reason) {
      setError('Indique pourquoi le niveau change.')
      return
    }

    try {
      await onSave({
        bracket,
        bracketVariation,
        reason,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  const label = formatCommanders(deck.com)
  const chainHistory = getDeckChainHistory(decks, deck.id)

  return (
    <div className="modal-backdrop deck-edit-backdrop" onClick={onClose}>
      <form
        className="modal deck-edit-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h2>Éditer le deck</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="deck-edit-body">
          <div className="deck-edit-main">
            <p className="deck-edit-commander">{label}</p>
            <p className="deck-edit-current">
              Niveau actuel :{' '}
              <strong>{formatBracketLine(deck.bracket, deck.bracketVariation)}</strong>
            </p>

            <label className="form-field">
              <span>Nouveau bracket</span>
              <Select
                value={bracketKey}
                onChange={(e) => setBracketKey(e.target.value)}
                required
              >
                <option value="">— Choisir —</option>
                {BRACKET_OPTIONS.map(({ value, label: optLabel }) => (
                  <option key={value} value={value}>
                    {optLabel}
                  </option>
                ))}
              </Select>
            </label>

            <fieldset className="deck-edit-reason">
              <legend>Pourquoi ce changement ?</legend>
              <label className="form-check deck-edit-reason-option">
                <input
                  type="radio"
                  name="edit-reason"
                  value="newVersion"
                  checked={reason === 'newVersion'}
                  onChange={() => setReason('newVersion')}
                />
                <span>
                  <strong>Nouvelle version du deck</strong>
                  <small>
                    Le deck a été modifié (cartes, stratégie…). Crée un nouveau deck
                    lié à l&apos;ancien — les parties passées restent sur
                    l&apos;ancienne version.
                  </small>
                </span>
              </label>
              <label className="form-check deck-edit-reason-option">
                <input
                  type="radio"
                  name="edit-reason"
                  value="levelAdjustment"
                  checked={reason === 'levelAdjustment'}
                  onChange={() => setReason('levelAdjustment')}
                />
                <span>
                  <strong>Réajustement du niveau</strong>
                  <small>
                    Même deck, nouvelle estimation humaine du power level.
                    L&apos;ancien niveau apparaît dans l&apos;historique à droite.
                  </small>
                </span>
              </label>
            </fieldset>

            {error && <p className="json-editor-error">{error}</p>}
          </div>

          <aside className="deck-edit-sidebar">
            <h3 className="deck-edit-sidebar-title">
              Historique
              {chainHistory.length > 0 ? ` (${chainHistory.length})` : ''}
            </h3>

            {chainHistory.length > 0 ? (
              <ul className="deck-edit-history-list">
                {chainHistory.map((row, i) => (
                  <li
                    key={`${row.deckId}-${row.date}-${i}`}
                    className="deck-edit-history-item"
                  >
                    <div className="deck-edit-history-head">
                      <time dateTime={row.date}>{row.date}</time>
                      {row.versionLabel ? (
                        <span className="deck-edit-history-version">{row.versionLabel}</span>
                      ) : null}
                    </div>
                    <dl className="deck-edit-history-details">
                      <div>
                        <dt>Niveau</dt>
                        <dd>{row.levelTransition}</dd>
                      </div>
                      <div>
                        <dt>Cause</dt>
                        <dd>{row.cause}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="deck-edit-history-empty">Aucun réajustement pour l&apos;instant.</p>
            )}
          </aside>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}
