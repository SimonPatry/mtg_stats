/** Petites aides communes aux routes. */

/** Renvoie les erreurs Zod champ par champ, dans la forme qu'attendent les formulaires. */
export function invalid(res, result) {
  const flat = result.error.flatten()
  return res.status(400).json({
    error: 'Données invalides',
    fields: flat.fieldErrors,
    form: flat.formErrors,
  })
}

/**
 * Enrobe un gestionnaire asynchrone : sans ça, une promesse rejetée dans une
 * route Express 5 remonte silencieusement au lieu d'atteindre le gestionnaire
 * d'erreurs.
 */
export const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/** Valide le corps de la requête, ou répond 400 et rend null. */
export function parseBody(schema, req, res) {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    invalid(res, result)
    return null
  }
  return result.data
}
