export default function NumberStepper({ value, onChange, min = 0, max, step = 1, ...rest }) {
  function clamp(n) {
    let next = n
    if (max != null) next = Math.min(max, next)
    return Math.max(min, next)
  }

  function bump(delta) {
    onChange(clamp((Number(value) || 0) + delta))
  }

  function handleChange(e) {
    const raw = e.target.value
    if (raw === '') {
      onChange(min)
      return
    }
    const n = Number.parseInt(raw, 10)
    onChange(Number.isNaN(n) ? min : clamp(n))
  }

  return (
    <div className="number-stepper">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        {...rest}
      />
      <div className="number-stepper-spin">
        <button
          type="button"
          className="number-stepper-btn"
          tabIndex={-1}
          aria-label="Augmenter"
          onClick={() => bump(step)}
        >
          ▲
        </button>
        <button
          type="button"
          className="number-stepper-btn"
          tabIndex={-1}
          aria-label="Diminuer"
          disabled={value <= min}
          onClick={() => bump(-step)}
        >
          ▼
        </button>
      </div>
    </div>
  )
}
