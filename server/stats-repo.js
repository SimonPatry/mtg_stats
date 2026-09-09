/**
 * Statistiques calculées en base.
 *
 * Reproduit exactement ce que fait src/stats.js sur les données JSON — les
 * tests d'intégration comparent les deux résultats champ par champ. La règle
 * de regroupement est la lignée (`decks.id`), pas la version : un deck qui a
 * changé de niveau cumule ses parties, comme aujourd'hui.
 */

// Séparateur de GROUP_CONCAT : improbable dans un nom de carte, contrairement
// à « / » qui sert justement à écrire les partenaires.
const SEP = '|~|'

/** Chiffres de tête du tableau de bord. */
export async function readHeadline(cx) {
  const [[row]] = await cx.query(`
    SELECT
      COUNT(*)                                         AS total_games,
      COALESCE(AVG(turns), 0)                          AS avg_turns,
      COALESCE(AVG(board_wipes), 0)                    AS avg_board_wipes,
      COALESCE(AVG(winner_protected_victory) * 100, 0) AS protected_rate
    FROM games
  `)

  const totalGames = Number(row.total_games)
  if (totalGames === 0) {
    return { totalGames: 0, avgTurns: 0, avgBoardWipes: 0, protectedRate: 0 }
  }
  return {
    totalGames,
    // Mêmes arrondis que le front : une décimale en chaîne, un entier pour le taux.
    avgTurns: Number(row.avg_turns).toFixed(1),
    avgBoardWipes: Number(row.avg_board_wipes).toFixed(1),
    protectedRate: Math.round(Number(row.protected_rate)),
  }
}

/**
 * Victoires et parties par lignée de deck.
 *
 * Toutes les lignées actives sont listées, même sans partie jouée : le tableau
 * de bord est aussi un catalogue.
 */
export async function readWinsByDeck(cx) {
  const [rows] = await cx.query(`
    SELECT
      d.id                    AS deck_id,
      d.name                  AS deck_name,
      u.name                  AS player,
      cur.bracket             AS bracket,
      cur.bracket_variation   AS bracket_variation,
      cur.deck_url            AS deck_url,
      COALESCE(played.games, 0) AS games,
      COALESCE(played.wins, 0)  AS wins,
      (SELECT GROUP_CONCAT(c.name ORDER BY c.position SEPARATOR '|~|')
         FROM deck_commanders c WHERE c.deck_id = d.id) AS commanders
    FROM decks d
    JOIN users u ON u.id = d.user_id
    -- Version courante = la plus récente de la lignée.
    LEFT JOIN deck_versions cur
      ON cur.deck_id = d.id
     AND cur.version_number = (SELECT MAX(v2.version_number)
                                 FROM deck_versions v2 WHERE v2.deck_id = d.id)
    LEFT JOIN (
      SELECT v.deck_id,
             COUNT(*)              AS games,
             SUM(s.result = 'win') AS wins
        FROM game_seats s
        JOIN deck_versions v ON v.id = s.deck_version_id
       GROUP BY v.deck_id
    ) played ON played.deck_id = d.id
    WHERE d.active = TRUE AND d.archived = FALSE
    ORDER BY u.name, d.id
  `)

  const byDeck = {}
  for (const row of rows) {
    byDeck[row.deck_id] = {
      deckId: row.deck_id,
      name: row.deck_name || '',
      player: row.player,
      commanders: row.commanders ? row.commanders.split(SEP) : [],
      bracket: row.bracket,
      bracketVariation: row.bracket_variation,
      deckUrl: row.deck_url ?? '',
      games: Number(row.games),
      wins: Number(row.wins),
    }
  }
  return byDeck
}

/** Victoires et parties par joueur, d'après le nom figé sur le siège. */
export async function readWinsByPlayer(cx) {
  const [rows] = await cx.query(`
    SELECT player_name        AS player,
           COUNT(*)           AS games,
           SUM(result = 'win') AS wins
      FROM game_seats
     GROUP BY player_name
     ORDER BY player_name
  `)
  const byPlayer = {}
  for (const row of rows) {
    byPlayer[row.player] = { wins: Number(row.wins), games: Number(row.games) }
  }
  return byPlayer
}

/** Victoires et parties par VERSION de deck (colonne « winrate version »). */
export async function readWinsByVersion(cx) {
  const [rows] = await cx.query(`
    SELECT v.id             AS version_id,
           v.deck_id        AS deck_id,
           v.version_number AS version_number,
           COUNT(s.id)      AS games,
           COALESCE(SUM(s.result = 'win'), 0) AS wins
      FROM deck_versions v
      LEFT JOIN game_seats s ON s.deck_version_id = v.id
     GROUP BY v.id
     ORDER BY v.deck_id, v.version_number
  `)
  const byVersion = {}
  for (const row of rows) {
    byVersion[row.version_id] = {
      deckId: row.deck_id,
      versionNumber: Number(row.version_number),
      games: Number(row.games),
      wins: Number(row.wins),
    }
  }
  return byVersion
}

export async function readDashboard(cx) {
  const [headline, winsByDeck, winsByPlayer] = await Promise.all([
    readHeadline(cx), readWinsByDeck(cx), readWinsByPlayer(cx),
  ])
  return { ...headline, winsByDeck, winsByPlayer }
}
