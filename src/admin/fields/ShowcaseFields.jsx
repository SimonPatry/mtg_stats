import ColorPicker from './ColorPicker.jsx'
import TagPicker from './TagPicker.jsx'
import SliderEditor from './SliderEditor.jsx'

/**
 * Bloc « vitrine » du formulaire de création / édition d'un deck.
 *
 * Tags toujours visibles : on peut les poser sans déplier toute la vitrine.
 * Titre, description, couleurs et carrousels apparaissent dès que la case
 * « Afficher sur le site » est cochée.
 */
export default function ShowcaseFields({ value, onChange, tags, onTagsChange, colors }) {
  const set = (patch) => onChange({ ...value, ...patch })

  return (
    <fieldset className="showcase-fields">
      <label className="form-check">
        <input
          type="checkbox"
          checked={value.showcase}
          onChange={(e) => set({ showcase: e.target.checked })}
        />
        <span>
          <strong>Afficher sur le site</strong>
          <small>Vitrine publique, du plus récent au plus ancien.</small>
        </span>
      </label>

      {value.showcase && (
        <div className="showcase-fields-body">
          <label className="form-field">
            <span>Titre affiché *</span>
            <input
              type="text"
              value={value.name}
              maxLength={120}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Le Jardin de Zimone"
            />
          </label>

          <label className="form-field">
            <span>Description</span>
            <textarea
              value={value.description}
              rows={2}
              maxLength={5000}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="[Sol Ring] devient une carte survolable."
            />
          </label>

          <div className="form-field">
            <span className="form-field-label">Couleurs</span>
            <ColorPicker
              value={value.colors}
              onChange={(next) => set({ colors: next })}
              colors={colors}
            />
          </div>

          <div className="form-field">
            <span className="form-field-label">Carrousels</span>
            <SliderEditor
              sections={value.slider ?? []}
              onChange={(slider) => set({ slider })}
            />
          </div>
        </div>
      )}

      <div className="form-field showcase-tags">
        <span className="form-field-label">Tags</span>
        <TagPicker
          value={value.tagIds}
          onChange={(next) => set({ tagIds: next })}
          tags={tags}
          onTagsChange={onTagsChange}
        />
      </div>
    </fieldset>
  )
}

/** État initial du bloc, partagé par les deux formulaires d'ajout. */
export const emptyShowcase = () => ({
  showcase: false,
  name: '',
  description: '',
  colors: [],
  tagIds: [],
  slider: [],
})
