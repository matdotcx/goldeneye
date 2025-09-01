<?php
/**
 * Goldeneye Vault API
 * Handles enrollment persistence, vault backups, and encrypted data storage
 * Supports multiple data types with different retention policies
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuration
define('DATA_DIR', __DIR__ . '/data/');
define('BACKUP_DIR', DATA_DIR . 'backups/');
define('ENROLLMENT_DIR', DATA_DIR . 'enrollments/');
define('VAULT_DIR', DATA_DIR . 'vaults/');
define('GIT_BACKUP_DIR', DATA_DIR . 'git-backup/');

define('MAX_DATA_SIZE', 1024 * 1024); // 1MB limit
define('BACKUP_RETENTION_DAYS', 365); // Keep backups for 1 year
define('VAULT_RETENTION_DAYS', 365); // Keep vaults for 1 year
define('ENROLLMENT_RETENTION_DAYS', -1); // Never expire enrollments

// Authentication token lifetime (5 minutes)
define('AUTH_TOKEN_LIFETIME', 300);

// Ensure all data directories exist
$directories = [DATA_DIR, BACKUP_DIR, ENROLLMENT_DIR, VAULT_DIR, GIT_BACKUP_DIR];
foreach ($directories as $dir) {
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create directory: ' . $dir]);
            exit();
        }
    }
}

// Initialize Git backup repository if not exists
initGitBackup();

// Get request parameters
$method = $_SERVER['REQUEST_METHOD'];
$type = $_GET['type'] ?? 'backup'; // backup, enrollment, or vault
$action = $_GET['action'] ?? ''; // list, upload, download, auth, etc.

// Validate type
if (!in_array($type, ['backup', 'enrollment', 'vault'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid type parameter']);
    exit();
}

try {
    // Handle authentication for enrollment operations
    if ($type === 'enrollment' && $action !== 'auth') {
        $authToken = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
        if (!validateAuthToken($authToken)) {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required']);
            exit();
        }
    }
    
    switch ($method) {
        case 'POST':
            handlePost($type, $action);
            break;
            
        case 'GET':
            handleGet($type, $action);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            break;
    }
} catch (Exception $e) {
    error_log('Goldeneye vault API error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}

function handlePost($type, $action) {
    switch ($action) {
        case 'upload':
            handleUpload($type);
            break;
            
        case 'auth':
            if ($type === 'enrollment') {
                handleAuth();
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'Auth only available for enrollment type']);
            }
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function handleGet($type, $action) {
    if ($action === 'list') {
        handleList($type);
    } elseif (strpos($action, 'download/') === 0) {
        $id = substr($action, 9);
        handleDownload($type, $id);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Invalid action']);
    }
}

function handleAuth() {
    // Get authentication data from request
    $input = file_get_contents('php://input');
    $authData = json_decode($input, true);
    
    if (!$authData || !isset($authData['credentialId']) || !isset($authData['signature'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing authentication data']);
        return;
    }
    
    // Generate auth token based on credential and timestamp
    $timestamp = time();
    $token = hash('sha256', $authData['credentialId'] . $authData['signature'] . $timestamp);
    
    // Store token with expiration (in production, use proper session storage)
    $tokenFile = DATA_DIR . '.auth_tokens/' . $token . '.json';
    if (!is_dir(DATA_DIR . '.auth_tokens/')) {
        mkdir(DATA_DIR . '.auth_tokens/', 0755, true);
    }
    
    file_put_contents($tokenFile, json_encode([
        'credentialId' => $authData['credentialId'],
        'expires' => $timestamp + AUTH_TOKEN_LIFETIME
    ]));
    
    echo json_encode([
        'success' => true,
        'token' => $token,
        'expires' => $timestamp + AUTH_TOKEN_LIFETIME
    ]);
}

function validateAuthToken($token) {
    if (empty($token)) {
        return false;
    }
    
    $tokenFile = DATA_DIR . '.auth_tokens/' . $token . '.json';
    if (!file_exists($tokenFile)) {
        return false;
    }
    
    $tokenData = json_decode(file_get_contents($tokenFile), true);
    if (!$tokenData || $tokenData['expires'] < time()) {
        // Token expired, remove it
        @unlink($tokenFile);
        return false;
    }
    
    return true;
}

function handleUpload($type) {
    // Get JSON input
    $input = file_get_contents('php://input');
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'No data provided']);
        return;
    }
    
    // Check size limit
    if (strlen($input) > MAX_DATA_SIZE) {
        http_response_code(413);
        echo json_encode(['error' => 'Data too large']);
        return;
    }
    
    // Validate JSON
    $data = json_decode($input, true);
    if (!$data) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON format']);
        return;
    }
    
    // Determine directory and ID generation based on type
    $dir = getDirectoryForType($type);
    
    if ($type === 'enrollment') {
        // For enrollments, use deterministic ID based on credential
        if (!isset($data['credentialId'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing credentialId for enrollment']);
            return;
        }
        $dataId = hash('sha256', $data['credentialId']);
    } else {
        // For backups and vaults, generate unique ID
        $dataId = generateId();
    }
    
    // Create metadata
    $metadata = [
        'id' => $dataId,
        'type' => $type,
        'uploadedAt' => date('Y-m-d H:i:s'),
        'clientIp' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'dataSize' => strlen($input)
    ];
    
    // Save data file
    $dataFile = $dir . $dataId . '.json';
    $metadataFile = $dir . $dataId . '.meta.json';
    
    if (!file_put_contents($dataFile, $input)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save data']);
        return;
    }
    
    if (!file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT))) {
        error_log('Failed to save metadata for ' . $type . ' ' . $dataId);
    }
    
    // Git backup for enrollments
    if ($type === 'enrollment') {
        gitBackup($dataFile, "Add/update enrollment: " . $dataId);
    }
    
    // Clean up old data (not for enrollments)
    if ($type !== 'enrollment') {
        cleanupOldData($type);
    }
    
    // Return success response
    echo json_encode([
        'success' => true,
        'id' => $dataId,
        'message' => ucfirst($type) . ' uploaded successfully',
        'metadata' => $metadata
    ]);
}

function handleList($type) {
    $dir = getDirectoryForType($type);
    $files = glob($dir . '*.json');
    $items = [];
    
    foreach ($files as $file) {
        $basename = basename($file, '.json');
        
        // Skip metadata files
        if (strpos($basename, '.meta') !== false) {
            continue;
        }
        
        $metadataFile = $dir . $basename . '.meta.json';
        $item = [
            'id' => $basename,
            'file' => $file,
            'size' => filesize($file),
            'created' => date('Y-m-d H:i:s', filemtime($file))
        ];
        
        // Load metadata if available
        if (file_exists($metadataFile)) {
            $metadata = json_decode(file_get_contents($metadataFile), true);
            if ($metadata) {
                $item = array_merge($item, $metadata);
            }
        }
        
        $items[] = $item;
    }
    
    // Sort by creation date (newest first)
    usort($items, function($a, $b) {
        return strtotime($b['created']) - strtotime($a['created']);
    });
    
    echo json_encode([
        'success' => true,
        'type' => $type,
        'items' => $items,
        'count' => count($items)
    ]);
}

function handleDownload($type, $id) {
    // Validate ID format
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid ID format']);
        return;
    }
    
    $dir = getDirectoryForType($type);
    $dataFile = $dir . $id . '.json';
    
    if (!file_exists($dataFile)) {
        http_response_code(404);
        echo json_encode(['error' => ucfirst($type) . ' not found']);
        return;
    }
    
    // Load and validate data
    $data = file_get_contents($dataFile);
    if (!$data) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to read data']);
        return;
    }
    
    // Validate JSON
    $jsonData = json_decode($data, true);
    if (!$jsonData) {
        http_response_code(500);
        echo json_encode(['error' => 'Corrupted data']);
        return;
    }
    
    // Log access
    $metadataFile = $dir . $id . '.meta.json';
    if (file_exists($metadataFile)) {
        $metadata = json_decode(file_get_contents($metadataFile), true);
        $metadata['lastAccessed'] = date('Y-m-d H:i:s');
        $metadata['accessCount'] = ($metadata['accessCount'] ?? 0) + 1;
        file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT));
    }
    
    // Return data
    header('Content-Type: application/json');
    echo $data;
}

function getDirectoryForType($type) {
    switch ($type) {
        case 'enrollment':
            return ENROLLMENT_DIR;
        case 'vault':
            return VAULT_DIR;
        case 'backup':
        default:
            return BACKUP_DIR;
    }
}

function getRetentionDaysForType($type) {
    switch ($type) {
        case 'enrollment':
            return ENROLLMENT_RETENTION_DAYS;
        case 'vault':
            return VAULT_RETENTION_DAYS;
        case 'backup':
        default:
            return BACKUP_RETENTION_DAYS;
    }
}

function generateId() {
    // Generate a secure, URL-safe ID
    $timestamp = date('Ymd_His');
    $random = bin2hex(random_bytes(8));
    return $timestamp . '_' . $random;
}

function cleanupOldData($type) {
    $retentionDays = getRetentionDaysForType($type);
    
    // Skip cleanup if retention is -1 (never expire)
    if ($retentionDays < 0) {
        return;
    }
    
    $dir = getDirectoryForType($type);
    $cutoffTime = time() - ($retentionDays * 24 * 60 * 60);
    
    $files = glob($dir . '*.json');
    foreach ($files as $file) {
        if (filemtime($file) < $cutoffTime) {
            $basename = basename($file, '.json');
            @unlink($file); // Data file
            @unlink($dir . $basename . '.meta.json'); // Metadata file
        }
    }
}

// Git backup functions
function initGitBackup() {
    $gitDir = GIT_BACKUP_DIR . '.git';
    if (!is_dir($gitDir)) {
        // Initialize git repository
        exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git init 2>&1', $output, $returnCode);
        if ($returnCode === 0) {
            // Set git config
            exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git config user.email "goldeneye@localhost" 2>&1');
            exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git config user.name "Goldeneye Backup" 2>&1');
            
            // Create initial commit
            file_put_contents(GIT_BACKUP_DIR . 'README.md', "# Goldeneye Enrollment Backups\n\nAutomated backup of enrollment data.\n");
            exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git add . && git commit -m "Initial commit" 2>&1');
        }
    }
}

function gitBackup($sourceFile, $message) {
    // Copy file to git backup directory
    $filename = basename($sourceFile);
    $destFile = GIT_BACKUP_DIR . $filename;
    
    if (!copy($sourceFile, $destFile)) {
        error_log('Failed to copy file to git backup: ' . $sourceFile);
        return false;
    }
    
    // Also copy metadata if exists
    $metaFile = str_replace('.json', '.meta.json', $sourceFile);
    if (file_exists($metaFile)) {
        copy($metaFile, GIT_BACKUP_DIR . basename($metaFile));
    }
    
    // Git add and commit
    $commands = [
        'cd ' . escapeshellarg(GIT_BACKUP_DIR),
        'git add .',
        'git commit -m ' . escapeshellarg($message) . ' 2>&1'
    ];
    
    $command = implode(' && ', $commands);
    exec($command, $output, $returnCode);
    
    if ($returnCode !== 0 && $returnCode !== 1) { // Return code 1 means nothing to commit
        error_log('Git backup failed: ' . implode("\n", $output));
        return false;
    }
    
    return true;
}

// Clean up expired auth tokens periodically
function cleanupAuthTokens() {
    $tokenDir = DATA_DIR . '.auth_tokens/';
    if (!is_dir($tokenDir)) {
        return;
    }
    
    $files = glob($tokenDir . '*.json');
    foreach ($files as $file) {
        $tokenData = json_decode(file_get_contents($file), true);
        if (!$tokenData || $tokenData['expires'] < time()) {
            @unlink($file);
        }
    }
}

// Run token cleanup occasionally
if (rand(1, 100) === 1) {
    cleanupAuthTokens();
}
?>