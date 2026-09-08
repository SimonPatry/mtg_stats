/**
 * Wrapper Plesk / Phusion Passenger.
 * Passenger charge le fichier de démarrage via require() (CommonJS) ;
 * ce projet est en ESM ("type": "module"). On importe dynamiquement.
 *
 * Dans Plesk → Node.js → Fichier de démarrage : _passenger.cjs
 */
async function main() {
  await import('./app.js')
}

main().catch((err) => {
  console.error('Démarrage MagicAddicts échoué:', err)
  process.exit(1)
})
