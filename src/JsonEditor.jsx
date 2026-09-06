import { useEffect, useMemo, useState } from 'react'
import { saveGames } from './gamesApi'
import { saveUsers } from './usersApi'
import { saveDecks } from './decksApi'
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

const TABS = [
  { id: 'games', label: 'Parties' },
  { id: 'users', label: 'Joueurs' },
  { id: 'decks', label: 'Decks' },
]

function tabLabel(id) {
  return TABS.find((t) => t.id === id)?.label ?? id
}

/**
 * Édition brute des collections (admin). Les changements passent par l’API
 * comme le reste du catalogue — plus de backups fichiers.
 */
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
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

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
      `Le JSON « ${tabLabel(tab)} » a été modifié et n’est pas sauvegardé.\n\nQuitter cet onglet quand même ?`,
    )
  }

  function handleTab(nextTab) {
    if (!confirmLeaveDirty(nextTab)) return
    setTab(nextTab)
    setError('')
    setSuccess('')
  }

  function handleReset() {
    setText(formatJson(sources[tab]))
    setError('')
    setSuccess('')
  }

  async function handleSave() {
    setError('')
    setSuccess('')

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
        const userIdByName = new Map(users.map((u) => [u.name, u.id]))
        await saveGames(parsed, games, { userIdByName })
        await onSaveGames(parsed)
        setSuccess('Parties enregistrées.')
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
        await saveUsers(parsed, users)
        await onSaveUsers(parsed)
        setSuccess('Joueurs enregistrés.')
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
      await saveDecks(parsed, decks)
      await onSaveDecks(parsed)
      setSuccess('Decks enregistrés.')
    } catch (err) {
      setError(err.message || 'Impossible de sauvegarder les decks')
    } finally {
      setSaving(false)
    }
  }

  const hints = {
    games: (
      <>
        Les <strong>id</strong> de parties et les <strong>deckId</strong> déjà
        présents ne peuvent ni être supprimés ni modifiés. De nouvelles parties
        peuvent être ajoutées.
      </>
    ),
    users: (
      <>
        Les <strong>id</strong> de joueurs déjà présents ne peuvent ni être
        supprimés ni modifiés ; de nouveaux joueurs peuvent être ajoutés.
      </>
    ),
    decks: (
      <>
        Les <strong>id</strong>, <strong>userId</strong> et{' '}
        <strong>previousDeckId</strong> déjà présents ne peuvent ni être
        supprimés ni modifiés ; de nouveaux decks peuvent être ajoutés.
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
            disabled={saving}
          >
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {error && <p className="json-editor-error">{error}</p>}
      {success && <p className="json-editor-success">{success}</p>}
      <p
        className={
          syntaxStatus.ok ? 'json-editor-syntax-ok' : 'json-editor-syntax-bad'
        }
      >
        {syntaxStatus.ok ? 'Syntaxe JSON valide.' : syntaxStatus.error}
      </p>

      <div className="json-editor-body">
        <textarea
          className="json-editor-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  )
}
