import { useState } from 'react'
import { api } from '../lib/api.js'
import { Link } from '../components/Link.jsx'

/**
 * Formulaire de connexion / inscription.
 * `mode`: 'login' | 'register'
 * `roleHint`: libellé (admin vs membre) — le rôle réel vient du serveur.
 */
export function Login({
  onSuccess,
  compact = false,
  mode: initialMode = 'login',
  allowRegister = false,
}) {
  const [mode, setMode] = useState(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isRegister = mode === 'register'

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = isRegister
        ? await api.register(username, password)
        : await api.login(username, password)
      onSuccess(session)
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className={`admin-login${compact ? ' admin-login--compact' : ''}`}
      onSubmit={submit}
    >
      {!compact && (
        <>
          <h1>Forge Arcanique</h1>
          <p>{isRegister ? 'Créer un compte' : 'Connexion'}</p>
        </>
      )}
      {compact && (
        <p className="admin-login__lead">
          {isRegister ? 'Inscription' : 'Connexion'}
        </p>
      )}
      <label>
        <span className="field-label">Identifiant</span>
        <input
          type="text"
          name="username"
          autoComplete="username"
          autoFocus={!compact}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          spellCheck={false}
        />
      </label>
      <label>
        <span className="field-label">Mot de passe</span>
        <input
          type="password"
          name="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy || !username || !password}>
        {busy ? 'Vérification…' : isRegister ? 'Créer le compte' : 'Entrer'}
      </button>

      {allowRegister && (
        <button
          type="button"
          className="admin-login__switch"
          onClick={() => {
            setMode(isRegister ? 'login' : 'register')
            setError('')
          }}
        >
          {isRegister ? 'Déjà un compte ? Connexion' : 'Pas de compte ? Inscription'}
        </button>
      )}

      {!compact && (
        <Link to="/" className="admin-login__back">
          ← Retour à la vitrine
        </Link>
      )}
    </form>
  )
}
