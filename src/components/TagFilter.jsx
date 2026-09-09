/**
 * Pastilles de filtre par tags (labels).
 * Clic = activer / désactiver. Aucune création — vocabulaire fourni par le parent.
 */
export default function TagFilter({
  tags = [],
  value = [],
  onChange,
  label = 'Tags',
}) {
  if (!tags.length) return null

  const selected = value.map(String)

  function toggle(tag) {
    const key = String(tag)
    if (selected.includes(key)) {
      onChange(value.filter((t) => String(t) !== key))
    } else {
      onChange([...value, tag])
    }
  }

  return (
    <div className="tag-filter">
      {label ? <span className="tag-filter__label">{label}</span> : null}
      <div className="tag-filter__row" role="group" aria-label={label || 'Tags'}>
        {tags.map((tag) => {
          const on = selected.includes(String(tag))
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
    </div>
  )
}

/** Liste unique de labels triée, depuis des decks `{ tags: string[] }`. */
export function collectTagLabels(decks) {
  const set = new Set()
  for (const deck of decks ?? []) {
    for (const tag of deck.tags ?? []) {
      if (tag) set.add(tag)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
}

/** OR : le deck doit porter au moins un des tags sélectionnés. */
export function matchesSelectedTags(deckTags, selectedTags) {
  if (!selectedTags?.length) return true
  const have = new Set((deckTags ?? []).map(String))
  return selectedTags.some((t) => have.has(String(t)))
}
