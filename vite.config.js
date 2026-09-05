import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Toute la configuration précédente — près de 300 lignes de plugin qui
 * servaient une API de fichiers JSON depuis le serveur de développement — a
 * disparu : les données vivent maintenant dans MariaDB et l'API Express les
 * sert. Il ne reste qu'un proxy.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // strictPort : sans lui, Vite prend le port suivant libre et l'URL du site
    // change d'un démarrage à l'autre. Mieux vaut un échec net.
    strictPort: true,
    proxy: {
      // Le front appelle /api/... en relatif : le proxy évite toute question de
      // CORS et de cookie inter-origines pendant le développement.
      '/api': { target: process.env.API_URL || 'http://localhost:3000', changeOrigin: false },
    },
  },
  preview: { port: 4173, strictPort: true },
  build: {
    // L'administration part dans son propre fichier (import dynamique dans
    // App.jsx) : un visiteur de la vitrine ne la télécharge jamais.
    chunkSizeWarningLimit: 900,
  },
})
