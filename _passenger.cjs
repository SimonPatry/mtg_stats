/**
 * Wrapper Plesk / Phusion Passenger (CommonJS → ESM).
 * Fichier de démarrage Plesk : _passenger.cjs
 *
 * En cas d'échec, lit httpdocs/passenger-boot.log (Gestionnaire de fichiers).
 */
const fs = require('fs')
const path = require('path')

const logFile = path.join(__dirname, 'passenger-boot.log')

function log(message, err) {
  const line =
    new Date().toISOString() +
    ' ' +
    message +
    (err ? '\n' + (err.stack || String(err)) : '') +
    '\n'
  try {
    fs.appendFileSync(logFile, line)
  } catch {
    console.error(line)
  }
  console.error(line)
}

log('boot: start, cwd=' + process.cwd() + ' node=' + process.version)

try {
  if (typeof PhusionPassenger !== 'undefined') {
    PhusionPassenger.configure({ autoInstall: false })
    log('boot: PhusionPassenger configured')
  } else {
    log('boot: PhusionPassenger absent (hors Passenger ?)')
  }
} catch (err) {
  log('boot: configure failed', err)
}

import('./app.js')
  .then(() => {
    log('boot: app.js importé OK')
  })
  .catch((err) => {
    log('boot: ÉCHEC import app.js', err)
    process.exit(1)
  })
