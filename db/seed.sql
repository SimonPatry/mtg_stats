-- Référentiels. Rejoué à chaque démarrage : les INSERT sont idempotents.

INSERT INTO colors (code, label, position) VALUES
  ('W','Blanc',0), ('U','Bleu',1), ('B','Noir',2), ('R','Rouge',3), ('G','Vert',4)
ON DUPLICATE KEY UPDATE label = VALUES(label), position = VALUES(position);

-- Repris à l'identique de KILL_STYLES / WIN_STYLES dans src/tempGame.js.
-- Les identifiants DOIVENT rester ceux du code : les parties déjà saisies les
-- référencent, et les clés étrangères refuseraient l'import sinon.
INSERT INTO win_styles (id, label, position) VALUES
  ('combat','Dégâts de combat',0),
  ('nonCombat','Dégâts non-combat',1),
  ('commander','Dégâts de commandant',2),
  ('combo','Combo',3),
  ('mill','Mill',4),
  ('other','Autre',5)
ON DUPLICATE KEY UPDATE label = VALUES(label), position = VALUES(position);

INSERT INTO kill_styles (id, label, position) VALUES
  ('combat','Dégâts de combat',0),
  ('nonCombat','Dégâts non-combat',1),
  ('commander','Dégâts de commandant',2),
  ('poison','Poison',3),
  ('mill','Mill',4),
  ('other','Autre',5)
ON DUPLICATE KEY UPDATE label = VALUES(label), position = VALUES(position);
