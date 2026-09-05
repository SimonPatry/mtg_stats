import { useEffect, useRef, useState } from 'react'
import { searchCards } from '../../scryfall.js'

/**
 * Champ de saisie d'un nom de carte, avec suggestions illustrées.
 *
 * Même principe que le sélecteur de commandant : on choisit dans une liste
 * plutôt que de taper à l'aveugle, et la vignette évite de se tromper entre
 * deux cartes au nom voisin — ce qui ne se verrait sinon qu'une fois le
 * carrousel publié sur la vitrine.
 */
export default function CardPicker({ value, onChange, placeholder = 'Nom de carte' }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const timer = useRef(null)
  const list = useRef(null)
  // Une recherche lente peut revenir après une plus récente : on ne garde que
  // la dernière lancée.
  const latest = useRef(0)

  useEffect(() => {
    clearTimeout(timer.current)
    if (!open) return undefined

    const term = value.trim()
    if (term.length < 2) {
      setSuggestions([])
      setLoading(false)
      return undefined
    }

    // 250 ms : Scryfall demande d'espacer les appels, et une requête par
    // frappe serait de toute façon inutile.
    setLoading(true)
    timer.current = setTimeout(async () => {
      const ticket = ++latest.current
      try {
        const cards = await searchCards(term)
        if (ticket !== latest.current) return
        setSuggestions(cards)
        setHighlight(-1)
      } catch {
        if (ticket === latest.current) setSuggestions([])
      } finally {
        if (ticket === latest.current) setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer.current)
  }, [value, open])

  // Le modal qui contient le champ défile : une liste qui s'ouvre vers le bas
  // dépasse son cadre et se retrouve coupée. On la ramène dans la zone visible
  // dès qu'elle a des résultats.
  useEffect(() => {
    if (suggestions.length > 0) {
      list.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [suggestions])

  function pick(name) {
    onChange(name)
    setOpen(false)
    setSuggestions([])
  }

  function onKeyDown(e) {
    // Échap se traite avant tout : même sans suggestion affichée, il ne doit
    // pas remonter jusqu'au modal qui contient le champ et le refermer en
    // emportant la saisie.
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
      return
    }
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(suggestions[highlight].name)
    }
  }

  const showList = open && (loading || suggestions.length > 0)

  return (
    <div className="card-picker">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        // Après un Échap le champ garde le focus : sans ce clic, la liste ne
        // pourrait plus être rouverte sans retaper quelque chose.
        onClick={() => setOpen(true)}
        // Un blur immédiat annulerait le clic sur une suggestion.
        onBlur={() => setTimeout(() => setOpen(false), 140)}
        onKeyDown={onKeyDown}
      />

      {showList && (
        <ul className="card-picker-suggestions" role="listbox" ref={list}>
          {loading && suggestions.length === 0 && (
            <li className="card-picker-status">Recherche…</li>
          )}
          {suggestions.map((card, i) => (
            <li key={card.name}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={`card-picker-option${i === highlight ? ' is-active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); pick(card.name) }}
              >
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt="" draggable={false} />
                ) : (
                  <span className="card-picker-option-fallback" />
                )}
                <span className="card-picker-option-text">{card.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
