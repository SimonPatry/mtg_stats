<?php
header('Content-Type: application/json; charset=utf-8');

$dataDir = dirname(__DIR__, 2) . '/data';
$backupsDir = $dataDir . '/backups';

if (!is_dir($dataDir)) {
    mkdir($dataDir, 0775, true);
}
if (!is_dir($backupsDir)) {
    mkdir($backupsDir, 0775, true);
}

$files = [
    'games' => $dataDir . '/games.json',
    'users' => $dataDir . '/users.json',
    'decks' => $dataDir . '/decks.json',
];

foreach ($files as $path) {
    if (!file_exists($path)) {
        file_put_contents($path, "[]\n");
    }
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = rtrim((string) $path, '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function json_out($data, $code = 200)
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json_file($path)
{
    $raw = file_get_contents($path);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function write_json_file($path, $data)
{
    $ok = file_put_contents(
        $path,
        json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n",
        LOCK_EX
    );
    if ($ok === false) {
        json_out(['error' => 'Impossible d’écrire le fichier'], 500);
    }
}

function request_body()
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_out(['error' => 'JSON invalide'], 400);
    }
    return $data;
}

if ($path === '/api/users' && $method === 'GET') {
    json_out(read_json_file($files['users']));
}
if ($path === '/api/users' && $method === 'POST') {
    $data = request_body();
    if (!is_array($data) || (count($data) > 0 && !isset($data[0]))) {
        json_out(['error' => 'users doit être un tableau'], 400);
    }
    write_json_file($files['users'], $data);
    json_out(['ok' => true]);
}

if ($path === '/api/decks' && $method === 'GET') {
    json_out(read_json_file($files['decks']));
}
if ($path === '/api/decks' && $method === 'POST') {
    $data = request_body();
    write_json_file($files['decks'], $data);
    json_out(['ok' => true]);
}

if ($path === '/api/games' && $method === 'GET') {
    json_out(read_json_file($files['games']));
}
if ($path === '/api/games' && $method === 'POST') {
    $data = request_body();
    write_json_file($files['games'], $data);
    json_out(['ok' => true]);
}

if ($path === '/api/games/backup' && $method === 'GET') {
    $list = [];
    foreach (glob($backupsDir . '/*.json') ?: [] as $file) {
        $list[] = [
            'name' => basename($file),
            'mtime' => filemtime($file) * 1000,
        ];
    }
    usort($list, fn($a, $b) => $b['mtime'] <=> $a['mtime']);
    json_out($list);
}

if ($path === '/api/games/backup' && $method === 'POST') {
    $parsed = request_body();
    if (array_key_exists('games', $parsed)) {
        $games = $parsed['games'];
        $reason = $parsed['reason'] ?? 'save';
    } else {
        $games = $parsed;
        $reason = 'legacy';
    }
    if (!is_array($games)) {
        json_out(['error' => 'games doit être un tableau'], 400);
    }
    $safeReason = preg_replace('/[^a-z0-9-]+/', '-', strtolower((string) $reason));
    $safeReason = trim($safeReason, '-') ?: 'save';
    $filename = sprintf('games_%s_%s.json', $safeReason, date('Y-m-d_H-i-s'));
    write_json_file($backupsDir . '/' . $filename, $games);
    json_out(['ok' => true, 'filename' => $filename, 'reason' => $reason]);
}

json_out(['error' => 'Not found'], 404);
