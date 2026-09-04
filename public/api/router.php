<?php
header('Content-Type: application/json; charset=utf-8');

function out($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data);
  exit;
}

try {
  // .../httpdocs/dist/api → .../httpdocs/data
  $dataDir = dirname(dirname(__DIR__)) . '/data';
  if (!is_dir($dataDir)) {
    if (!@mkdir($dataDir, 0775, true)) {
      // fallback writable inside dist
      $dataDir = dirname(__DIR__) . '/data';
      if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true)) {
        out(array('error' => 'mkdir data failed', 'tried' => array(
          dirname(dirname(__DIR__)) . '/data',
          dirname(__DIR__) . '/data',
        )), 500);
      }
    }
  }
  if (!is_writable($dataDir)) {
    out(array('error' => 'data not writable', 'dir' => $dataDir), 500);
  }

  $backupsDir = $dataDir . '/backups';
  if (!is_dir($backupsDir)) {
    @mkdir($backupsDir, 0775, true);
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
  $path = rtrim($path, '/');
  if ($path === '') $path = '/';
  $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

  function read_file($path) {
    $raw = @file_get_contents($path);
    if ($raw === false) out(array('error' => 'read failed', 'path' => $path), 500);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : array();
  }

  function write_file($path, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) out(array('error' => 'json encode failed'), 500);
    if (@file_put_contents($path, $json . "\n", LOCK_EX) === false) {
      out(array('error' => 'write failed', 'path' => $path), 500);
    }
  }

  function body() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) out(array('error' => 'invalid json body'), 400);
    return $data;
  }

  if ($path === '/api' || $path === '/api/health') {
    out(array('ok' => true, 'engine' => 'php', 'dataDir' => $dataDir));
  }

  if ($path === '/api/users' && $method === 'GET') out(read_file($files['users']));
  if ($path === '/api/users' && $method === 'POST') {
    write_file($files['users'], body());
    out(array('ok' => true));
  }

  if ($path === '/api/decks' && $method === 'GET') out(read_file($files['decks']));
  if ($path === '/api/decks' && $method === 'POST') {
    write_file($files['decks'], body());
    out(array('ok' => true));
  }

  if ($path === '/api/games' && $method === 'GET') out(read_file($files['games']));
  if ($path === '/api/games' && $method === 'POST') {
    write_file($files['games'], body());
    out(array('ok' => true));
  }

  if ($path === '/api/games/backup' && $method === 'GET') {
    $list = array();
    foreach (glob($backupsDir . '/*.json') ?: array() as $file) {
      $list[] = array('name' => basename($file), 'mtime' => filemtime($file) * 1000);
    }
    out($list);
  }

  if ($path === '/api/games/backup' && $method === 'POST') {
    $parsed = body();
    if (isset($parsed['games'])) {
      $games = $parsed['games'];
      $reason = isset($parsed['reason']) ? $parsed['reason'] : 'save';
    } else {
      $games = $parsed;
      $reason = 'legacy';
    }
    if (!is_array($games)) out(array('error' => 'games must be array'), 400);
    $safe = preg_replace('/[^a-z0-9-]+/', '-', strtolower((string) $reason));
    $safe = trim($safe, '-');
    if ($safe === '') $safe = 'save';
    $filename = 'games_' . $safe . '_' . date('Y-m-d_H-i-s') . '.json';
    write_file($backupsDir . '/' . $filename, $games);
    out(array('ok' => true, 'filename' => $filename, 'reason' => $reason));
  }

  out(array('error' => 'not found', 'path' => $path), 404);
} catch (Exception $e) {
  out(array('error' => 'exception', 'message' => $e->getMessage()), 500);
}
