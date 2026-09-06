import { hashPassword } from '../server/auth.js'

const password = process.argv[2]
if (!password) {
  console.error('Usage : npm run hash-password -- "mon mot de passe"')
  process.exit(1)
}

if (password.length < 8) {
  console.error('Le mot de passe doit faire au moins 8 caractères.')
  process.exit(1)
}

console.log('\nÀ coller dans .env (bootstrap admin si accounts vide) :\n')
console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}\n`)
