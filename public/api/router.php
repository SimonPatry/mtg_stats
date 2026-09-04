<?php
/**
 * API JSON pour magicaddicts.
 * Données dans httpdocs/data (frère de dist/) — hors dist, hors git.
 * Ne pas utiliser private/ (souvent bloqué par open_basedir Plesk).
 */
header('Content-Type: application/json; charset=utf-8');

register_shutdown_function(function () {
  $err = error_get_last();
  if (!$err) return;
  $fatal = array(E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR);
  if (!in_array($err['type'], $fatal, true)) return;
  if (headers_sent()) return;
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(array(
    'error' => 'php fatal',
    'message' => $err['message'],
    'file' => $err['file'],
    'line' => $err['line'],
  ));
});

function out($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data);
  exit;
}

function mtg_read_file($path) {
  $raw = @file_get_contents($path);
  if ($raw === false) out(array('error' => 'read failed', 'path' => $path), 500);
  $data = json_decode($raw, true);
  return is_array($data) ? $data : array();
}

function mtg_write_file($path, $data) {
  $dir = dirname($path);
  if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
    out(array('error' => 'mkdir failed', 'path' => $dir), 500);
  }
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if ($json === false) out(array('error' => 'json encode failed'), 500);
  if (@file_put_contents($path, $json . "\n", LOCK_EX) === false) {
    out(array('error' => 'write failed', 'path' => $path), 500);
  }
}

function mtg_body() {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  if (!is_array($data)) out(array('error' => 'invalid json body'), 400);
  return $data;
}

function mtg_backup_filename($kind, $reason) {
  $safe = preg_replace('/[^a-z0-9-]+/', '-', strtolower((string) $reason));
  $safe = trim($safe, '-');
  if ($safe === '') $safe = 'save';
  return $kind . '_' . $safe . '_' . date('Y-m-d_H-i-s') . '.json';
}

function mtg_list_backups($backupDirs, $kind) {
  $byName = array();
  foreach ((array) $backupDirs as $backupsDir) {
    if (!$backupsDir || !is_dir($backupsDir)) continue;
    $files = glob($backupsDir . '/' . $kind . '_*.json');
    if (!is_array($files)) continue;
    foreach ($files as $file) {
      $name = basename($file);
      $mtime = @filemtime($file);
      if ($mtime === false) continue;
      $mtime = $mtime * 1000;
      if (!isset($byName[$name]) || $mtime > $byName[$name]['mtime']) {
        $byName[$name] = array('name' => $name, 'mtime' => $mtime);
      }
    }
  }
  $list = array_values($byName);
  usort($list, function ($a, $b) {
    if ($a['mtime'] == $b['mtime']) return 0;
    return ($a['mtime'] < $b['mtime']) ? 1 : -1;
  });
  return $list;
}

function mtg_find_backup_file($backupDirs, $name) {
  foreach ((array) $backupDirs as $backupsDir) {
    $file = $backupsDir . '/' . $name;
    if (is_file($file)) return $file;
  }
  return null;
}

function mtg_extract_backup_payload($parsed, $kind) {
  if ($parsed === array() || array_keys($parsed) === range(0, count($parsed) - 1)) {
    return array($parsed, 'legacy');
  }
  $data = isset($parsed['data']) ? $parsed['data'] : (isset($parsed[$kind]) ? $parsed[$kind] : null);
  $reason = isset($parsed['reason']) ? $parsed['reason'] : 'save';
  return array($data, $reason);
}

/**
 * httpdocs/data — à côté de dist/, dans open_basedir, hors du build.
 * router = .../httpdocs/dist/api/router.php
 */
