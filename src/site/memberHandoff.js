/** Intent : ouvrir l’espace membre depuis /admin (lu une fois sur la vitrine). */
export const OPEN_MEMBER_KEY = 'forge:openMember'

export function consumeOpenMemberIntent() {
  try {
    const view = sessionStorage.getItem(OPEN_MEMBER_KEY)
    if (!view) return null
    sessionStorage.removeItem(OPEN_MEMBER_KEY)
    return view === 'myDecks' ? 'myDecks' : 'dashboard'
  } catch {
    return null
  }
}
