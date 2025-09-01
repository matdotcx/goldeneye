<?php
// Simple PHP test file
header('Content-Type: application/json');
echo json_encode([
    'status' => 'ok',
    'message' => 'PHP is working',
    'php_version' => phpversion(),
    'backup_dir' => dirname(__DIR__) . '/backups/',
    'backup_dir_exists' => is_dir(dirname(__DIR__) . '/backups/')
]);
?>