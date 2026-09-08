/**
 * Wrapper Plesk / Phusion Passenger.
 * Passenger charge le fichier de démarrage via require() (CommonJS) ;
 * ce projet est en ESM ("type": "module"). On importe dynamiquement.
 *
 * Dans Plesk → Node.js → Fichier de démarrage : _passenger.cjs
 */
if (typeof PhusionPassenger !== 'undefined') {
  PhusionPassenger.configure({ autoInstall: false })
}

async function main() {
  await import('./app.js')
}

main().catch((err) => {
  console.error('Démarrage MagicAddicts échoué:', err)
  // Laisser le message dans les logs Passenger ; exit → page 500 HTML.
  process.exit(1)
})
