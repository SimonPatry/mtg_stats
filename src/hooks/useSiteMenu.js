import { createStore } from '../lib/store.js'

/** Ouverture du menu latéral Forge — partagée entre vitrine et /admin. */
const store = createStore(false)

export function useSiteMenu() {
  const menuOpen = store.use()
  return {
    menuOpen,
    setMenuOpen: (next) => store.set(next),
    toggleMenu: () => store.set((open) => !open),
    closeMenu: () => store.set(false),
  }
}
