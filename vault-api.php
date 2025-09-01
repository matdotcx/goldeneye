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
if (!in_array($type, ['backup', 'enrollment', 'vault', 'git'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid type parameter']);
    exit();
}

try {
    // Handle authentication for enrollment operations
    // List and download don't require auth (needed for initial sync)
    // Only upload requires authentication
    if ($type === 'enrollment' && $action === 'upload') {
        $authToken = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
        if (!validateAuthToken($authToken)) {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required']);
            exit();
        }
    }
    
    // Handle authentication for Git write operations
    if ($type === 'git' && in_array($action, ['add-remote', 'remove-remote', 'generate-key', 'delete-key', 'push'])) {
        $authToken = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
        if (!validateAuthToken($authToken)) {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required']);
            exit();
        }
    }
    
    // Handle Git operations separately
    if ($type === 'git') {
        handleGitOperation($method, $action);
        exit();
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

// =============================================================================
// Git Management Functions
// =============================================================================

function handleGitOperation($method, $action) {
    switch ($action) {
        case 'status':
            if ($method === 'GET') {
                getGitStatus();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case 'remotes':
            if ($method === 'GET') {
                listGitRemotes();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case 'add-remote':
            if ($method === 'POST') {
                addGitRemote();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case 'remove-remote':
            if ($method === 'POST') {
                removeGitRemote();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case 'test-connection':
            if ($method === 'POST') {
                testGitConnection();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case 'list-keys':
            if ($method === 'GET') {
                listSSHKeys();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case 'generate-key':
            if ($method === 'POST') {
                generateSSHKey();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case 'view-key':
            if ($method === 'GET') {
                viewSSHKey();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case 'delete-key':
            if ($method === 'POST') {
                deleteSSHKey();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case 'push':
            if ($method === 'POST') {
                pushToRemote();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case 'history':
            if ($method === 'GET') {
                getGitHistory();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Invalid Git action']);
            break;
    }
}

/**
 * Get Git repository status
 */
function getGitStatus() {
    $gitDir = GIT_BACKUP_DIR . '.git';
    
    if (!is_dir($gitDir)) {
        echo json_encode([
            'initialized' => false,
            'message' => 'Git repository not initialized'
        ]);
        return;
    }
    
    // Get branch
    exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git branch --show-current 2>&1', $branch, $branchCode);
    
    // Get commit count
    exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git rev-list --count HEAD 2>&1', $countOutput, $countCode);
    
    // Get last commit
    exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git log -1 --format="%h %s (%ar)" 2>&1', $lastCommit, $lastCode);
    
    // Check for uncommitted changes
    exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git status --porcelain 2>&1', $statusOutput, $statusCode);
    
    echo json_encode([
        'initialized' => true,
        'branch' => $branchCode === 0 ? $branch[0] : 'unknown',
        'commitCount' => $countCode === 0 ? intval($countOutput[0]) : 0,
        'lastCommit' => $lastCode === 0 && !empty($lastCommit[0]) ? $lastCommit[0] : 'No commits yet',
        'hasChanges' => !empty($statusOutput)
    ]);
}

/**
 * List configured Git remotes
 */
function listGitRemotes() {
    if (!is_dir(GIT_BACKUP_DIR . '.git')) {
        echo json_encode(['remotes' => []]);
        return;
    }
    
    exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git remote -v 2>&1', $output, $returnCode);
    
    $remotes = [];
    $seen = [];
    
    foreach ($output as $line) {
        if (preg_match('/^(\S+)\s+(\S+)\s+\(fetch\)/', $line, $matches)) {
            $name = $matches[1];
            $url = $matches[2];
            
            if (!isset($seen[$name])) {
                $remotes[] = ['name' => $name, 'url' => $url];
                $seen[$name] = true;
            }
        }
    }
    
    echo json_encode(['remotes' => $remotes]);
}

/**
 * Add a Git remote
 */
function addGitRemote() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!$data || !isset($data['name']) || !isset($data['url'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing remote name or URL']);
        return;
    }
    
    $name = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['name']);
    $url = $data['url'];
    
    // Validate URL format
    if (!filter_var($url, FILTER_VALIDATE_URL) && !preg_match('/^git@[^:]+:.*\.git$/', $url)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid URL format']);
        return;
    }
    
    // Initialize Git if needed
    if (!is_dir(GIT_BACKUP_DIR . '.git')) {
        initGitBackup();
    }
    
    // Add remote
    $command = 'cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git remote add ' . escapeshellarg($name) . ' ' . escapeshellarg($url) . ' 2>&1';
    exec($command, $output, $returnCode);
    
    if ($returnCode !== 0) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to add remote: ' . implode(' ', $output)]);
        return;
    }
    
    echo json_encode(['success' => true, 'message' => 'Remote added successfully']);
}

/**
 * Remove a Git remote
 */
function removeGitRemote() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!$data || !isset($data['name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing remote name']);
        return;
    }
    
    $name = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['name']);
    
    $command = 'cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git remote remove ' . escapeshellarg($name) . ' 2>&1';
    exec($command, $output, $returnCode);
    
    if ($returnCode !== 0) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to remove remote: ' . implode(' ', $output)]);
        return;
    }
    
    echo json_encode(['success' => true, 'message' => 'Remote removed successfully']);
}

/**
 * Test connection to a Git remote
 */
function testGitConnection() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!$data || !isset($data['remote'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing remote name']);
        return;
    }
    
    $remote = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['remote']);
    
    // Try to fetch from remote (dry-run)
    $command = 'cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git ls-remote ' . escapeshellarg($remote) . ' HEAD 2>&1';
    exec($command, $output, $returnCode);
    
    if ($returnCode === 0) {
        echo json_encode(['success' => true, 'message' => 'Connection successful']);
    } else {
        echo json_encode(['success' => false, 'error' => implode(' ', $output)]);
    }
}

/**
 * List SSH keys
 */
function listSSHKeys() {
    $sshDir = DATA_DIR . '.ssh/';
    
    if (!is_dir($sshDir)) {
        echo json_encode(['keys' => []]);
        return;
    }
    
    $keys = [];
    $files = glob($sshDir . '*.pub');
    
    foreach ($files as $file) {
        $name = basename($file, '.pub');
        $content = file_get_contents($file);
        
        // Extract key type
        $type = 'unknown';
        if (strpos($content, 'ssh-rsa') === 0) {
            $type = 'RSA';
        } elseif (strpos($content, 'ssh-ed25519') === 0) {
            $type = 'Ed25519';
        } elseif (strpos($content, 'ecdsa-sha2-') === 0) {
            $type = 'ECDSA';
        }
        
        $keys[] = [
            'name' => $name,
            'type' => $type,
            'fingerprint' => substr(md5($content), 0, 16)
        ];
    }
    
    echo json_encode(['keys' => $keys]);
}

/**
 * Generate SSH key
 */
function generateSSHKey() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!$data || !isset($data['name']) || !isset($data['type'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing key name or type']);
        return;
    }
    
    $name = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['name']);
    $type = $data['type'];
    
    // Validate type
    if (!in_array($type, ['ed25519', 'rsa'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid key type']);
        return;
    }
    
    // Create SSH directory if needed
    $sshDir = DATA_DIR . '.ssh/';
    if (!is_dir($sshDir)) {
        mkdir($sshDir, 0700, true);
    }
    
    $keyPath = $sshDir . $name;
    
    // Check if key already exists
    if (file_exists($keyPath)) {
        http_response_code(400);
        echo json_encode(['error' => 'Key with this name already exists']);
        return;
    }
    
    // Generate key
    $command = 'ssh-keygen -t ' . escapeshellarg($type) . ' -f ' . escapeshellarg($keyPath) . ' -N "" -C "goldeneye@' . $_SERVER['HTTP_HOST'] . '" 2>&1';
    exec($command, $output, $returnCode);
    
    if ($returnCode !== 0) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to generate key: ' . implode(' ', $output)]);
        return;
    }
    
    // Read public key
    $publicKey = file_get_contents($keyPath . '.pub');
    
    // Set proper permissions
    chmod($keyPath, 0600);
    chmod($keyPath . '.pub', 0644);
    
    echo json_encode([
        'success' => true,
        'publicKey' => $publicKey,
        'message' => 'SSH key generated successfully'
    ]);
}

/**
 * View SSH public key
 */
function viewSSHKey() {
    $keyName = $_GET['key'] ?? '';
    
    if (!$keyName) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing key name']);
        return;
    }
    
    $keyName = preg_replace('/[^a-zA-Z0-9_-]/', '', $keyName);
    $keyPath = DATA_DIR . '.ssh/' . $keyName . '.pub';
    
    if (!file_exists($keyPath)) {
        http_response_code(404);
        echo json_encode(['error' => 'Key not found']);
        return;
    }
    
    $publicKey = file_get_contents($keyPath);
    echo json_encode(['publicKey' => $publicKey]);
}

/**
 * Delete SSH key
 */
function deleteSSHKey() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!$data || !isset($data['name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing key name']);
        return;
    }
    
    $name = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['name']);
    $keyPath = DATA_DIR . '.ssh/' . $name;
    
    if (!file_exists($keyPath)) {
        http_response_code(404);
        echo json_encode(['error' => 'Key not found']);
        return;
    }
    
    // Delete both private and public keys
    @unlink($keyPath);
    @unlink($keyPath . '.pub');
    
    echo json_encode(['success' => true, 'message' => 'Key deleted successfully']);
}

/**
 * Push to remote repository
 */
function pushToRemote() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!$data || !isset($data['remote'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing remote name']);
        return;
    }
    
    $remote = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['remote']);
    
    // First, commit any uncommitted changes
    exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git add . && git commit -m "Auto-commit before push" 2>&1', $commitOutput, $commitCode);
    
    // Configure SSH if needed
    $sshCommand = '';
    $sshKeys = glob(DATA_DIR . '.ssh/*.pub');
    if (!empty($sshKeys)) {
        $privateKey = str_replace('.pub', '', $sshKeys[0]);
        $sshCommand = 'GIT_SSH_COMMAND="ssh -i ' . escapeshellarg($privateKey) . ' -o StrictHostKeyChecking=no" ';
    }
    
    // Push to remote
    $command = 'cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && ' . $sshCommand . 'git push ' . escapeshellarg($remote) . ' main 2>&1';
    exec($command, $output, $returnCode);
    
    if ($returnCode === 0) {
        echo json_encode(['success' => true, 'message' => 'Successfully pushed to remote']);
    } else {
        echo json_encode(['success' => false, 'error' => implode(' ', $output)]);
    }
}

/**
 * Get Git commit history
 */
function getGitHistory() {
    if (!is_dir(GIT_BACKUP_DIR . '.git')) {
        echo json_encode(['commits' => []]);
        return;
    }
    
    exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git log --format="%H|%s|%ai" -20 2>&1', $output, $returnCode);
    
    $commits = [];
    foreach ($output as $line) {
        $parts = explode('|', $line, 3);
        if (count($parts) === 3) {
            $commits[] = [
                'hash' => $parts[0],
                'message' => $parts[1],
                'date' => $parts[2]
            ];
        }
    }
    
    echo json_encode(['commits' => $commits]);
}
?>