import { useEffect, useRef, useState } from 'react'
import CardPrintingsModal from './CardPrintingsModal'
import { sortColors } from './admin/fields/ColorPicker.jsx'
import {
  fetchCommanderImage,
  searchCommanders,
  searchPartnerCommanders,
} from './scryfall'
import { formatComPrint, formatComPrintLabel, parseCommandersInput } from './playersMapping'

function CommanderPreview({ name, printing, zoomNames, onZoom, onShowPrintings }) {
  const [src, setSrc] = useState(null)
  const printLabel = formatComPrintLabel(printing)

  useEffect(() => {
    let cancelled = false
    setSrc(null)

    if (printing?.imageUrl) {
      setSrc(printing.imageUrl)
      return () => {
        cancelled = true
      }
    }

    fetchCommanderImage(name, 'normal')
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [name, printing])

  function handleZoom(e) {
    if (!onZoom) return
    e.stopPropagation()
    const preview = e.currentTarget.closest('.commander-picker-preview')
    const art = e.currentTarget.querySelector('.commander-art')
    const rect =
      zoomNames.length > 1 && preview
        ? preview.getBoundingClientRect()
        : art?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect()
    onZoom(zoomNames, rect)
  }

  return (
    <div className="commander-picker-card-wrap">
      <button
        type="button"
        className={`commander-picker-card zoomable${printing ? ' has-print' : ''}`}
        onClick={handleZoom}
        title={onZoom ? `Voir ${name}` : name}
      >
        {src ? (
          <img className="commander-art" src={src} alt={name} draggable={false} />
        ) : (
          <div className="commander-art loading" />
        )}
        <span className="commander-picker-card-name">{name}</span>
        {printLabel && (
          <span className="commander-picker-print-label">{printLabel}</span>
        )}
      </button>
      {onShowPrintings && (
        <button
          type="button"
          className="btn btn-ghost commander-picker-versions-btn"
          onClick={() => onShowPrintings(name)}
        >
          {printing ? 'Changer version' : 'Versions'}
        </button>
      )}
    </div>
  )
}

export default function CommanderPicker({
  value,
  comPrint = {},
  onChange,
  onComPrintChange,
  onColorIdentityChange,
  onZoom,
  disabled = false,
}) {
  const rootRef = useRef(null)
  const [selected, setSelected] = useState(() => parseCommandersInput(value) || [])
  const [identities, setIdentities] = useState({})
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [open, setOpen] = useState(false)
  const [partnerMode, setPartnerMode] = useState(false)
  const [printingsCard, setPrintingsCard] = useState(null)

  useEffect(() => {
    const parsed = parseCommandersInput(value)
    const next = parsed || []
    setSelected(next)
    setPartnerMode(next.length > 1)
  }, [value])

  function emitColors(names, idMap = identities) {
    if (!onColorIdentityChange) return
    const union = []
    for (const name of names) {
      for (const code of idMap[name] || []) union.push(code)
    }
    onColorIdentityChange(sortColors(union))
  }

  function syncComPrint(names) {
    if (!onComPrintChange) return
    const next = {}
    for (const name of names) {
      if (comPrint[name]) next[name] = comPrint[name]
    }
    onComPrintChange(next)
  }

  function handleSelectPrinting(printing) {
    if (!printingsCard || !onComPrintChange) return
    onComPrintChange({
      ...comPrint,
      [printingsCard]: formatComPrint(printing),
    })
    setPrintingsCard(null)
  }

  useEffect(() => {
    if (disabled || selected.length >= 2) {
      setSuggestions([])
      return
    }

    const trimmed = query.trim()
    const minLen = partnerMode && selected.length === 1 ? 0 : 2
    if (trimmed.length < minLen && !(partnerMode && selected.length === 1)) {
      setSuggestions([])
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setSearchError('')
      try {
        const results =
          partnerMode && selected.length === 1
            ? await searchPartnerCommanders(trimmed, selected[0])
            : await searchCommanders(trimmed)
        if (!cancelled) setSuggestions(results)
      } catch (err) {
        if (!cancelled) {
          setSuggestions([])
          setSearchError(err.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 280)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, selected, partnerMode, disabled])

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function emit(names) {
    if (names.length === 0) {
      onChange('')
      return
    }
    onChange(names.length === 1 ? names[0] : names.join(' / '))
  }

  function selectCommander(card) {
    const name = card.name
    const next = partnerMode && selected.length === 1 ? [selected[0], name] : [name]
    const nextIdentities = {}
    for (const n of next) {
      if (n === name) nextIdentities[n] = card.colorIdentity || []
      else if (identities[n]) nextIdentities[n] = identities[n]
    }
    setSelected(next)
    setIdentities(nextIdentities)
    emit(next)
    emitColors(next, nextIdentities)
    syncComPrint(next)
    setQuery('')
    setSuggestions([])
    setOpen(false)
    if (!partnerMode || next.length === 2) setPartnerMode(next.length > 1)
  }

  function removeAt(index) {
    if (index === 0) {
      setSelected([])
      setIdentities({})
      emit([])
      emitColors([])
      onComPrintChange?.({})
      setPartnerMode(false)
      setQuery('')
      return
    }

    const next = [selected[0]]
    const nextIdentities = {}
    if (identities[next[0]]) nextIdentities[next[0]] = identities[next[0]]
    setSelected(next)
    setIdentities(nextIdentities)
    emit(next)
    emitColors(next, nextIdentities)
    syncComPrint(next)
    setPartnerMode(false)
    setQuery('')
  }

  function startPartner(e) {
    e.preventDefault()
    setPartnerMode(true)
    setOpen(true)
    setQuery('')
  }

  const canSearch = !disabled && selected.length < 2
  const showPartnerButton = selected.length === 1 && !partnerMode

  return (
    <div className="commander-picker" ref={rootRef}>
      {printingsCard && (
        <CardPrintingsModal
          cardName={printingsCard}
          selectedScryfallId={comPrint[printingsCard]?.scryfallId}
          onSelect={handleSelectPrinting}
          onClose={() => setPrintingsCard(null)}
        />
      )}
      {canSearch && (
        <div className="commander-picker-search-wrap">
          <label className="form-field commander-picker-search-field">
            <span>
              {partnerMode && selected.length === 1
                ? 'Partner'
                : 'Rechercher un commandant'}
            </span>
            <div className="commander-picker-search-row">
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                placeholder={
                  partnerMode && selected.length === 1
                    ? 'Thrasios, Tymna, …'
                    : 'Atraxa, Krenko, …'
                }
                autoComplete="off"
                disabled={disabled}
              />
              {showPartnerButton && (
                <button
                  type="button"
                  className="btn btn-ghost commander-picker-partner-btn"
                  onClick={startPartner}
                >
                  + Partner
                </button>
              )}
            </div>
          </label>

          {open && (loading || suggestions.length > 0 || searchError) && (
            <ul className="commander-picker-dropdown" role="listbox">
              {loading && (
                <li className="commander-picker-option muted">Recherche…</li>
              )}
              {searchError && (
                <li className="commander-picker-option error">{searchError}</li>
              )}
              {!loading &&
                suggestions.map((card) => (
                  <li key={card.name}>
                    <button
                      type="button"
                      className="commander-picker-option"
                      role="option"
                      onClick={() => selectCommander(card)}
                    >
                      {card.imageUrl ? (
                        <img src={card.imageUrl} alt="" draggable={false} />
                      ) : (
                        <span className="commander-picker-option-fallback" />
                      )}
                      <span className="commander-picker-option-text">
                        <strong>{card.name}</strong>
                        {card.isPartner && <small>Partner</small>}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div
          className={`commander-picker-preview${selected.length > 1 ? ' partner' : ''}`}
        >
          {selected.map((name, i) => (
            <div key={name} className="commander-picker-preview-item">
              <CommanderPreview
                name={name}
                printing={comPrint[name]}
                zoomNames={selected}
                onZoom={onZoom}
                onShowPrintings={onComPrintChange ? setPrintingsCard : null}
              />
              {!disabled && (
                <button
                  type="button"
                  className="commander-picker-remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAt(i)
                  }}
                  aria-label={`Retirer ${name}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
