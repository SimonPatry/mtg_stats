-- ═══════════════════════════════════════════════════════════════════════════
--  Forge Arcanique + MagicAddicts Stats — schéma MariaDB fusionné
--
--  Un seul projet, une seule base. Trois familles de tables :
--    · le catalogue   — joueurs, decks, versions, commandants, référentiels
--    · les parties    — parties, sièges, événements live
--    · l'affichage    — ce qui ne sert qu'à la vitrine publique
--
--  Conventions : identifiants en UUID (CHAR(36)), noms de colonnes en
--  snake_case, dates de jeu en DATE, horodatages techniques en TIMESTAMP.
-- ═══════════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ─── Référentiels ──────────────────────────────────────────────────────────
-- Tables semées, éditables depuis l'administration pour les tags, figées pour
-- le reste. Elles alimentent les listes déroulantes : aucune saisie libre.

CREATE TABLE IF NOT EXISTS colors (
  code      CHAR(1)     NOT NULL PRIMARY KEY,   -- W U B R G
  label     VARCHAR(20) NOT NULL,
  position  TINYINT     NOT NULL                -- ordre canonique WUBRG
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id         CHAR(36)    NOT NULL PRIMARY KEY,
  label      VARCHAR(40) NOT NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tags_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Manières de gagner une partie, et manières de tuer un joueur. Aujourd'hui
-- codées en dur dans tempGame.js ; en table, elles deviennent modifiables
-- sans redéploiement et contraignent la saisie.
CREATE TABLE IF NOT EXISTS win_styles (
  id       VARCHAR(30) NOT NULL PRIMARY KEY,
  label    VARCHAR(60) NOT NULL,
  position TINYINT     NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kill_styles (
  id       VARCHAR(30) NOT NULL PRIMARY KEY,
  label    VARCHAR(60) NOT NULL,
  position TINYINT     NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Comptes (authentification) ────────────────────────────────────────────
-- Indépendants des joueurs du roster (`users`) : un compte se connecte, un
-- joueur est une donnée de partie. Le rôle `admin` ouvre le catalogue / JSON ;
-- le rôle `user` ouvre stats et saisie de parties sur la vitrine.

CREATE TABLE IF NOT EXISTS accounts (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  username      VARCHAR(32)  NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  role          ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_accounts_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Joueurs ───────────────────────────────────────────────────────────────
-- Roster lié aux comptes inscrits : un joueur naît à l'inscription
-- (users.account_id), l'admin n'ajoute plus de joueurs à la main.

CREATE TABLE IF NOT EXISTS users (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT TRUE,
  account_id CHAR(36)     NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_name (name),
  UNIQUE KEY uq_users_account (account_id),
  CONSTRAINT fk_users_account FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Decks ─────────────────────────────────────────────────────────────────
-- UNE ligne = UNE lignée de deck (« mon Atraxa »), pas une version.
--
-- C'est le point de fusion des deux projets : cette table porte à la fois
-- l'appartenance à un joueur (statistiques) et le contenu de la vitrine
-- (site public). Ce qui change au fil du temps — bracket, URL — vit dans
-- deck_versions ; ce qui identifie le deck reste ici et n'est saisi qu'une
-- fois.

CREATE TABLE IF NOT EXISTS decks (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  user_id     CHAR(36)     NOT NULL,
  -- Titre affiché sur la vitrine. Facultatif : à défaut, l'interface retombe
  -- sur les noms des commandants, comme le fait mtg_stats aujourd'hui.
  name        VARCHAR(120) NOT NULL DEFAULT '',
  description TEXT,
  -- Décidé à la création du deck : ce deck apparaît-il sur la page publique ?
  showcase    BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Lignée retirée (le joueur ne la joue plus). Les parties passées restent.
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Archivé : invisible pour les membres (Mes decks / saisie). Les admins
  -- gardent une trace dans le roster. Hors vitrine tant qu'archivé.
  archived    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_on  DATE,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_decks_user FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_decks_user (user_id),
  -- L'ordre d'affichage se calcule à la lecture (le plus récent d'abord).
  KEY idx_decks_showcase (showcase, active, created_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Commandants d'un deck : une ligne par commandant pour gérer les partenaires
-- (partner, background, doctor's companion…). `position` = 1 pour le principal.
-- L'édition figée (set + numéro de collection) est portée par commandant,
-- puisque chacun a sa propre illustration.
CREATE TABLE IF NOT EXISTS deck_commanders (
  deck_id          CHAR(36)     NOT NULL,
  position         TINYINT      NOT NULL DEFAULT 1,
  name             VARCHAR(200) NOT NULL,
  set_code         VARCHAR(10)  NOT NULL DEFAULT '',
  collector_number VARCHAR(20)  NOT NULL DEFAULT '',
  PRIMARY KEY (deck_id, position),
  CONSTRAINT fk_deck_commanders_deck FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  KEY idx_deck_commanders_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Versions successives d'une lignée. Une nouvelle version est créée à chaque
-- changement de niveau ou de liste ; les parties pointent vers la version
-- jouée, ce qui permet de calculer un winrate « cette version » ET un winrate
-- « toutes versions » — exactement ce qu'affiche l'export aujourd'hui.
CREATE TABLE IF NOT EXISTS deck_versions (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  deck_id           CHAR(36)     NOT NULL,
  version_number    INT          NOT NULL,
  bracket           TINYINT,                       -- 1 à 4
  bracket_variation ENUM('low','high'),            -- NULL = pile sur le niveau
  deck_url          VARCHAR(500) NOT NULL DEFAULT '',
  -- Pourquoi cette version existe : 'initial', 'newVersion' (nouvelle liste),
  -- 'levelAdjustment' (reclassement sans changer la liste).
  cause             VARCHAR(30)  NOT NULL DEFAULT 'initial',
  started_on        DATE         NOT NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_deck_versions_deck FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  CONSTRAINT chk_deck_versions_bracket CHECK (bracket IS NULL OR bracket BETWEEN 1 AND 4),
  UNIQUE KEY uq_deck_versions_number (deck_id, version_number),
  KEY idx_deck_versions_deck (deck_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Habillage de la vitrine ───────────────────────────────────────────────
-- Ne concerne que les decks marqués showcase. Aucune de ces tables n'est lue
-- par les statistiques.

CREATE TABLE IF NOT EXISTS deck_colors (
  deck_id    CHAR(36) NOT NULL,
  color_code CHAR(1)  NOT NULL,
  PRIMARY KEY (deck_id, color_code),
  CONSTRAINT fk_deck_colors_deck  FOREIGN KEY (deck_id)    REFERENCES decks(id) ON DELETE CASCADE,
  CONSTRAINT fk_deck_colors_color FOREIGN KEY (color_code) REFERENCES colors(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Supprimer un tag le détache des decks qui l'utilisaient (l'API exige une
-- confirmation explicite avant d'en arriver là).
CREATE TABLE IF NOT EXISTS deck_tags (
  deck_id CHAR(36) NOT NULL,
  tag_id  CHAR(36) NOT NULL,
  PRIMARY KEY (deck_id, tag_id),
  CONSTRAINT fk_deck_tags_deck FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  CONSTRAINT fk_deck_tags_tag  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE,
  KEY idx_deck_tags_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS slider_sections (
  id       CHAR(36)     NOT NULL PRIMARY KEY,
  deck_id  CHAR(36)     NOT NULL,
  title    VARCHAR(120) NOT NULL,
  position INT          NOT NULL,
  CONSTRAINT fk_slider_sections_deck FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  KEY idx_slider_sections_deck (deck_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS slider_cards (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  section_id CHAR(36)     NOT NULL,
  name       VARCHAR(200) NOT NULL,
  position   INT          NOT NULL,
  CONSTRAINT fk_slider_cards_section FOREIGN KEY (section_id) REFERENCES slider_sections(id) ON DELETE CASCADE,
  KEY idx_slider_cards_section (section_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Parties ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS games (
  id                       CHAR(36)     NOT NULL PRIMARY KEY,
  played_on                DATE         NOT NULL,
  turns                    SMALLINT,
  -- Bracket de la table, distinct de celui de chaque deck.
  bracket                  TINYINT,
  bracket_variation        ENUM('low','high'),
  -- Compté à la main quand il n'y a pas de suivi live ; sinon déduit des
  -- événements. La colonne garde la valeur saisie, l'API arbitre.
  board_wipes              SMALLINT     NOT NULL DEFAULT 0,
  winner_protected_victory BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Dernier joueur à jouer, conservé par nom : c'est une information de table,
  -- pas forcément un joueur du catalogue.
  last_player              VARCHAR(100),
  last_seat_order          TINYINT,
  win_style                VARCHAR(30),
  notes                    TEXT,
  created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_games_win_style FOREIGN KEY (win_style) REFERENCES win_styles(id),
  CONSTRAINT chk_games_bracket CHECK (bracket IS NULL OR bracket BETWEEN 1 AND 4),
  KEY idx_games_played_on (played_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un siège = un joueur et son deck dans une partie. De 2 à 5 par partie.
--
-- Tout est figé au moment de la partie : le nom du joueur, les commandants et
-- le bracket sont des copies, pas des jointures. Une partie de février doit
-- rester lisible telle qu'elle a été jouée, même si le deck a changé de niveau
-- ou si le joueur a été renommé depuis.
CREATE TABLE IF NOT EXISTS game_seats (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  game_id           CHAR(36)     NOT NULL,
  seat_order        TINYINT      NOT NULL,          -- 1 à 5
  -- Version de deck jouée. NULL si le deck n'est pas au catalogue (invité de
  -- passage, deck emprunté) : les colonnes figées ci-dessous suffisent alors.
  deck_version_id   CHAR(36),
  user_id           CHAR(36),
  player_name       VARCHAR(100) NOT NULL,
  result            ENUM('win','loss') NOT NULL,
  bracket           TINYINT,
  bracket_variation ENUM('low','high'),
  -- Copie figée des commandants au moment de la partie. Jamais jointe, jamais
  -- filtrée dessus : c'est une photographie, la vérité vivante est dans
  -- deck_commanders.
  commanders        JSON         NOT NULL,
  CONSTRAINT fk_game_seats_game    FOREIGN KEY (game_id)         REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_seats_version FOREIGN KEY (deck_version_id) REFERENCES deck_versions(id),
  CONSTRAINT fk_game_seats_user    FOREIGN KEY (user_id)         REFERENCES users(id),
  CONSTRAINT chk_game_seats_seat   CHECK (seat_order BETWEEN 1 AND 5),
  UNIQUE KEY uq_game_seats_order (game_id, seat_order),
  KEY idx_game_seats_version (deck_version_id),
  KEY idx_game_seats_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Événements relevés en direct ──────────────────────────────────────────
-- La partie en cours vit dans le navigateur (sessionStorage) ; ces tables ne
-- reçoivent que ce qui est enregistré à la validation de la partie.

CREATE TABLE IF NOT EXISTS game_wipe_events (
  id                  CHAR(36)     NOT NULL PRIMARY KEY,
  game_id             CHAR(36)     NOT NULL,
  turn                SMALLINT     NOT NULL,
  player              VARCHAR(100) NOT NULL,
  countered           BOOLEAN      NOT NULL DEFAULT FALSE,
  countered_by        VARCHAR(100),
  protected           JSON,                          -- ["Simon", "Alex"]
  partially_protected JSON,                          -- ["Sam"]
  CONSTRAINT fk_wipe_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  KEY idx_wipe_game (game_id, turn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_mana_events (
  id             CHAR(36)   NOT NULL PRIMARY KEY,
  game_id        CHAR(36)   NOT NULL,
  mana_rule      VARCHAR(5) NOT NULL,                -- 'T4' | 'T5'
  turn           SMALLINT,
  mana_by_player JSON       NOT NULL,                -- {"Simon": 5, "Alex": 4}
  CONSTRAINT fk_mana_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  KEY idx_mana_game (game_id, turn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_death_events (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  game_id    CHAR(36)     NOT NULL,
  turn       SMALLINT     NOT NULL,
  victims    JSON         NOT NULL,                  -- ["Alex", "Jordan"]
  killer     VARCHAR(100),
  kill_style VARCHAR(30),
  CONSTRAINT fk_death_game  FOREIGN KEY (game_id)    REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_death_style FOREIGN KEY (kill_style) REFERENCES kill_styles(id),
  KEY idx_death_game (game_id, turn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Import unique du JSON existant ────────────────────────────────────────
-- Correspondance ancien identifiant JSON → nouvel identifiant en base, pour
-- que l'import puisse être relancé sans créer de doublons.
CREATE TABLE IF NOT EXISTS import_map (
  kind       VARCHAR(20) NOT NULL,                   -- 'user' | 'deck' | 'game'
  legacy_id  VARCHAR(64) NOT NULL,
  new_id     CHAR(36)    NOT NULL,
  imported_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kind, legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
