import { useEffect, useState } from 'react'
import { formatBracketLine, formatCommanders, formatComPrint, formatComPrintLabel, getDeckChainHistory } from './playersMapping'
import Select from './Select'
import { api } from './lib/api.js'
import ColorPicker from './admin/fields/ColorPicker.jsx'
import TagPicker from './admin/fields/TagPicker.jsx'
import SliderEditor from './admin/fields/SliderEditor.jsx'
import InspirationEditor, { cleanInspirations } from './admin/fields/InspirationEditor.jsx'
import CardPrintingsModal from './CardPrintingsModal.jsx'

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


/**
 * Édition d'un deck — ses deux faces au même endroit.
 *
 * Les statistiques raisonnent en VERSIONS (bracket, lien, motif du changement) ;
 * la vitrine raisonne en LIGNÉE (titre, description, couleurs, tags,
 * carrousels). Le formulaire écrit donc à deux endroits : la lignée par
 * `api.updateDeck`, la version par `onSave` — inchangé — et dans cet ordre, la
 * création d'une nouvelle version ne devant pas se faire avant que la lignée
 * soit à jour.
 */
export default function DeckEditModal({
  deck, decks, onSave, onClose, saving, tags, onTagsChange, colorRef,
}) {
  const [bracketKey, setBracketKey] = useState(() =>
    packBracket(deck.bracket, deck.bracketVariation),
  )
  const [deckUrl, setDeckUrl] = useState(() => deck.deckUrl ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  // Face vitrine : chargée à l'ouverture, car ces champs vivent sur la lignée
  // et non sur la ligne de version que manipulent les composants.
  const [lineage, setLineage] = useState(null)
  const [showcase, setShowcase] = useState(false)
  const [archived, setArchived] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [colors, setColors] = useState([])
  const [tagIds, setTagIds] = useState([])
  const [slider, setSlider] = useState([])
  const [inspirations, setInspirations] = useState([])
  const [commanders, setCommanders] = useState([])
  const [printingsCard, setPrintingsCard] = useState(null) // commander name

  useEffect(() => {
    if (!deck.lineageId) return undefined
    let cancelled = false

    // Seule la lignée est chargée ici. Le vocabulaire de tags et le référentiel
    // de couleurs viennent de l'écran : un tag créé dans ce modal doit être
    // proposé immédiatement dans le formulaire de création, et réciproquement.
    api.getDeck(deck.lineageId).then((row) => {
      if (cancelled || !row) return
      setLineage(row)
      setShowcase(Boolean(row.showcase))
      setArchived(Boolean(row.archived))
      setName(row.name ?? '')
      setDescription(row.description ?? '')
      setColors(row.colors ?? [])
      setTagIds(row.tag_ids ?? [])
      setSlider(row.slider ?? [])
      setInspirations(row.inspirations ?? [])
      setCommanders(
        (row.commanders ?? []).map((c) => (
          typeof c === 'string'
            ? { name: c, set_code: '', collector_number: '', image_url: '' }
            : {
                name: c.name,
                set_code: c.set_code || '',
                collector_number: c.collector_number || '',
                image_url: c.image_url || '',
              }
        )),
      )
    }).catch(() => { /* la face vitrine reste fermée, l'édition du bracket marche */ })

    return () => { cancelled = true }
  }, [deck.lineageId])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const initialBracketKey = packBracket(deck.bracket, deck.bracketVariation)
  const bracketChanged = bracketKey !== initialBracketKey

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const { bracket, bracketVariation } = unpackBracket(bracketKey)
    if (!bracket) {
      setError('Choisis un bracket.')
      return
    }
    if (bracketChanged && !reason) {
      setError('Indique pourquoi le niveau change.')
      return
    }

    if (showcase && !archived && !name.trim()) {
      setError('Un deck affiché sur le site doit avoir un titre.')
      return
    }
    const emptySection = slider.find((s) => !s.title.trim() || s.cards.some((c) => !c.name.trim()))
    if (showcase && !archived && emptySection) {
      setError('Chaque section de carrousel a besoin d’un titre et de cartes nommées.')
      return
    }

    try {
      if (lineage) {
        await api.updateDeck(lineage.id, {
          user_id: lineage.user_id,
          name: name.trim(),
          description: description.trim(),
          showcase: archived ? false : showcase,
          active: lineage.active !== false,
          archived,
          created_on: lineage.created_on,
          commanders: commanders.length
            ? commanders
            : lineage.commanders,
          colors,
          tag_ids: tagIds,
          slider: showcase && !archived ? slider : [],
          inspirations: showcase && !archived ? cleanInspirations(inspirations) : [],
        })
      }
      // Modifier la seule face vitrine ne doit pas passer par l'édition de
      // version : celle-ci refuse un enregistrement sans changement, et on
      // afficherait « aucune modification » alors qu'on vient d'en écrire.
      const versionChanged =
        bracketChanged || deckUrl.trim() !== (deck.deckUrl ?? '')

      await onSave({
        bracket,
        bracketVariation,
        reason: bracketChanged ? reason : '',
        deckUrl: deckUrl.trim(),
        versionChanged,
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

            {commanders.length > 0 && (
              <div className="deck-edit-commander-prints">
                {commanders.map((commander) => {
                  const printLabel = formatComPrintLabel({
                    set: commander.set_code,
                    collectorNumber: commander.collector_number,
                  })
                  return (
                    <div className="deck-edit-commander-print" key={commander.name}>
                      <span className="deck-edit-commander-print__name">{commander.name}</span>
                      <span className="deck-edit-commander-print__meta">
                        {printLabel || 'Version Scryfall par défaut'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-tiny"
                        onClick={() => setPrintingsCard(commander.name)}
                      >
                        {printLabel ? 'Changer version' : 'Versions'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <label className="form-field">
              <span>URL du deck</span>
              <input
                type="url"
                value={deckUrl}
                onChange={(e) => setDeckUrl(e.target.value)}
                placeholder="https://moxfield.com/decks/…"
              />
            </label>

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

            {bracketChanged && (
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
            )}

            <fieldset className="deck-edit-showcase">
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={archived}
                  disabled={!lineage}
                  onChange={(e) => {
                    const next = e.target.checked
                    setArchived(next)
                    if (next) setShowcase(false)
                  }}
                />
                <span>
                  <strong>Archiver</strong>
                  <small>
                    Masqué dans « Mes decks » et hors vitrine. Les admins gardent
                    une trace dans le roster ; les parties passées restent.
                  </small>
                </span>
              </label>

              <label className="form-check">
                <input
                  type="checkbox"
                  checked={showcase}
                  disabled={!lineage || archived}
                  onChange={(e) => setShowcase(e.target.checked)}
                />
                <span>
                  <strong>Afficher sur le site</strong>
                  <small>
                    Le deck apparaît sur la vitrine publique. Les decks affichés
                    sont classés du plus récent au plus ancien — c’est ce rang qui
                    donne à chaque bande sa couleur et son côté d’illustration.
                  </small>
                </span>
              </label>

              {showcase && !archived && (
                <div className="deck-edit-showcase-fields">
                  <label className="form-field">
                    <span>Titre affiché *</span>
                    <input
                      type="text"
                      value={name}
                      maxLength={120}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Le Jardin de Zimone"
                    />
                  </label>

                  <label className="form-field">
                    <span>Description</span>
                    <textarea
                      value={description}
                      rows={5}
                      maxLength={5000}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Entre crochets, [Sol Ring] devient une carte survolable."
                    />
                  </label>

                  <div className="form-field">
                    <span className="form-field-label">Couleurs</span>
                    <ColorPicker value={colors} onChange={setColors} colors={colorRef ?? []} />
                  </div>

                  <div className="form-field">
                    <span className="form-field-label">Tags</span>
                    <TagPicker
                      value={tagIds}
                      onChange={setTagIds}
                      tags={tags ?? []}
                      onTagsChange={onTagsChange}
                    />
                  </div>

                  <div className="form-field">
                    <span className="form-field-label">Sources d’inspiration</span>
                    <InspirationEditor
                      items={inspirations}
                      onChange={setInspirations}
                    />
                  </div>

                  <div className="form-field">
                    <span className="form-field-label">Carrousels</span>
                    <SliderEditor sections={slider} onChange={setSlider} />
                  </div>
                </div>
              )}
            </fieldset>

            {error && <p className="form-error">{error}</p>}
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

      {printingsCard ? (
        <CardPrintingsModal
          cardName={printingsCard}
          selectedSet={
            commanders.find((c) => c.name === printingsCard)?.set_code || ''
          }
          selectedCollectorNumber={
            commanders.find((c) => c.name === printingsCard)?.collector_number || ''
          }
          onSelect={(printing) => {
            const formatted = formatComPrint(printing)
            setCommanders((prev) =>
              prev.map((c) =>
                c.name === printingsCard
                  ? {
                      ...c,
                      set_code: formatted.set || '',
                      collector_number: formatted.collectorNumber || '',
                      image_url: formatted.imageUrl || '',
                    }
                  : c,
              ),
            )
            setPrintingsCard(null)
          }}
          onClose={() => setPrintingsCard(null)}
        />
      ) : null}
    </div>
  )
}
