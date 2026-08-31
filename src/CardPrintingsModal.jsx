import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchAllPrintings } from './scryfall'

function formatReleaseDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function CardPrintingsModal({
  cardName,
  selectedScryfallId,
  onSelect,
  onClose,
}) {
  const [printings, setPrintings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setPrintings([])

    fetchAllPrintings(cardName)
      .then((data) => {
        if (!cancelled) setPrintings(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Erreur Scryfall')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [cardName])

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
    <div className="modal-backdrop printings-modal-backdrop" onClick={onClose}>
      <div
        className="modal printings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="printings-modal-title"
        aria-modal="true"
      >
        <div className="modal-header">
          <div>
            <h2 id="printings-modal-title">{cardName}</h2>
            {!loading && !error && (
              <p className="printings-modal-count">
                {printings.length} version{printings.length !== 1 ? 's' : ''} — clique
                pour sélectionner
              </p>
            )}
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        {loading && <p className="printings-modal-status">Chargement…</p>}
        {error && <p className="printings-modal-error">{error}</p>}

        {!loading && !error && printings.length === 0 && (
          <p className="printings-modal-status">Aucune version trouvée.</p>
        )}

        {!loading && !error && printings.length > 0 && (
          <div className="printings-grid">
            {printings.map((printing) => {
              const isSelected = printing.id === selectedScryfallId
              return (
                <button
                  key={printing.id}
                  type="button"
                  className={`printing-card${isSelected ? ' is-selected' : ''}`}
                  onClick={() => onSelect(printing)}
                  title={`${printing.setName} (${printing.setCode})`}
                >
                  {printing.imageUrl ? (
                    <img src={printing.imageUrl} alt="" draggable={false} loading="lazy" />
                  ) : (
                    <div className="printing-card-fallback">?</div>
                  )}
                  <div className="printing-card-meta">
                    <strong>{printing.setName}</strong>
                    <span>
                      {printing.setCode} · #{printing.collectorNumber}
                    </span>
                    <span>{formatReleaseDate(printing.releasedAt)}</span>
                    {printing.lang !== 'en' && (
                      <span className="printing-card-tag">{printing.lang.toUpperCase()}</span>
                    )}
                    {printing.promo && (
                      <span className="printing-card-tag">Promo</span>
                    )}
                    {isSelected && <span className="printing-card-selected">Sélectionnée</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
