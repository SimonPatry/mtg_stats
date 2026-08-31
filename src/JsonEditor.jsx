import { useEffect, useMemo, useState } from 'react'
import { BACKUP_REASON, listGameBackups, rollbackToBackup, saveGames } from './gamesApi'
import { parseJsonText, tryParseJsonText, validateGamesEdit } from './jsonGuard'

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
  const [rollingBack, setRollingBack] = useState(null)
  const [backupInfo, setBackupInfo] = useState('')
  const [backups, setBackups] = useState([])

  const syntaxStatus = useMemo(() => tryParseJsonText(text), [text])

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
      parsed = parseJsonText(text, 'Parties')
      validateGamesEdit(games, parsed)
    } catch (err) {
      setError(err.message)
      return
    }

    setSaving(true)
    try {
      const result = await saveGames(parsed, games, {
        reason: BACKUP_REASON.MANUAL_EDIT,
      })
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

  async function handleRollback(name) {
    const ok = window.confirm(
      `Restaurer « ${name} » ?\n\nL'état actuel sera sauvegardé avant le rollback.`,
    )
    if (!ok) return

    setError('')
    setBackupInfo('')
    setRollingBack(name)

    try {
      const { restored, backupFile } = await rollbackToBackup(name, games)
      onSave(restored)
      if (backupFile) {
        setBackupInfo(backupFile)
      }
      await refreshBackups()
    } catch (err) {
      setError(err.message || 'Impossible de restaurer')
    } finally {
      setRollingBack(null)
    }
  }

  const busy = saving || rollingBack !== null

  return (
    <div className="json-editor">
      <div className="json-editor-header">
        <div>
          <h2>Édition JSON</h2>
          <p className="json-editor-hint">
            À chaque sauvegarde, l&apos;état <strong>avant</strong> modification
            est copié dans <code>public/backups/</code>. Les{' '}
            <strong>id</strong> de parties et les <strong>deckId</strong> déjà
            présents ne peuvent ni être supprimés ni modifiés ; de nouvelles
            parties peuvent être ajoutées.
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
            disabled={busy}
          >
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {error && <p className="json-editor-error">{error}</p>}
      <p
        className={
          syntaxStatus.ok ? 'json-editor-syntax-ok' : 'json-editor-syntax-bad'
        }
      >
        {syntaxStatus.ok ? 'Syntaxe JSON valide.' : syntaxStatus.error}
      </p>
      {backupInfo && (
        <p className="json-editor-success">
          Backup pré-modification créé :{' '}
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
                  <div className="json-editor-backup-row">
                    <a href={`/backups/${name}`} target="_blank" rel="noreferrer">
                      {name}
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost btn-backup-restore"
                      onClick={() => handleRollback(name)}
                      disabled={busy}
                      title="Restaurer cette sauvegarde"
                    >
                      {rollingBack === name ? '…' : '↩'}
                    </button>
                  </div>
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
