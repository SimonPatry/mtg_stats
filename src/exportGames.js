import * as XLSX from 'xlsx'
import { commandersKey } from './playersMapping'

function findPlayerForCommanders(players, commanders) {
  const key = commandersKey(commanders)
  for (const [player, decks] of Object.entries(players)) {
    for (const deck of decks) {
      if (commandersKey(deck.com) === key) {
        return {
          player,
          bracket: deck.bracket,
          bracketVariation: deck.bracketVariation ?? null,
        }
      }
    }
  }
  return null
}

function formatBracket(bracket, variation) {
  if (bracket == null || bracket === '') return ''
  if (variation === 'low') return `B${bracket} low`
  if (variation === 'high') return `B${bracket} high`
  return `B${bracket}`
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportStamp() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`
}

export function downloadGamesJson(games) {
  const blob = new Blob([`${JSON.stringify(games, null, 2)}\n`], {
    type: 'application/json',
  })
  triggerDownload(blob, `games_${exportStamp()}.json`)
}

function gameToRow(game, players) {
  const decks = [...game.decks]
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((deck) => {
      const owned = findPlayerForCommanders(players, deck.commanders)
      const bracket = deck.bracket ?? owned?.bracket
      const variation =
        deck.bracketVariation !== undefined
          ? deck.bracketVariation
          : (owned?.bracketVariation ?? null)
      return {
        commanders: deck.commanders.join(' / '),
        player: deck.player || owned?.player || '',
        bracket: formatBracket(bracket, variation),
        result: deck.result,
        seatOrder: deck.seatOrder,
      }
    })

  const winner = decks.find((d) => d.result === 'win')

  const row = {
    id: game.id,
    date: game.date,
    turns: game.turns,
    bracket: formatBracket(game.bracket, game.bracketVariation),
    hadWipe: game.hadWipe,
    winnerProtectedVictory: game.winnerProtectedVictory,
    notes: game.notes || '',
    winner: winner?.player || '',
    winner_commanders: winner?.commanders || '',
  }

  for (let i = 0; i < 4; i += 1) {
    const d = decks[i] || {}
    const n = i + 1
    row[`deck${n}_seat`] = d.seatOrder ?? ''
    row[`deck${n}_commanders`] = d.commanders ?? ''
    row[`deck${n}_player`] = d.player ?? ''
    row[`deck${n}_bracket`] = d.bracket ?? ''
    row[`deck${n}_result`] = d.result ?? ''
  }

  return row
}

export function downloadGamesExcel(games, players) {
  const rows = games.map((game) => gameToRow(game, players))
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Parties')
  XLSX.writeFile(book, `games_${exportStamp()}.xlsx`)
}
