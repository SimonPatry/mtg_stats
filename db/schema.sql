-- MagicAddicts Stats — MariaDB schema
-- Miroir des structures JSON actuelles, prêt pour migration future

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ─── Joueurs ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,   -- UUID
  name        VARCHAR(100) NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Decks ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decks (
  id                VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id           VARCHAR(36) NOT NULL,
  commanders        JSON NOT NULL,                    -- ["Atraxa, Praetors' Voice"]
  bracket           TINYINT,                          -- 1-4
  bracket_variation VARCHAR(10),                      -- NULL | 'low' | 'high'
  deck_url          VARCHAR(500) DEFAULT '',
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        DATE,
  previous_deck_id  VARCHAR(36),
  com_print         VARCHAR(200),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (previous_deck_id) REFERENCES decks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historique des changements de bracket sur un deck
CREATE TABLE IF NOT EXISTS deck_history (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  deck_id           VARCHAR(36) NOT NULL,
  date              DATE NOT NULL,
  previous_value    VARCHAR(20),                      -- 'B2', 'B3 - low', etc.
  new_value         VARCHAR(20),
  cause             VARCHAR(30),                      -- 'newVersion' | 'levelAdjustment'
  bracket           TINYINT,
  bracket_variation VARCHAR(10),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_deck_history_deck ON deck_history(deck_id);

-- ─── Parties ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS games (
  id                       VARCHAR(36) NOT NULL PRIMARY KEY,
  date                     DATE NOT NULL,
  turns                    SMALLINT,
  bracket                  TINYINT,
  bracket_variation        VARCHAR(10),
  board_wipes              SMALLINT DEFAULT 0,
  winner_protected_victory BOOLEAN DEFAULT FALSE,
  last_player              VARCHAR(100),
  last_seat_order          TINYINT,                   -- 1-4
  win_style                VARCHAR(30),               -- 'combat' | 'combo' | 'mill' | etc.
  notes                    TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Joueurs/decks dans une partie (4 par partie)
CREATE TABLE IF NOT EXISTS game_decks (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  game_id           VARCHAR(36) NOT NULL,
  deck_id           VARCHAR(36),
  player            VARCHAR(100) NOT NULL,
  seat_order        TINYINT NOT NULL,                 -- 1-4
  result            VARCHAR(10),                      -- 'win' | 'loss'
  bracket           TINYINT,
  bracket_variation VARCHAR(10),
  commanders        JSON,                             -- snapshot au moment de la partie
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (deck_id) REFERENCES decks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_game_decks_game ON game_decks(game_id);
CREATE INDEX idx_game_decks_deck ON game_decks(deck_id);

-- ─── Événements live ────────────────────────────────

-- Board wipes
CREATE TABLE IF NOT EXISTS wipe_events (
  id                    VARCHAR(36) NOT NULL PRIMARY KEY,
  game_id               VARCHAR(36) NOT NULL,
  player                VARCHAR(100) NOT NULL,
  turn                  SMALLINT NOT NULL,
  countered             BOOLEAN DEFAULT FALSE,
  countered_by          VARCHAR(100),
  protected_players     JSON,                         -- ["Simon", "Alex"]
  partially_protected   JSON,                         -- ["Sam"]
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_wipe_events_game ON wipe_events(game_id);

-- Relevés de mana
CREATE TABLE IF NOT EXISTS mana_events (
  id              VARCHAR(36) NOT NULL PRIMARY KEY,
  game_id         VARCHAR(36) NOT NULL,
  mana_rule       VARCHAR(5) NOT NULL,                -- 'T4' | 'T5'
  turn            SMALLINT,
  mana_by_player  JSON NOT NULL,                      -- {"Simon": 5, "Alex": 4}
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_mana_events_game ON mana_events(game_id);

-- Morts de joueurs
CREATE TABLE IF NOT EXISTS death_events (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  game_id     VARCHAR(36) NOT NULL,
  turn        SMALLINT NOT NULL,
  victims     JSON NOT NULL,                          -- ["Alex", "Jordan"]
  killer      VARCHAR(100),
  kill_style  VARCHAR(30),                            -- 'combat' | 'nonCombat' | 'commander' | etc.
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_death_events_game ON death_events(game_id);

-- ─── Backups (tracking) ─────────────────────────────

CREATE TABLE IF NOT EXISTS backups (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  filename    VARCHAR(200) NOT NULL,
  reason      VARCHAR(30),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
