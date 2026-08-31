import { Children, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function useMobileSelect() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 768px)').matches
      : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setMobile(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return mobile
}

function optionLabel(children) {
  if (children == null || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }
  if (Array.isArray(children)) {
    return children.map(optionLabel).join('')
  }
  return optionLabel(children.props?.children)
}

function collectOptions(children) {
  const items = []
  Children.forEach(children, (child) => {
    if (!child || child.type !== 'option') return
    items.push({
      value: child.props.value ?? '',
      label: optionLabel(child.props.children),
      disabled: Boolean(child.props.disabled),
    })
  })
  return items
}

function MobileSelectSheet({ title, options, value, onPick, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="native-select-sheet-backdrop" onClick={onClose}>
      <div
        className="native-select-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Choisir une option'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="native-select-sheet-header">
          <div className="native-select-sheet-handle" aria-hidden />
          {title ? <p className="native-select-sheet-title">{title}</p> : null}
        </div>
        <ul className="native-select-sheet-list">
          {options.map((opt) => (
            <li key={`${opt.value}::${opt.label}`}>
              <button
                type="button"
                className={`native-select-sheet-option${
                  opt.value === value ? ' is-selected' : ''
                }${opt.disabled ? ' is-disabled' : ''}`}
                disabled={opt.disabled}
                onClick={() => {
                  if (opt.disabled) return
                  onPick(opt.value)
                  onClose()
                }}
              >
                {opt.label || '—'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Native `<select>` on desktop; full-height bottom sheet with vertical scroll on mobile.
 */
export default function Select({
  children,
  className = '',
  value,
  onChange,
  disabled,
  required,
  id,
  ...rest
}) {
  const mobile = useMobileSelect()
  const [open, setOpen] = useState(false)
  const [sheetTitle, setSheetTitle] = useState('')
  const triggerRef = useRef(null)
  const options = useMemo(() => collectOptions(children), [children])

  const selected = options.find((opt) => opt.value === value)
  const displayLabel = selected?.label || options.find((o) => o.value === '')?.label || '—'

  function emit(nextValue) {
    onChange?.({ target: { value: nextValue } })
  }

  if (!mobile) {
    return (
      <select
        id={id}
        className={className}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        {...rest}
      >
        {children}
      </select>
    )
  }

  const title =
    sheetTitle ||
    triggerRef.current?.closest('label')?.querySelector('span')?.textContent?.trim() ||
    ''

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`native-select-trigger${className ? ` ${className}` : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return
          const label =
            triggerRef.current
              ?.closest('label')
              ?.querySelector('span')
              ?.textContent?.trim() || ''
          setSheetTitle(label)
          setOpen(true)
        }}
      >
        <span className="native-select-trigger-label">{displayLabel}</span>
        <span className="native-select-trigger-chevron" aria-hidden />
      </button>
      {/* Hidden select keeps form validation semantics */}
      <select
        className="native-select-hidden"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        required={required}
        disabled={disabled}
        onChange={() => {}}
      >
        {children}
      </select>
      {open ? (
        <MobileSelectSheet
          title={title}
          options={options}
          value={value}
          onPick={emit}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
