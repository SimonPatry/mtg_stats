import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * Filtre tags vitrine : recherche + suggestions, pastilles sélectionnées
 * en vert. Optionnellement, réafficher toute la liste (checkbox).
 */
export default function VitrineTagFilter({
  tags = [],
  value = [],
  onChange,
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = value.map(String)
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const hasSelection = selected.length > 0

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return tags
      .filter((tag) => {
        const key = String(tag)
        if (selectedSet.has(key)) return false
        return key.toLowerCase().includes(needle)
      })
      .slice(0, 12)
  }, [tags, query, selectedSet])

  const chips = showAll ? tags : value

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function add(tag) {
    const key = String(tag)
    if (selectedSet.has(key)) return
    onChange([...value, tag])
    setQuery('')
    setOpen(false)
  }

  function toggle(tag) {
    const key = String(tag)
    if (selectedSet.has(key)) {
      onChange(value.filter((t) => String(t) !== key))
    } else {
      onChange([...value, tag])
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = suggestions[activeIndex]
      if (pick != null) add(pick)
    }
  }

  if (!tags.length) return null

  return (
    <div className="vitrine-tag-filter" ref={rootRef}>
      <div className="vitrine-tag-filter__toolbar">
        <label className="vitrine-tag-filter__show-all">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          <span>Afficher tous les tags</span>
        </label>
        {hasSelection ? (
          <button
            type="button"
            className="tag-filter__clear"
            onClick={() => onChange([])}
          >
            Retirer les tags
          </button>
        ) : null}
      </div>

      <div className="vitrine-tag-filter__search">
        <input
          type="search"
          className="deck-menu__search-input"
          placeholder="Rechercher un tag…"
          aria-label="Rechercher un tag"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && suggestions.length > 0}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {open && query.trim() && (
          <ul
            id={listId}
            className="vitrine-tag-filter__suggest"
            role="listbox"
            aria-label="Tags correspondants"
          >
            {suggestions.length === 0 ? (
              <li className="vitrine-tag-filter__suggest-empty" role="option" aria-disabled="true">
                Aucun tag
              </li>
            ) : (
              suggestions.map((tag, i) => (
                <li key={tag} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    className={`vitrine-tag-filter__suggest-item${i === activeIndex ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => add(tag)}
                  >
                    {tag}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {chips.length > 0 ? (
        <div className="tag-filter__row" role="group" aria-label="Tags">
          {chips.map((tag) => {
            const on = selectedSet.has(String(tag))
            return (
              <button
                key={tag}
                type="button"
                className={`tag-filter__chip${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(tag)}
              >
                {tag}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
