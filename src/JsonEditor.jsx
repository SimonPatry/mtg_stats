import { useEffect, useMemo, useState } from 'react'
import { BACKUP_REASON, listGameBackups, rollbackToBackup, saveGames } from './gamesApi'
import { listUserBackups, rollbackUsersBackup, saveUsers } from './usersApi'
import { listDeckBackups, rollbackDecksBackup, saveDecks } from './decksApi'
import {
  parseJsonText,
  tryParseJsonText,
  validateGamesEdit,
  validateUsersEdit,
  validateDecksEdit,
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
  { id: 'decks', label: 'Decks' },
]

function tabLabel(id) {
  return TABS.find((t) => t.id === id)?.label ?? id
}

function backupLink(name) {
  return `/api/backup-file?name=${encodeURIComponent(name)}`
}

export default function JsonEditor({
  games,
  users,
  decks,
  onSaveGames,
  onSaveUsers,
  onSaveDecks,
  onCancel,
}) {
  const [tab, setTab] = useState('games')
  const [gamesText, setGamesText] = useState(() => formatJson(games))
  const [usersText, setUsersText] = useState(() => formatJson(users))
  const [decksText, setDecksText] = useState(() => formatJson(decks))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [rollingBack, setRollingBack] = useState(null)
  const [backupInfo, setBackupInfo] = useState('')
  const [backups, setBackups] = useState([])

  const texts = { games: gamesText, users: usersText, decks: decksText }
  const setTexts = {
    games: setGamesText,
    users: setUsersText,
    decks: setDecksText,
  }
  const sources = { games, users, decks }

  const text = texts[tab]
  const setText = setTexts[tab]

  const dirty = {
    games: gamesText !== formatJson(games),
    users: usersText !== formatJson(users),
    decks: decksText !== formatJson(decks),
  }
  const anyDirty = dirty.games || dirty.users || dirty.decks

  const syntaxStatus = useMemo(() => tryParseJsonText(text), [text])

  async function refreshBackups(kind = tab) {
    if (kind === 'games') setBackups(await listGameBackups())
    else if (kind === 'users') setBackups(await listUserBackups())
    else setBackups(await listDeckBackups())
  }

  useEffect(() => {
    refreshBackups(tab)
  }, [tab])

  useEffect(() => {
    setGamesText(formatJson(games))
    setError('')
  }, [games])

  useEffect(() => {
    setUsersText(formatJson(users))
    setError('')
  }, [users])

  useEffect(() => {
    setDecksText(formatJson(decks))
    setError('')
  }, [decks])

  function confirmLeaveDirty(nextTab) {
    if (nextTab === tab) return true
    if (!dirty[tab]) return true
    return window.confirm(
      `Le JSON « ${tabLabel(tab)} » a été modifié et n’est pas sauvegardé.\n\nQuitter cet onglet quand même ? Les changements non sauvegardés resteront en mémoire tant que tu ne réinitialises pas, mais tu risques de les oublier.`,
    )
  }

  function handleTab(nextTab) {
    if (!confirmLeaveDirty(nextTab)) return
    setTab(nextTab)
    setError('')
    setBackupInfo('')
  }

  function handleReset() {
    setText(formatJson(sources[tab]))
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
          await refreshBackups('games')
        }
      } catch (err) {
        setError(err.message || 'Impossible de sauvegarder')
      } finally {
        setSaving(false)
      }
      return
    }

    if (tab === 'users') {
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
        const result = await saveUsers(parsed, users, {
          reason: BACKUP_REASON.MANUAL_EDIT,
        })
        onSaveUsers(parsed)
        if (result?.backupFile) {
          setBackupInfo(result.backupFile)
          await refreshBackups('users')
        }
      } catch (err) {
        setError(err.message || 'Impossible de sauvegarder les joueurs')
      } finally {
        setSaving(false)
      }
      return
    }

    let parsed
    try {
      parsed = parseJsonText(decksText, 'Decks')
      validateDecksEdit(decks, parsed)
    } catch (err) {
      setError(err.message)
      return
    }

    setSaving(true)
    try {
      const result = await saveDecks(parsed, decks, {
        reason: BACKUP_REASON.MANUAL_EDIT,
      })
      onSaveDecks(parsed)
      if (result?.backupFile) {
        setBackupInfo(result.backupFile)
        await refreshBackups('decks')
      }
    } catch (err) {
      setError(err.message || 'Impossible de sauvegarder les decks')
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
      if (tab === 'games') {
        const { restored, backupFile } = await rollbackToBackup(name, games)
        onSaveGames(restored)
        if (backupFile) setBackupInfo(backupFile)
      } else if (tab === 'users') {
        const { restored, backupFile } = await rollbackUsersBackup(name, users)
        onSaveUsers(restored)
        if (backupFile) setBackupInfo(backupFile)
      } else {
        const { restored, backupFile } = await rollbackDecksBackup(name, decks)
        onSaveDecks(restored)
        if (backupFile) setBackupInfo(backupFile)
      }
      await refreshBackups(tab)
    } catch (err) {
      setError(err.message || 'Impossible de restaurer')
    } finally {
      setRollingBack(null)
    }
  }

  const busy = saving || rollingBack !== null

  const hints = {
    games: (
      <>
        À chaque sauvegarde, l&apos;état <strong>avant</strong> modification est
        copié dans <code>backups/</code> (
        <code>games_*.json</code>). Les <strong>id</strong> de parties et les{' '}
        <strong>deckId</strong> déjà présents ne peuvent ni être supprimés ni
        modifiés ; de nouvelles parties peuvent être ajoutées.
      </>
    ),
    users: (
      <>
        À chaque sauvegarde, backup auto dans <code>backups/</code> (
        <code>users_*.json</code>). Les <strong>id</strong> de joueurs déjà
        présents ne peuvent ni être supprimés ni modifiés ; de nouveaux joueurs
        peuvent être ajoutés.
      </>
    ),
    decks: (
      <>
        À chaque sauvegarde, backup auto dans <code>backups/</code> (
        <code>decks_*.json</code>). Les <strong>id</strong>,{' '}
        <strong>userId</strong> et <strong>previousDeckId</strong> déjà présents
        ne peuvent ni être supprimés ni modifiés ; de nouveaux decks peuvent être
        ajoutés.
      </>
    ),
  }

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
                  dirty[id] ? ' is-dirty' : ''
                }`}
                onClick={() => handleTab(id)}
              >
                {label}
                {dirty[id] ? ' •' : ''}
              </button>
            ))}
          </div>
          <p className="json-editor-hint">{hints[tab]}</p>
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
                if (anyDirty) {
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
      {backupInfo && (
        <p className="json-editor-success">
          Backup pré-modification créé :{' '}
          <a href={backupLink(backupInfo)} target="_blank" rel="noreferrer">
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
                    <a href={backupLink(name)} target="_blank" rel="noreferrer">
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
