import { useEffect, useState } from 'react'
import { listGameBackups, saveGames } from './gamesApi'

function formatJson(games) {
  return `${JSON.stringify(games, null, 2)}\n`
}

function formatBackupDate(mtime) {
  return new Date(mtime).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function JsonEditor({ games, onSave, onCancel }) {
  const [text, setText] = useState(() => formatJson(games))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [backupInfo, setBackupInfo] = useState('')
  const [backups, setBackups] = useState([])

  async function refreshBackups() {
    setBackups(await listGameBackups())
  }

  useEffect(() => {
    refreshBackups()
  }, [])

  useEffect(() => {
    setText(formatJson(games))
    setError('')
  }, [games])

  function handleReset() {
    setText(formatJson(games))
    setError('')
    setBackupInfo('')
  }

  async function handleSave() {
    setError('')
    setBackupInfo('')

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      setError(`JSON invalide : ${err.message}`)
      return
    }

    if (!Array.isArray(parsed)) {
      setError('Le JSON doit être un tableau de parties.')
      return
    }

    setSaving(true)
    try {
      const result = await saveGames(parsed, games)
      onSave(parsed)
      if (result?.backupFile) {
        setBackupInfo(result.backupFile)
        await refreshBackups()
      }
    } catch (err) {
      setError(err.message || 'Impossible de sauvegarder')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="json-editor">
      <div className="json-editor-header">
        <div>
          <h2>Édition JSON</h2>
          <p className="json-editor-hint">
            À chaque sauvegarde, l&apos;état <strong>avant</strong> modification
            est copié dans{' '}
            <code>public/backups/</code> (accessible via{' '}
            <code>/backups/nom-du-fichier.json</code>).
          </p>
        </div>
        <div className="json-editor-actions">
          <button type="button" className="btn btn-ghost" onClick={handleReset}>
            Réinitialiser
          </button>
          {onCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Retour
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {error && <p className="json-editor-error">{error}</p>}
      {backupInfo && (
        <p className="json-editor-success">
          Backup pré-édition créé :{' '}
          <a href={`/backups/${backupInfo}`} target="_blank" rel="noreferrer">
            {backupInfo}
          </a>
        </p>
      )}

      <div className="json-editor-body">
        <textarea
          className="json-editor-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />

        <aside className="json-editor-backups">
          <h3>Sauvegardes</h3>
          {backups.length === 0 ? (
            <p className="json-editor-backups-empty">
              Aucune sauvegarde pour l&apos;instant.
            </p>
          ) : (
            <ul className="json-editor-backups-list">
              {backups.map(({ name, mtime }) => (
                <li key={name}>
                  <a href={`/backups/${name}`} target="_blank" rel="noreferrer">
                    {name}
                  </a>
                  <span>{formatBackupDate(mtime)}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
