/**
 * Le code source de mtg_stats utilise des imports relatifs sans extension
 * (`import { x } from './gamesApi'`). Vite les résout, Node non.
 *
 * Plutôt que de modifier le code qu'on veut justement tester tel quel, on
 * ajoute l'extension à la volée. À retirer le jour où les imports seront
 * complétés dans les sources.
 */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return next(`${specifier}.js`, context)
    }
    throw err
  }
}
