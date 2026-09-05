import ColorPicker from './ColorPicker.jsx'
import TagPicker from './TagPicker.jsx'

/**
 * Bloc « vitrine » du formulaire de création d'un deck.
 *
 * Replié derrière une case à cocher : la grande majorité des decks saisis ne
 * servent qu'aux statistiques, et le formulaire doit rester court pour eux.
 * Les carrousels ne sont pas ici — ils prennent trop de place à la création et
 * s'ajoutent ensuite depuis l'édition du deck.
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
          <small>
            Le deck rejoint la vitrine publique, en tête de page — les decks
            affichés sont classés du plus récent au plus ancien.
          </small>
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
              rows={4}
              maxLength={5000}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Entre crochets, [Sol Ring] devient une carte survolable."
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
            <span className="form-field-label">Tags</span>
            <TagPicker
              value={value.tagIds}
              onChange={(next) => set({ tagIds: next })}
              tags={tags}
              onTagsChange={onTagsChange}
            />
          </div>

          <p className="form-hint">
            Les carrousels s’ajoutent après création, depuis l’édition du deck.
          </p>
        </div>
      )}
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
})
