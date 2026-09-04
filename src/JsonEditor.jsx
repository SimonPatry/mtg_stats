import { useEffect, useMemo, useState } from 'react'
import { BACKUP_REASON, listGameBackups, rollbackToBackup, saveGames } from './gamesApi'
import { saveUsers } from './usersApi'
import {
  parseJsonText,
  tryParseJsonText,
  validateGamesEdit,
  validateUsersEdit,
} from './jsonGuard'

function formatJson(data) {
  return `${JSON.stringify(data, null, 2)}\n`
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

const TABS = [
  { id: 'games', label: 'Parties' },
  { id: 'users', label: 'Joueurs' },
]

export default function JsonEditor({ games, users, onSaveGames, onSaveUsers, onCancel }) {
  const [tab, setTab] = useState('games')
  const [gamesText, setGamesText] = useState(() => formatJson(games))
  const [usersText, setUsersText] = useState(() => formatJson(users))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [rollingBack, setRollingBack] = useState(null)
  const [backupInfo, setBackupInfo] = useState('')
  const [backups, setBackups] = useState([])

  const text = tab === 'games' ? gamesText : usersText
  const setText = tab === 'games' ? setGamesText : setUsersText

  const gamesDirty = gamesText !== formatJson(games)
  const usersDirty = usersText !== formatJson(users)
  const currentDirty = tab === 'games' ? gamesDirty : usersDirty

  const syntaxStatus = useMemo(() => tryParseJsonText(text), [text])

  async function refreshBackups() {
    setBackups(await listGameBackups())
  }

  useEffect(() => {
    refreshBackups()
  }, [])

  useEffect(() => {
    setGamesText(formatJson(games))
    setError('')
  }, [games])

  useEffect(() => {
    setUsersText(formatJson(users))
    setError('')
  }, [users])

  function confirmLeaveDirty(nextTab) {
    if (nextTab === tab) return true
    const leavingDirty = tab === 'games' ? gamesDirty : usersDirty
    if (!leavingDirty) return true
    return window.confirm(
      `Le JSON « ${tab === 'games' ? 'Parties' : 'Joueurs'} » a été modifié et n’est pas sauvegardé.\n\nQuitter cet onglet quand même ? Les changements non sauvegardés resteront en mémoire tant que tu ne réinitialises pas, mais tu risques de les oublier.`,
    )
  }

  function handleTab(nextTab) {
    if (!confirmLeaveDirty(nextTab)) return
    setTab(nextTab)
    setError('')
    setBackupInfo('')
  }

  function handleReset() {
    if (tab === 'games') {
      setGamesText(formatJson(games))
    } else {
      setUsersText(formatJson(users))
    }
    setError('')
    setBackupInfo('')
  }

  async function handleSave() {
    setError('')
    setBackupInfo('')

    if (tab === 'games') {
      let parsed
      try {
        parsed = parseJsonText(gamesText, 'Parties')
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
        onSaveGames(parsed)
        if (result?.backupFile) {
          setBackupInfo(result.backupFile)
          await refreshBackups()
        }
      } catch (err) {
        setError(err.message || 'Impossible de sauvegarder')
      } finally {
        setSaving(false)
      }
      return
    }

    let parsed
    try {
      parsed = parseJsonText(usersText, 'Joueurs')
      validateUsersEdit(users, parsed)
    } catch (err) {
      setError(err.message)
      return
    }

    setSaving(true)
    try {
      await saveUsers(parsed)
      onSaveUsers(parsed)
    } catch (err) {
      setError(err.message || 'Impossible de sauvegarder les joueurs')
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
      onSaveGames(restored)
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
          <div className="json-editor-tabs" role="tablist" aria-label="Fichier JSON">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`btn btn-tab${tab === id ? ' is-active' : ''}${
                  (id === 'games' ? gamesDirty : usersDirty) ? ' is-dirty' : ''
                }`}
                onClick={() => handleTab(id)}
              >
                {label}
                {(id === 'games' ? gamesDirty : usersDirty) ? ' •' : ''}
              </button>
            ))}
          </div>
          <p className="json-editor-hint">
            {tab === 'games' ? (
              <>
                À chaque sauvegarde, l&apos;état <strong>avant</strong> modification
                est copié dans <code>public/backups/</code>. Les{' '}
                <strong>id</strong> de parties et les <strong>deckId</strong> déjà
                présents ne peuvent ni être supprimés ni modifiés ; de nouvelles
                parties peuvent être ajoutées.
              </>
            ) : (
              <>
                Édition de <code>users.json</code>. Les <strong>id</strong> de
                joueurs déjà présents ne peuvent ni être supprimés ni modifiés ;
                de nouveaux joueurs peuvent être ajoutés.
              </>
            )}
          </p>
        </div>
        <div className="json-editor-actions">
          <button type="button" className="btn btn-ghost" onClick={handleReset}>
            Réinitialiser
          </button>
          {onCancel && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (currentDirty || (tab === 'games' ? usersDirty : gamesDirty)) {
                  const ok = window.confirm(
                    'Des modifications JSON non sauvegardées existent. Quitter quand même ?',
                  )
                  if (!ok) return
                }
                onCancel()
              }}
            >
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
      {backupInfo && tab === 'games' && (
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

        {tab === 'games' ? (
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
        ) : (
          <aside className="json-editor-backups">
            <h3>Joueurs</h3>
            <p className="json-editor-backups-empty">
              Pas de backups automatiques pour les joueurs. Vérifie bien avant
              de sauvegarder.
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}
