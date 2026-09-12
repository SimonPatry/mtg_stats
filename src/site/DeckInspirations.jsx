import { useEffect, useId, useState } from 'react'
import { fetchYoutubeTitle, isYoutubeUrl } from '../lib/youtubeTitle.js'

function hostnameFallback(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function InspirationLink({ item }) {
  const manual = String(item.label || '').trim()
  const [title, setTitle] = useState(null)

  useEffect(() => {
    if (manual || !isYoutubeUrl(item.url)) return undefined
    let cancelled = false
    fetchYoutubeTitle(item.url).then((next) => {
      if (!cancelled && next) setTitle(next)
    })
    return () => { cancelled = true }
  }, [item.url, manual])

  const text = manual || title || hostnameFallback(item.url)

  return (
    <a
      className="deck-inspirations__link"
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {text}
    </a>
  )
}

/**
 * Sources d’inspiration : masquées par défaut, révélées en douceur
 * dans la bande (pas de modal).
 */
export function DeckInspirations({ items = [] }) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const list = (items || []).filter((item) => item?.url)

  if (list.length === 0) return null

  return (
    <div className={`deck-inspirations${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="deck-inspirations__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="deck-inspirations__toggle-label">
          {open ? 'Masquer les sources' : 'Sources d’inspiration'}
        </span>
        <span className="deck-inspirations__chevron" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      <div className="deck-inspirations__panel" id={panelId}>
        <div className="deck-inspirations__panel-inner">
          <ul className="deck-inspirations__list">
            {list.map((item) => (
              <li key={item.url}>
                <InspirationLink item={item} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
