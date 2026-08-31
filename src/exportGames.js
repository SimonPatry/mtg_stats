import * as XLSX from 'xlsx'
import { getBoardWipes } from './gamesApi'
import { resolveDeckFromCatalog } from './playersMapping'

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

function gameToRow(game, users, decks) {
  const resolvedDecks = [...game.decks]
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((deck) => {
      const resolved = resolveDeckFromCatalog(decks, users, deck)
      const bracket = resolved.bracket
      const variation = resolved.bracketVariation ?? null
      return {
        commanders: resolved.commanders.join(' / '),
        player: resolved.player || '',
        bracket: formatBracket(bracket, variation),
        result: deck.result,
        seatOrder: deck.seatOrder,
        deckId: resolved.deckId ?? deck.deckId ?? '',
      }
    })

  const winner = resolvedDecks.find((d) => d.result === 'win')

  const row = {
    id: game.id,
    date: game.date,
    turns: game.turns,
    bracket: formatBracket(game.bracket, game.bracketVariation),
    boardWipes: getBoardWipes(game),
    winnerProtectedVictory: game.winnerProtectedVictory,
    notes: game.notes || '',
    winner: winner?.player || '',
    winner_commanders: winner?.commanders || '',
  }

  for (let i = 0; i < 4; i += 1) {
    const d = resolvedDecks[i] || {}
    const n = i + 1
    row[`deck${n}_seat`] = d.seatOrder ?? ''
    row[`deck${n}_commanders`] = d.commanders ?? ''
    row[`deck${n}_player`] = d.player ?? ''
    row[`deck${n}_bracket`] = d.bracket ?? ''
    row[`deck${n}_result`] = d.result ?? ''
    row[`deck${n}_deckId`] = d.deckId ?? ''
  }

  return row
}

export function downloadGamesExcel(games, users, decks) {
  const rows = games.map((game) => gameToRow(game, users, decks))
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Parties')
  XLSX.writeFile(book, `games_${exportStamp()}.xlsx`)
}
