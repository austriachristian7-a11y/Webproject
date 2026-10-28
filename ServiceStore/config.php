<?php
declare(strict_types=1);

// XAMPP defaults: MySQL user "root" with an empty password.
// Change these values if your local MySQL configuration differs.
const DB_HOST = '127.0.0.1';
const DB_NAME = 'northstar_store';
const DB_USER = 'root';
const DB_PASS = '';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    return $pdo;
}

function json_response(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_data(): array
{
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : $_POST;
}

function current_user(): ?array
{
    return isset($_SESSION['user']) && is_array($_SESSION['user']) ? $_SESSION['user'] : null;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) json_response(['error' => 'Please sign in first.'], 401);
    return $user;
}

function require_admin(): array
{
    $user = require_user();
    if ($user['role'] !== 'admin') json_response(['error' => 'Admin access required.'], 403);
    return $user;
}

function clean_text(mixed $value, int $max = 255): string
{
    return mb_substr(trim((string)$value), 0, $max);
}
