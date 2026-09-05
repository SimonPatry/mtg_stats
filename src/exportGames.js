import * as XLSX from 'xlsx'
import { getBoardWipes, getLastPlayer } from './gamesApi'
import {
  commandersKey,
  computeStatsByDeckId,
  resolveDeckFromCatalog,
} from './playersMapping'

function exportStamp() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function winrateRecord(wins, games) {
  if (!games) return { pct: 0, label: '0/0' }
  const pct = Math.round((wins / games) * 100)
  return { pct, label: `${wins}/${games}` }
}

function computePlayerCommanderStats(games, users, decks) {
  const byKey = {}
  for (const game of games) {
    for (const raw of game.decks) {
      const deck = resolveDeckFromCatalog(decks, users, raw)
      const player = deck.player?.trim()
      if (!player || !deck.commanders?.length) continue
      const key = `${player.toLowerCase()}::${commandersKey(deck.commanders)}`
      if (!byKey[key]) byKey[key] = { wins: 0, games: 0 }
      byKey[key].games += 1
      if (deck.result === 'win') byKey[key].wins += 1
    }
  }
  return byKey
}

function playerCommanderKey(player, commanders) {
  return `${(player ?? '').trim().toLowerCase()}::${commandersKey(commanders)}`
}

function enrichDeckSlot(rawDeck, users, decks, statsByDeckId, playerCommanderStats) {
  const resolved = resolveDeckFromCatalog(decks, users, rawDeck)
  const player = resolved.player || ''
  const commanders = resolved.commanders.join(' / ')
  const pcKey = playerCommanderKey(player, resolved.commanders)
  const total = playerCommanderStats[pcKey] ?? { wins: 0, games: 0 }
  const version = resolved.deckId
    ? statsByDeckId[resolved.deckId] ?? { wins: 0, games: 0 }
    : { wins: 0, games: 0 }
  const totalWr = winrateRecord(total.wins, total.games)
  const versionWr = winrateRecord(version.wins, version.games)

  return {
    seat: rawDeck.seatOrder,
    player,
    commanders,
    bracket: resolved.bracket ?? null,
    bracketVariation: resolved.bracketVariation ?? null,
    result: rawDeck.result,
    winrateTotalPct: totalWr.pct,
    winrateTotal: totalWr.label,
    winrateVersionPct: versionWr.pct,
    winrateVersion: versionWr.label,
  }
}

/** Export stats-friendly — sans ids techniques. */
export function buildGamesExport(games, users, decks) {
  const statsByDeckId = computeStatsByDeckId(games, users, decks)
  const playerCommanderStats = computePlayerCommanderStats(games, users, decks)

  const exportedGames = games.map((game) => {
    const decksInGame = [...game.decks]
      .sort((a, b) => a.seatOrder - b.seatOrder)
      .map((raw) =>
        enrichDeckSlot(raw, users, decks, statsByDeckId, playerCommanderStats),
      )

    const winner = decksInGame.find((d) => d.result === 'win')

    return {
      date: game.date,
      turns: game.turns,
      tableBracket: game.bracket ?? null,
      tableBracketVariation: game.bracketVariation ?? null,
      boardWipes: getBoardWipes(game),
      winnerProtectedVictory: Boolean(game.winnerProtectedVictory),
      lastPlayer: getLastPlayer(game) || null,
      notes: game.notes?.trim() || '',
      winnerPlayer: winner?.player ?? '',
      winnerCommanders: winner?.commanders ?? '',
      decks: decksInGame,
    }
  })

  return {
    exportedAt: new Date().toISOString(),
    gameCount: exportedGames.length,
    games: exportedGames,
  }
}

export function downloadGamesJson(games, users, decks) {
  const payload = buildGamesExport(games, users, decks)
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: 'application/json',
  })
  triggerDownload(blob, `games_stats_${exportStamp()}.json`)
}

function gameToExcelRow(game, users, decks, statsByDeckId, playerCommanderStats) {
  const decksInGame = [...game.decks]
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((raw) =>
      enrichDeckSlot(raw, users, decks, statsByDeckId, playerCommanderStats),
    )

  const winner = decksInGame.find((d) => d.result === 'win')

  const row = {
    date: game.date,
    turns: game.turns,
    table_bracket: game.bracket ?? '',
    table_bracket_variation: game.bracketVariation ?? '',
    board_wipes: getBoardWipes(game),
    winner_protected: game.winnerProtectedVictory ? 'oui' : 'non',
    last_player: getLastPlayer(game),
    notes: game.notes?.trim() || '',
    winner_player: winner?.player ?? '',
    winner_commanders: winner?.commanders ?? '',
  }

  for (let i = 0; i < 5; i += 1) {
    const d = decksInGame[i] || {}
    const n = i + 1
    row[`seat_${n}`] = d.seat ?? ''
    row[`player_${n}`] = d.player ?? ''
    row[`commanders_${n}`] = d.commanders ?? ''
    row[`bracket_${n}`] = d.bracket ?? ''
    row[`bracket_variation_${n}`] = d.bracketVariation ?? ''
    row[`result_${n}`] = d.result ?? ''
    row[`winrate_total_${n}`] = d.winrateTotal ?? ''
    row[`winrate_total_pct_${n}`] = d.winrateTotalPct ?? ''
    row[`winrate_version_${n}`] = d.winrateVersion ?? ''
    row[`winrate_version_pct_${n}`] = d.winrateVersionPct ?? ''
  }

  return row
}

export function downloadGamesExcel(games, users, decks) {
  const statsByDeckId = computeStatsByDeckId(games, users, decks)
  const playerCommanderStats = computePlayerCommanderStats(games, users, decks)
  const rows = games.map((game) =>
    gameToExcelRow(game, users, decks, statsByDeckId, playerCommanderStats),
  )
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Parties')
  XLSX.writeFile(book, `games_stats_${exportStamp()}.xlsx`)
}
