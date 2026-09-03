<?php
/**
 * API JSON pour Plesk/Apache (sans Node/Passenger).
 * Docroot = .../httpdocs/dist → data = .../httpdocs/data
 */
header('Content-Type: application/json; charset=utf-8');

error_reporting(E_ALL);
ini_set('display_errors', '0');

function json_out($data, $code = 200)
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // dist/api → httpdocs/data (parent de dist)
    $candidates = [
        dirname(dirname(__DIR__)) . '/data',    // .../httpdocs/data
        dirname(__DIR__) . '/data',             // .../dist/data
        sys_get_temp_dir() . '/mtg_stats_data',
    ];

    $dataDir = null;
    $errors = [];
    foreach ($candidates as $dir) {
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
                $errors[] = "mkdir failed: $dir";
                continue;
            }
        }
        if (!is_writable($dir)) {
            $errors[] = "not writable: $dir";
            continue;
        }
        $dataDir = $dir;
        break;
    }

    if ($dataDir === null) {
        json_out([
            'error' => 'Aucun dossier data accessible en écriture',
            'details' => $errors,
            'hint' => 'Crée httpdocs/data avec droits 775 (utilisateur du site Plesk)',
        ], 500);
    }

    $backupsDir = $dataDir . '/backups';
    if (!is_dir($backupsDir) && !@mkdir($backupsDir, 0775, true) && !is_dir($backupsDir)) {
        json_out(['error' => 'Impossible de créer backups', 'dir' => $backupsDir], 500);
    }

    $files = [
        'games' => $dataDir . '/games.json',
        'users' => $dataDir . '/users.json',
        'decks' => $dataDir . '/decks.json',
    ];

    foreach ($files as $filePath) {
        if (!file_exists($filePath)) {
            if (@file_put_contents($filePath, "[]\n") === false) {
                json_out(['error' => 'Impossible de créer ' . basename($filePath), 'path' => $filePath], 500);
            }
        }
    }

    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $uriPath = rtrim((string) $uriPath, '/') ?: '/';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    function read_json_file($path)
    {
        $raw = @file_get_contents($path);
        if ($raw === false) {
            json_out(['error' => 'Lecture impossible', 'path' => $path], 500);
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    function write_json_file($path, $data)
    {
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            json_out(['error' => 'Encodage JSON impossible'], 500);
        }
        $ok = @file_put_contents($path, $json . "\n", LOCK_EX);
        if ($ok === false) {
            json_out(['error' => 'Écriture impossible', 'path' => $path], 500);
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

    // Health check
    if ($uriPath === '/api' || $uriPath === '/api/health') {
        json_out(['ok' => true, 'dataDir' => $dataDir, 'engine' => 'php']);
    }

    if ($uriPath === '/api/users' && $method === 'GET') {
        json_out(read_json_file($files['users']));
    }
    if ($uriPath === '/api/users' && $method === 'POST') {
        $data = request_body();
        // Accepte un tableau indexé
        if ($data !== [] && array_keys($data) !== range(0, count($data) - 1)) {
            json_out(['error' => 'users doit être un tableau'], 400);
        }
        write_json_file($files['users'], $data);
        json_out(['ok' => true]);
    }

    if ($uriPath === '/api/decks' && $method === 'GET') {
        json_out(read_json_file($files['decks']));
    }
    if ($uriPath === '/api/decks' && $method === 'POST') {
        $data = request_body();
        write_json_file($files['decks'], $data);
        json_out(['ok' => true]);
    }

    if ($uriPath === '/api/games' && $method === 'GET') {
        json_out(read_json_file($files['games']));
    }
    if ($uriPath === '/api/games' && $method === 'POST') {
        $data = request_body();
        write_json_file($files['games'], $data);
        json_out(['ok' => true]);
    }

    if ($uriPath === '/api/games/backup' && $method === 'GET') {
        $list = [];
        foreach (glob($backupsDir . '/*.json') ?: [] as $file) {
            $list[] = [
                'name' => basename($file),
                'mtime' => filemtime($file) * 1000,
            ];
        }
        usort($list, function ($a, $b) {
            return $b['mtime'] <=> $a['mtime'];
        });
        json_out($list);
    }

    if ($uriPath === '/api/games/backup' && $method === 'POST') {
        $parsed = request_body();
        if (array_key_exists('games', $parsed)) {
            $games = $parsed['games'];
            $reason = isset($parsed['reason']) ? $parsed['reason'] : 'save';
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

    json_out(['error' => 'Not found', 'path' => $uriPath], 404);
} catch (Throwable $e) {
    json_out([
        'error' => 'Exception PHP',
        'message' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
    ], 500);
}
