import { hashPassword } from '../server/auth.js'

const password = process.argv[2]
if (!password) {
  console.error('Usage : npm run hash-password -- "mon mot de passe"')
  process.exit(1)
}

console.log('\nÀ coller dans .env :\n')
console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}\n`)
