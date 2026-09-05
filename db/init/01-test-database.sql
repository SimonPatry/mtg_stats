-- Base dédiée aux tests d'intégration : elle est vidée et recréée à chaque
-- exécution de la suite, ce qui ne doit jamais toucher aux données de
-- développement. Joué une seule fois, à la création du volume Docker.
CREATE DATABASE IF NOT EXISTS mtg_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON mtg_test.* TO 'mtg'@'%';
FLUSH PRIVILEGES;
