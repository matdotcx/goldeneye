<?php
/**
 * Goldeneye Backup API
 * Simple server-side backup storage for encrypted vault data
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuration
define('BACKUP_DIR', __DIR__ . '/backups/');
define('MAX_BACKUP_SIZE', 1024 * 1024); // 1MB limit
define('BACKUP_RETENTION_DAYS', 365); // Keep backups for 1 year

// Ensure backup directory exists
if (!is_dir(BACKUP_DIR)) {
    if (!mkdir(BACKUP_DIR, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create backup directory']);
        exit();
    }
}

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = $_GET['path'] ?? '';

try {
    switch ($method) {
        case 'POST':
            if ($path === 'upload') {
                handleUpload();
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Invalid endpoint']);
            }
            break;
            
        case 'GET':
            if (strpos($path, 'download/') === 0) {
                $backupId = substr($path, 9); // Remove 'download/' prefix
                handleDownload($backupId);
            } elseif ($path === 'list') {
                handleList();
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Invalid endpoint']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            break;
    }
} catch (Exception $e) {
    error_log('Goldeneye backup error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}

function handleUpload() {
    // Get JSON input
    $input = file_get_contents('php://input');
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'No backup data provided']);
        return;
    }
    
    // Check size limit
    if (strlen($input) > MAX_BACKUP_SIZE) {
        http_response_code(413);
        echo json_encode(['error' => 'Backup file too large']);
        return;
    }
    
    // Validate JSON
    $backupData = json_decode($input, true);
    if (!$backupData) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON format']);
        return;
    }
    
    // Validate required fields
    if (!isset($backupData['version']) || !isset($backupData['keys']) || !isset($backupData['vaults'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid backup format - missing required fields']);
        return;
    }
    
    // Generate unique backup ID
    $backupId = generateBackupId();
    
    // Create backup metadata
    $metadata = [
        'id' => $backupId,
        'uploadedAt' => date('Y-m-d H:i:s'),
        'clientIp' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'dataSize' => strlen($input),
        'keyCount' => count($backupData['keys'] ?? []),
        'vaultCount' => count($backupData['vaults'] ?? [])
    ];
    
    // Save backup file
    $backupFile = BACKUP_DIR . $backupId . '.json';
    $metadataFile = BACKUP_DIR . $backupId . '.meta.json';
    
    if (!file_put_contents($backupFile, $input)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save backup file']);
        return;
    }
    
    if (!file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT))) {
        // Non-fatal error - backup is saved but without metadata
        error_log('Failed to save metadata for backup ' . $backupId);
    }
    
    // Clean up old backups
    cleanupOldBackups();
    
    // Return success response
    echo json_encode([
        'success' => true,
        'backupId' => $backupId,
        'message' => 'Backup uploaded successfully',
        'metadata' => $metadata
    ]);
}

function handleList() {
    // Get all backup files
    $backupFiles = glob(BACKUP_DIR . '*.json');
    $backups = [];
    
    foreach ($backupFiles as $backupFile) {
        $basename = basename($backupFile, '.json');
        
        // Skip metadata files
        if (strpos($basename, '.meta') !== false) {
            continue;
        }
        
        $metadataFile = BACKUP_DIR . $basename . '.meta.json';
        $backup = [
            'id' => $basename,
            'file' => $backupFile,
            'size' => filesize($backupFile),
            'created' => date('Y-m-d H:i:s', filemtime($backupFile))
        ];
        
        // Load metadata if available
        if (file_exists($metadataFile)) {
            $metadata = json_decode(file_get_contents($metadataFile), true);
            if ($metadata) {
                $backup = array_merge($backup, $metadata);
            }
        }
        
        $backups[] = $backup;
    }
    
    // Sort by creation date (newest first)
    usort($backups, function($a, $b) {
        return strtotime($b['created']) - strtotime($a['created']);
    });
    
    echo json_encode([
        'success' => true,
        'backups' => $backups,
        'count' => count($backups)
    ]);
}

function handleDownload($backupId) {
    // Validate backup ID format
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $backupId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid backup ID format']);
        return;
    }
    
    $backupFile = BACKUP_DIR . $backupId . '.json';
    
    if (!file_exists($backupFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'Backup not found']);
        return;
    }
    
    // Load and validate backup data
    $backupData = file_get_contents($backupFile);
    if (!$backupData) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to read backup file']);
        return;
    }
    
    // Validate JSON
    $data = json_decode($backupData, true);
    if (!$data) {
        http_response_code(500);
        echo json_encode(['error' => 'Corrupted backup file']);
        return;
    }
    
    // Log access
    $metadataFile = BACKUP_DIR . $backupId . '.meta.json';
    if (file_exists($metadataFile)) {
        $metadata = json_decode(file_get_contents($metadataFile), true);
        $metadata['lastAccessed'] = date('Y-m-d H:i:s');
        $metadata['accessCount'] = ($metadata['accessCount'] ?? 0) + 1;
        file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT));
    }
    
    // Return backup data
    header('Content-Type: application/json');
    echo $backupData;
}

function generateBackupId() {
    // Generate a secure, URL-safe backup ID
    $timestamp = date('Ymd_His');
    $random = bin2hex(random_bytes(8));
    return $timestamp . '_' . $random;
}

function cleanupOldBackups() {
    $cutoffTime = time() - (BACKUP_RETENTION_DAYS * 24 * 60 * 60);
    
    $files = glob(BACKUP_DIR . '*.json');
    foreach ($files as $file) {
        if (filemtime($file) < $cutoffTime) {
            $basename = basename($file, '.json');
            @unlink($file); // Backup file
            @unlink(BACKUP_DIR . $basename . '.meta.json'); // Metadata file
        }
    }
}

// Utility function to validate backup data structure
function validateBackupStructure($data) {
    $required = ['version', 'keys', 'vaults', 'settings'];
    
    foreach ($required as $field) {
        if (!isset($data[$field])) {
            return false;
        }
    }
    
    // Validate keys structure
    if (!is_array($data['keys'])) {
        return false;
    }
    
    // Validate vaults structure
    if (!is_array($data['vaults'])) {
        return false;
    }
    
    return true;
}
?>