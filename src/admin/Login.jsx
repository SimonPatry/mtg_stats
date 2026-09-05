import { useState } from 'react'
import { api } from '../lib/api.js'
import { Link } from '../components/Link.jsx'

export function Login({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.login(password)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="admin-login" onSubmit={submit}>
      <h1>MagicAddicts</h1>
      <p>Administration</p>
      <label>
        <span className="field-label">Mot de passe</span>
        <input
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy || !password}>
        {busy ? 'Vérification…' : 'Entrer'}
      </button>

      <Link to="/" className="admin-login__back">
        ← Retour à la vitrine
      </Link>
    </form>
  )
}