function mtg_resolve_data_dir() {
  $distDir = dirname(__DIR__);      // .../dist
  $httpdocs = dirname($distDir);    // .../httpdocs
  $docRoot = isset($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/') : '';
  if ($docRoot !== '' && substr($docRoot, -5) === '/dist') {
    $httpdocs = dirname($docRoot);
    $distDir = $docRoot;
  }

  $preferred = $httpdocs . '/data';
  $legacyDist = $distDir . '/data';

  // Prefer existing writable httpdocs/data
  if (is_dir($preferred) && is_writable($preferred)) {
    return array($preferred, $legacyDist);
  }

  // Create httpdocs/data
  if (!is_dir($preferred)) {
    @mkdir($preferred, 0775, true);
  }
  if (is_dir($preferred) && is_writable($preferred)) {
    // Migrate from dist/data if present (one-shot copy)
    if (is_dir($legacyDist)) {
      foreach (array('games.json', 'users.json', 'decks.json') as $name) {
        $src = $legacyDist . '/' . $name;
        $dst = $preferred . '/' . $name;
        if (is_file($src) && !is_file($dst)) {
          @copy($src, $dst);
        }
      }
      $bakSrc = $legacyDist . '/backups';
      $bakDst = $preferred . '/backups';
      if (is_dir($bakSrc)) {
        if (!is_dir($bakDst)) @mkdir($bakDst, 0775, true);
        $bakFiles = glob($bakSrc . '/*.json');
        if (is_array($bakFiles)) {
          foreach ($bakFiles as $file) {
            $target = $bakDst . '/' . basename($file);
            if (!is_file($target)) @copy($file, $target);
          }
        }
      }
    }
    return array($preferred, $legacyDist);
  }

  // Last resort: dist/data (survives poorly across deploys — avoid)
  if (!is_dir($legacyDist)) {
    @mkdir($legacyDist, 0775, true);
  }
  if (is_dir($legacyDist) && is_writable($legacyDist)) {
    return array($legacyDist, $legacyDist);
  }

  return array(null, $legacyDist);
}

try {
  list($dataDir, $legacyDataDir) = mtg_resolve_data_dir();
  if ($dataDir === null) {
    out(array(
      'error' => 'data dir unavailable',
      'hint' => 'Crée httpdocs/data writable (775) par le user PHP.',
      'tried' => array(
        dirname(dirname(__DIR__)) . '/data',
        dirname(__DIR__) . '/data',
      ),
    ), 500);
  }

  $backupsDir = $dataDir . '/backups';
  if (!is_dir($backupsDir)) {
    @mkdir($backupsDir, 0775, true);
  }
  if (!is_dir($backupsDir) || !is_writable($backupsDir)) {
    out(array(
      'error' => 'backups dir not writable',
      'path' => $backupsDir,
      'dataDir' => $dataDir,
    ), 500);
  }

  $legacyBackupsDir = dirname(__DIR__) . '/backups'; // dist/backups (lecture)
  $backupDirs = array($backupsDir);
  if ($legacyBackupsDir !== $backupsDir && is_dir($legacyBackupsDir)) {
    $backupDirs[] = $legacyBackupsDir;
  }
  if ($legacyDataDir && $legacyDataDir !== $dataDir) {
    $legacyDataBackups = $legacyDataDir . '/backups';
    if (is_dir($legacyDataBackups)) {
      $backupDirs[] = $legacyDataBackups;
    }
  }

  $files = array(
    'games' => $dataDir . '/games.json',
    'users' => $dataDir . '/users.json',
    'decks' => $dataDir . '/decks.json',
  );
  foreach ($files as $f) {
    if (!file_exists($f)) {
      if (@file_put_contents($f, "[]\n") === false) {
        out(array('error' => 'cannot create file', 'path' => $f), 500);
      }
    }
  }

  $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
  $path = parse_url($uri, PHP_URL_PATH);
  $path = rtrim((string) $path, '/');
  if ($path === '') $path = '/';
  $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

  if ($path === '/api' || $path === '/api/health') {
    out(array(
      'ok' => true,
      'engine' => 'php',
      'dataDir' => $dataDir,
      'backupsDir' => $backupsDir,
      'backupDirs' => $backupDirs,
      'writable' => is_writable($dataDir),
    ));
  }

  if ($path === '/api/backup-file' && $method === 'GET') {
    $name = isset($_GET['name']) ? (string) $_GET['name'] : '';
    if (!preg_match('/^(games|users|decks)_[a-z0-9_-]+\.json$/i', $name)) {
      out(array('error' => 'invalid backup name'), 400);
    }
    $file = mtg_find_backup_file($backupDirs, $name);
    if ($file === null) out(array('error' => 'not found', 'name' => $name), 404);
    out(mtg_read_file($file));
  }

  // ── users ──
  if ($path === '/api/users' && $method === 'GET') out(mtg_read_file($files['users']));
  if ($path === '/api/users' && $method === 'POST') {
    mtg_write_file($files['users'], mtg_body());
    out(array('ok' => true));
  }
  if ($path === '/api/users/backup' && $method === 'GET') {
    out(mtg_list_backups($backupDirs, 'users'));
  }
  if ($path === '/api/users/backup' && $method === 'POST') {
    $parsed = mtg_body();
    list($data, $reason) = mtg_extract_backup_payload($parsed, 'users');
    if (!is_array($data)) out(array('error' => 'users must be array'), 400);
    $filename = mtg_backup_filename('users', $reason);
    mtg_write_file($backupsDir . '/' . $filename, $data);
    out(array('ok' => true, 'filename' => $filename, 'reason' => $reason));
  }

  // ── decks ──
  if ($path === '/api/decks' && $method === 'GET') out(mtg_read_file($files['decks']));
  if ($path === '/api/decks' && $method === 'POST') {
    mtg_write_file($files['decks'], mtg_body());
    out(array('ok' => true));
  }
  if ($path === '/api/decks/backup' && $method === 'GET') {
    out(mtg_list_backups($backupDirs, 'decks'));
  }
  if ($path === '/api/decks/backup' && $method === 'POST') {
    $parsed = mtg_body();
    list($data, $reason) = mtg_extract_backup_payload($parsed, 'decks');
    if (!is_array($data)) out(array('error' => 'decks must be array'), 400);
    $filename = mtg_backup_filename('decks', $reason);
    mtg_write_file($backupsDir . '/' . $filename, $data);
    out(array('ok' => true, 'filename' => $filename, 'reason' => $reason));
  }

  // ── games ──
  if ($path === '/api/games' && $method === 'GET') out(mtg_read_file($files['games']));
  if ($path === '/api/games' && $method === 'POST') {
    mtg_write_file($files['games'], mtg_body());
    out(array('ok' => true));
  }
  if ($path === '/api/games/backup' && $method === 'GET') {
    out(mtg_list_backups($backupDirs, 'games'));
  }
  if ($path === '/api/games/backup' && $method === 'POST') {
    $parsed = mtg_body();
    list($data, $reason) = mtg_extract_backup_payload($parsed, 'games');
    if (!is_array($data)) out(array('error' => 'games must be array'), 400);
    $filename = mtg_backup_filename('games', $reason);
    mtg_write_file($backupsDir . '/' . $filename, $data);
    out(array('ok' => true, 'filename' => $filename, 'reason' => $reason));
  }

  out(array('error' => 'not found', 'path' => $path), 404);
} catch (Exception $e) {
  out(array('error' => 'exception', 'message' => $e->getMessage()), 500);
}
