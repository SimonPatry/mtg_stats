# MagicAddicts

Site de decks Commander : une vitrine publique sur `/`, et une administration
authentifiée sur `/admin` — saisie des parties, statistiques, gestion des
joueurs et des decks.

Une seule application React, une API Express, une base MariaDB.

---

## Installation

Il faut Node 20 ou plus, et Docker.

```bash
npm install
cp .env.example .env
```

Puis compléter les deux valeurs vides de `.env` :

```bash
# secret de signature des jetons de session
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# hash du mot de passe d'administration
npm run hash-password -- "mon mot de passe"
```

**Option A — tout en Docker** (app + MariaDB) :

```bash
docker compose up -d --build
# http://localhost:3000
docker compose down            # stop
docker compose logs -f app     # logs
```

**Option B — MariaDB en Docker, app en Node** :

```bash
docker compose up -d db
npm run import:test           # optionnel : données de test
npm run serve
```

Si le port 3306 est déjà pris, `DB_PORT=3307 docker compose up -d` et la même
valeur dans `.env`.

---

## Démarrer

### Docker — app + MariaDB d'un coup

Prérequis : `.env` avec `JWT_SECRET` et `ADMIN_PASSWORD_HASH` remplis.

```bash
docker compose up -d --build
```

`http://localhost:3000` — site, admin et API.  
Logs : `docker compose logs -f app`. Arrêt : `docker compose down`.

### Avec Node seul — pour utiliser le site

```bash
docker compose up -d db       # MariaDB seule si besoin
npm run serve                 # compile le front puis démarre le serveur
```

`http://localhost:3000` — la vitrine, l'administration et l'API, servies par un
**seul processus**. C'est la configuration de production : une seule origine,
donc ni CORS ni cookie inter-origines.

Express sert le contenu du dossier `dist/`, c'est-à-dire le résultat du dernier
`npm run build`. **Modifier un fichier de `src/` ne change rien tant qu'on n'a
pas recompilé.** Si le build échoue, l'ancien `dist/` reste en place et le
serveur continue de servir la version précédente sans rien signaler — c'est le
piège classique.

Pour redémarrer sans recompiler : `npm start`.

### Avec Vite — pour développer

Deux terminaux, et les deux sont nécessaires (DB déjà up) :

```bash
docker compose up -d db       # si pas déjà lancé
npm start                     # terminal 1 : l'API sur le port 3000
npm run dev                   # terminal 2 : Vite sur le port 5173
```

`http://localhost:5173` — le front est servi depuis les sources, avec
rechargement à chaud. Vite ne connaît pas la base : il relaie tous les appels
`/api` vers Express, qui doit donc tourner à côté.

Deux différences à garder en tête :

- Vite n'applique **aucune politique de sécurité de contenu**. Une ressource
  externe oubliée dans la CSP marchera ici et échouera sur le port 3000.
- Le port 3000 sert un build figé, le port 5173 les sources. Avoir les deux
  ouverts et ne plus savoir lequel on regarde est la meilleure façon de croire
  à un bug qui n'existe pas.

Si on ne développe pas, le port 3000 suffit.

---

## Tests

```bash
npm test                      # unitaires — aucune dépendance
npm run test:integration      # API, migration, service du front, CSP — exige la base
npm run test:all              # les deux
npm run test:browser          # trois suites dans un vrai navigateur
```

Les suites navigateur exigent que **l'API et le front tournent** (`npm run serve`,
ou les deux terminaux ci-dessus) et pilotent Chromium via Playwright :

| suite | ce qu'elle couvre |
|---|---|
| `admintest.mjs` | connexion, tableau de bord, saisie et suppression d'une partie, export Excel |
| `sitetest.mjs` | vitrine publique, menu, aperçu de carte, navigation vers l'administration |
| `showcasetest.mjs` | création d'un deck vitrine depuis le roster, jusqu'à son affichage public |

Elles se connectent à chaque exécution et épuisent vite les dix tentatives
autorisées par quart d'heure. En local, monter `LOGIN_RATE_LIMIT` dans `.env`.

Par défaut elles visent Vite sur le port 5173 ; `BASE_URL=http://localhost:3000`
les fait tourner contre le serveur de production. Il vaut la peine de les jouer
dans les deux configurations : c'est ce qui attrape les écarts entre les deux.

---

## Structure

```
src/            front React — site/ pour la vitrine, admin/ pour le reste
server/         API Express — un routeur et un dépôt par ressource
shared/         schémas Zod, partagés entre l'API et les formulaires
db/             schéma SQL et référentiels
scripts/        import du JSON historique, génération du mot de passe
tests/          unitaires à la racine, sur base réelle dans integration/
```

---

## Commandes

| commande | effet |
|---|---|
| `docker compose up -d --build` | MariaDB + app sur :3000 |
| `docker compose down` | arrête les conteneurs |
| `docker compose up -d db` | MariaDB seule (dev Node) |
| `npm run dev` | serveur de développement Vite (port 5173) |
| `npm start` | API + front compilé (port 3000) |
| `npm run build` | compile le front dans `dist/` |
| `npm run serve` | `build` puis `start` |
| `npm run import:test` | charge le jeu de données de test en base |
| `npm run hash-password -- "…"` | calcule le hash à mettre dans `.env` |
