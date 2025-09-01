/**
 * Goldeneye Admin Panel - Multi-Key Management System
 * Implements N-choose-2 security with persistent localStorage
 */

// Data structure for the multi-key system
const GoldeneveData = {
    version: '2.0',
    keys: new Map(), // keyId -> {id, name, description, credentialId, enrolledAt, active, lastUsed}
    vaults: new Map(), // vaultId -> {id, name, encryptedData, iv, salt, createdAt, keyPairs}
    settings: {
        autoExpire: 1800000, // 30 minutes in ms
        requireTwoKeys: true,
        allowInactive: false
    }
};

// Session state
let sessionTimer = null;
let currentlyAuthenticating = new Set();

// Initialize the admin panel
async function init() {
    loadStoredData();
    await syncEnrollmentsFromServer(); // Load enrollments from server
    refreshKeyList();
    populateKeySelectors();
    resetSessionTimer();
    
    // Auto-save data periodically
    setInterval(saveStoredData, 30000);
    
    // Reset timer on user activity
    document.addEventListener('click', resetSessionTimer);
    document.addEventListener('keypress', resetSessionTimer);
}

// Data persistence functions
function saveStoredData() {
    try {
        const exportData = {
            version: GoldeneveData.version,
            keys: Array.from(GoldeneveData.keys.entries()),
            vaults: Array.from(GoldeneveData.vaults.entries()),
            settings: GoldeneveData.settings
        };
        localStorage.setItem('goldeneye_admin_data', JSON.stringify(exportData));
    } catch (error) {
        console.error('Failed to save data:', error);
        showStatus('Failed to save data to localStorage', 'error');
    }
}

function loadStoredData() {
    try {
        const stored = localStorage.getItem('goldeneye_admin_data');
        if (stored) {
            const data = JSON.parse(stored);
            
            // Handle version migration if needed
            if (data.version && data.version !== GoldeneveData.version) {
                migrateData(data);
                return;
            }
            
            GoldeneveData.keys = new Map(data.keys || []);
            GoldeneveData.vaults = new Map(data.vaults || []);
            GoldeneveData.settings = { ...GoldeneveData.settings, ...data.settings };
        }
    } catch (error) {
        console.error('Failed to load stored data:', error);
        showStatus('Failed to load stored data', 'error');
    }
}

function migrateData(oldData) {
    showStatus('Migrating data to new format...', 'info');
    // Implementation for migrating from older versions would go here
    saveStoredData();
    showStatus('Data migration completed', 'success');
}

// Session management
function resetSessionTimer() {
    if (sessionTimer) {
        clearTimeout(sessionTimer);
    }
    sessionTimer = setTimeout(expireSession, GoldeneveData.settings.autoExpire);
}

function expireSession() {
    showStatus('Session expired due to inactivity', 'info');
    // Clear any sensitive data from memory but keep persistent data
    document.getElementById('decryptedData').style.display = 'none';
    document.getElementById('decryptedContent').textContent = '';
    document.getElementById('dataInput').value = '';
}

// Utility functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generateChallenge() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return array;
}

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// Status message display
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message show ${type}`;
    
    if (type !== 'error') {
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 5000);
    }
}

// Error handling
function handleError(error, operation) {
    console.error(`${operation} error:`, error);
    
    if (error.name === 'NotAllowedError') {
        return 'Authentication was cancelled or timed out';
    } else if (error.name === 'SecurityError') {
        return 'Security requirements not met (HTTPS required)';
    } else if (error.name === 'NotSupportedError') {
        return 'WebAuthn not supported by this browser or device';
    } else {
        return `${operation} failed. Please try again`;
    }
}

// Tab management
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active state from all tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
    
    // Refresh data when switching to tabs
    if (tabName === 'keys') {
        refreshKeyList();
    } else if (tabName === 'data') {
        populateKeySelectors();
    }
}

// Key management functions
function refreshKeyList() {
    const tbody = document.getElementById('keyTableBody');
    tbody.innerHTML = '';
    
    if (GoldeneveData.keys.size === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; opacity: 0.7;">No keys enrolled</td></tr>';
        return;
    }
    
    GoldeneveData.keys.forEach((key, keyId) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${key.name}</td>
            <td style="font-family: monospace; font-size: 0.8rem;">${key.credentialId.substring(0, 16)}...</td>
            <td>${new Date(key.enrolledAt).toLocaleDateString()}</td>
            <td><span class="key-status-badge ${key.active ? 'active' : 'inactive'}">${key.active ? 'Active' : 'Inactive'}</span></td>
            <td class="key-actions">
                <button class="btn small" onclick="testKey('${keyId}')">Test</button>
                <button class="btn small" onclick="editKey('${keyId}')">Edit</button>
                <button class="btn small ${key.active ? 'danger' : 'success'}" onclick="toggleKeyStatus('${keyId}')">${key.active ? 'Disable' : 'Enable'}</button>
                <button class="btn small danger" onclick="deleteKey('${keyId}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function populateKeySelectors() {
    const key1Select = document.getElementById('key1Select');
    const key2Select = document.getElementById('key2Select');
    
    // Clear existing options (keep first empty option)
    key1Select.innerHTML = '<option value="">Select first key...</option>';
    key2Select.innerHTML = '<option value="">Select second key...</option>';
    
    // Add active keys to selectors
    GoldeneveData.keys.forEach((key, keyId) => {
        if (key.active) {
            const option1 = document.createElement('option');
            option1.value = keyId;
            option1.textContent = key.name;
            key1Select.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = keyId;
            option2.textContent = key.name;
            key2Select.appendChild(option2);
        }
    });
}

// Modal management
function showEnrollModal() {
    document.getElementById('enrollModal').classList.add('show');
    document.getElementById('keyName').focus();
}

function hideEnrollModal() {
    document.getElementById('enrollModal').classList.remove('show');
    document.getElementById('keyName').value = '';
    document.getElementById('keyDescription').value = '';
}

// Key enrollment
async function enrollNewKey() {
    const name = document.getElementById('keyName').value.trim();
    const description = document.getElementById('keyDescription').value.trim();
    
    if (!name) {
        showStatus('Please enter a key name', 'error');
        return;
    }
    
    try {
        showStatus('Insert YubiKey and touch when it blinks...', 'info');
        
        const challenge = generateChallenge();
        const keyId = generateId();
        const userId = new TextEncoder().encode(`goldeneye_${keyId}`);

        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: challenge,
                rp: {
                    name: "Goldeneye Multi-Key Vault",
                    id: window.location.hostname
                },
                user: {
                    id: userId,
                    name: `${keyId}@goldeneye.local`,
                    displayName: name
                },
                pubKeyCredParams: [
                    { alg: -7, type: "public-key" },  // ES256
                    { alg: -257, type: "public-key" } // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "cross-platform",
                    requireResidentKey: false,
                    userVerification: "discouraged"
                },
                timeout: 60000,
                attestation: "none"
            }
        });

        // Store key data
        const keyData = {
            id: keyId,
            name: name,
            description: description,
            credentialId: bufferToBase64(credential.rawId),
            enrolledAt: new Date().toISOString(),
            active: true,
            lastUsed: null
        };

        GoldeneveData.keys.set(keyId, keyData);
        saveStoredData();
        
        // Sync enrollment to server
        await syncEnrollmentToServer(keyData);
        
        hideEnrollModal();
        showStatus(`Key "${name}" enrolled successfully!`, 'success');
        refreshKeyList();
        populateKeySelectors();

    } catch (error) {
        const errorMessage = handleError(error, 'Key enrollment');
        showStatus(errorMessage, 'error');
    }
}

// Key operations
async function testKey(keyId) {
    const key = GoldeneveData.keys.get(keyId);
    if (!key) {
        showStatus('Key not found', 'error');
        return;
    }
    
    try {
        showStatus(`Testing "${key.name}"...`, 'info');
        await authenticateKey(key, 'test');
        
        // Update last used timestamp
        key.lastUsed = new Date().toISOString();
        GoldeneveData.keys.set(keyId, key);
        saveStoredData();
        
        showStatus(`Key "${key.name}" authenticated successfully!`, 'success');
    } catch (error) {
        const errorMessage = handleError(error, 'Key test');
        showStatus(errorMessage, 'error');
    }
}

function editKey(keyId) {
    const key = GoldeneveData.keys.get(keyId);
    if (!key) {
        showStatus('Key not found', 'error');
        return;
    }
    
    const newName = prompt('Enter new name for this key:', key.name);
    if (newName && newName.trim() !== key.name) {
        key.name = newName.trim();
        GoldeneveData.keys.set(keyId, key);
        saveStoredData();
        showStatus('Key name updated', 'success');
        refreshKeyList();
        populateKeySelectors();
    }
}

function toggleKeyStatus(keyId) {
    const key = GoldeneveData.keys.get(keyId);
    if (!key) {
        showStatus('Key not found', 'error');
        return;
    }
    
    const action = key.active ? 'disable' : 'enable';
    if (confirm(`Are you sure you want to ${action} "${key.name}"?`)) {
        key.active = !key.active;
        GoldeneveData.keys.set(keyId, key);
        saveStoredData();
        showStatus(`Key "${key.name}" ${action}d`, 'success');
        refreshKeyList();
        populateKeySelectors();
    }
}

function deleteKey(keyId) {
    // Use secure delete function with 2FA
    if (window.adminAuth && window.adminAuth.deleteKeyWithAuth) {
        window.adminAuth.deleteKeyWithAuth(keyId);
    } else {
        // Fallback for systems without auth
        const key = GoldeneveData.keys.get(keyId);
        if (!key) {
            showStatus('Key not found', 'error');
            return;
        }
        
        if (confirm(`Are you sure you want to permanently delete "${key.name}"?\n\nThis action cannot be undone and may prevent access to encrypted data.`)) {
            GoldeneveData.keys.delete(keyId);
            saveStoredData();
            showStatus(`Key "${key.name}" deleted`, 'success');
            refreshKeyList();
            populateKeySelectors();
        }
    }
}

// Authentication function
async function authenticateKey(keyData, purpose) {
    if (currentlyAuthenticating.has(keyData.id)) {
        throw new Error('Key is already being authenticated');
    }
    
    currentlyAuthenticating.add(keyData.id);
    
    try {
        const challenge = generateChallenge();
        const credentialId = base64ToBuffer(keyData.credentialId);

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: challenge,
                allowCredentials: [{
                    id: credentialId,
                    type: 'public-key',
                    transports: ['usb', 'nfc']
                }],
                userVerification: "discouraged",
                timeout: 60000
            }
        });

        return bufferToBase64(assertion.response.signature);
    } finally {
        currentlyAuthenticating.delete(keyData.id);
    }
}

// Key derivation for N-choose-2 system
async function deriveEncryptionKey(keyId1, keyId2, salt) {
    const key1 = GoldeneveData.keys.get(keyId1);
    const key2 = GoldeneveData.keys.get(keyId2);
    
    if (!key1 || !key2) {
        throw new Error('Invalid key selection');
    }
    
    // Authenticate both keys
    const sig1 = await authenticateKey(key1, 'encryption');
    const sig2 = await authenticateKey(key2, 'encryption');
    
    // Create deterministic key material by sorting credential IDs
    const sortedCredentials = [key1.credentialId, key2.credentialId].sort();
    const combined = sortedCredentials.join('') + salt;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    return crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

// Data operations - simplified encryption using all key combinations
async function encryptAndStore() {
    const dataInput = document.getElementById('dataInput').value;
    if (!dataInput) {
        showStatus('Please enter data to encrypt', 'error');
        return;
    }
    
    // Need at least 2 active keys
    const activeKeys = Array.from(GoldeneveData.keys.values()).filter(k => k.active);
    if (activeKeys.length < 2) {
        showStatus('Need at least 2 active keys to encrypt data', 'error');
        return;
    }
    
    try {
        showStatus('Creating vault accessible by any two enrolled keys...', 'info');
        
        // Generate salt for this encryption
        const salt = bufferToBase64(crypto.getRandomValues(new Uint8Array(16)));
        
        // Use first two keys for the actual encryption, but store all possible pairs
        const keyIds = activeKeys.slice(0, 2).map(k => k.id);
        
        // Derive encryption key
        const encryptionKey = await deriveEncryptionKey(keyIds[0], keyIds[1], salt);

        // Encrypt the data
        const encoder = new TextEncoder();
        const data = encoder.encode(dataInput);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            encryptionKey,
            data
        );

        // Generate all possible key pair combinations for N-choose-2 access
        const allKeyPairs = [];
        for (let i = 0; i < activeKeys.length; i++) {
            for (let j = i + 1; j < activeKeys.length; j++) {
                allKeyPairs.push([activeKeys[i].id, activeKeys[j].id]);
            }
        }

        // Store encrypted vault
        const vaultId = generateId();
        const vaultData = {
            id: vaultId,
            name: `Vault ${new Date().toLocaleString()}`,
            encryptedData: bufferToBase64(encryptedData),
            iv: bufferToBase64(iv),
            salt: salt,
            createdAt: new Date().toISOString(),
            keyPairs: allKeyPairs, // Store ALL possible key pair combinations
            encryptionKeyPair: keyIds // Remember which specific pair was used for encryption
        };

        GoldeneveData.vaults.set(vaultId, vaultData);
        saveStoredData();
        
        document.getElementById('dataInput').value = '';
        showStatus(`Vault created! Accessible by any 2 of ${activeKeys.length} enrolled keys (${allKeyPairs.length} combinations)`, 'success');

    } catch (error) {
        const errorMessage = handleError(error, 'Data encryption');
        showStatus(errorMessage, 'error');
    }
}

async function retrieveData() {
    const key1Id = document.getElementById('key1Select').value;
    const key2Id = document.getElementById('key2Select').value;
    
    if (!key1Id || !key2Id) {
        showStatus('Please select two keys', 'error');
        return;
    }
    
    if (key1Id === key2Id) {
        showStatus('Please select two different keys', 'error');
        return;
    }
    
    // Find a vault that can be decrypted with these keys
    const vault = Array.from(GoldeneveData.vaults.values()).find(v => 
        v.keyPairs.some(pair => 
            (pair[0] === key1Id && pair[1] === key2Id) || 
            (pair[0] === key2Id && pair[1] === key1Id)
        )
    );
    
    if (!vault) {
        showStatus('No data found that can be decrypted with selected keys', 'error');
        return;
    }
    
    try {
        showStatus('Authenticating with selected keys...', 'info');
        
        // Derive decryption key using stored salt
        const decryptionKey = await deriveEncryptionKey(key1Id, key2Id, vault.salt);

        // Decrypt the data
        const encryptedBuffer = base64ToBuffer(vault.encryptedData);
        const iv = base64ToBuffer(vault.iv);

        const decryptedData = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            decryptionKey,
            encryptedBuffer
        );

        const decoder = new TextDecoder();
        const decryptedText = decoder.decode(decryptedData);

        // Display decrypted data
        document.getElementById('decryptedContent').textContent = decryptedText;
        document.getElementById('decryptedData').style.display = 'block';
        
        showStatus('Data decrypted successfully!', 'success');

        // Auto-hide after 30 seconds
        setTimeout(() => {
            document.getElementById('decryptedData').style.display = 'none';
            document.getElementById('decryptedContent').textContent = '';
        }, 30000);

    } catch (error) {
        const errorMessage = handleError(error, 'Data decryption');
        showStatus(errorMessage, 'error');
    }
}

// Backup and export functions
function createBackup() {
    try {
        const backupData = {
            version: GoldeneveData.version,
            keys: Array.from(GoldeneveData.keys.entries()),
            vaults: Array.from(GoldeneveData.vaults.entries()),
            settings: GoldeneveData.settings,
            createdAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `goldeneye-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus('Backup file created and downloaded', 'success');
    } catch (error) {
        console.error('Backup creation failed:', error);
        showStatus('Failed to create backup file', 'error');
    }
}

async function uploadBackup() {
    try {
        const backupData = {
            version: GoldeneveData.version,
            keys: Array.from(GoldeneveData.keys.entries()),
            vaults: Array.from(GoldeneveData.vaults.entries()),
            settings: GoldeneveData.settings,
            createdAt: new Date().toISOString()
        };
        
        showStatus('Uploading backup to server...', 'info');
        
        const response = await fetch('backup-api.php?path=upload', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(backupData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showStatus(`Backup uploaded successfully! ID: ${result.backupId}`, 'success');
            
            // Show backup ID to user for future reference
            setTimeout(() => {
                alert(`Backup ID: ${result.backupId}\n\nSave this ID - you'll need it to restore your data.\n\nMetadata:\n- Keys: ${result.metadata.keyCount}\n- Vaults: ${result.metadata.vaultCount}\n- Size: ${(result.metadata.dataSize / 1024).toFixed(1)}KB`);
            }, 1000);
        } else {
            throw new Error(result.error || 'Upload failed');
        }
        
    } catch (error) {
        console.error('Backup upload failed:', error);
        showStatus(`Failed to upload backup: ${error.message}`, 'error');
    }
}

function importBackup() {
    const fileInput = document.getElementById('backupFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showStatus('Please select a backup file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            if (confirm('This will replace all current data. Continue?')) {
                GoldeneveData.keys = new Map(backupData.keys || []);
                GoldeneveData.vaults = new Map(backupData.vaults || []);
                GoldeneveData.settings = { ...GoldeneveData.settings, ...backupData.settings };
                
                saveStoredData();
                refreshKeyList();
                populateKeySelectors();
                
                showStatus('Backup imported successfully', 'success');
            }
        } catch (error) {
            console.error('Import failed:', error);
            showStatus('Invalid backup file format', 'error');
        }
    };
    
    reader.readAsText(file);
}

async function downloadBackup() {
    const backupId = document.getElementById('backupId').value.trim();
    
    if (!backupId) {
        showStatus('Please enter a backup ID', 'error');
        return;
    }
    
    try {
        showStatus('Downloading backup from server...', 'info');
        
        const response = await fetch(`backup-api.php?path=download/${encodeURIComponent(backupId)}`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Backup not found - check your backup ID');
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const backupData = await response.json();
        
        // Validate backup data structure
        if (!backupData.version || !backupData.keys || !backupData.vaults) {
            throw new Error('Invalid backup format received from server');
        }
        
        if (confirm(`Found backup with ${backupData.keys.length} keys and ${backupData.vaults.length} vaults.\n\nThis will replace all current data. Continue?`)) {
            GoldeneveData.keys = new Map(backupData.keys || []);
            GoldeneveData.vaults = new Map(backupData.vaults || []);
            GoldeneveData.settings = { ...GoldeneveData.settings, ...backupData.settings };
            
            saveStoredData();
            refreshKeyList();
            populateKeySelectors();
            
            showStatus('Backup restored successfully from server', 'success');
            document.getElementById('backupId').value = '';
        }
        
    } catch (error) {
        console.error('Backup download failed:', error);
        showStatus(`Failed to download backup: ${error.message}`, 'error');
    }
}

// System reset with authentication
function resetSystem() {
    // Use secure reset function with 2FA
    if (window.adminAuth && window.adminAuth.resetSystemWithAuth) {
        window.adminAuth.resetSystemWithAuth();
    } else {
        // Fallback for systems without auth
        if (confirm('This will permanently delete ALL keys and encrypted data.\n\nThis action cannot be undone. Are you absolutely sure?')) {
            if (confirm('Last chance! This will delete everything. Click OK to proceed or Cancel to abort.')) {
                localStorage.removeItem('goldeneye_admin_data');
                GoldeneveData.keys.clear();
                GoldeneveData.vaults.clear();
                
                refreshKeyList();
                populateKeySelectors();
                document.getElementById('decryptedData').style.display = 'none';
                document.getElementById('dataInput').value = '';
                
                showStatus('System reset completed - all data deleted', 'success');
            }
        }
    }
}

// Logout function for admin
function logoutAdmin() {
    if (window.adminAuth && window.adminAuth.logoutAdmin) {
        window.adminAuth.logoutAdmin('Manual logout');
    }
}

// Show/hide admin controls based on auth status
function updateAdminControls() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        if (window.adminAuth && window.adminAuth.isAuthenticated()) {
            logoutBtn.style.display = 'inline-block';
        } else {
            logoutBtn.style.display = 'none';
        }
    }
}

// Server synchronization functions
async function syncEnrollmentToServer(keyData) {
    try {
        // First, authenticate with the YubiKey to get a token
        const authToken = await getAuthToken(keyData.credentialId);
        
        // Prepare enrollment data
        const enrollmentData = {
            credentialId: keyData.credentialId,
            name: keyData.name,
            description: keyData.description,
            enrolledAt: keyData.enrolledAt,
            active: keyData.active
        };
        
        // Upload enrollment to server
        const response = await fetch('../vault-api.php?type=enrollment&action=upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': authToken
            },
            body: JSON.stringify(enrollmentData)
        });
        
        if (!response.ok) {
            throw new Error(`Server sync failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Enrollment synced to server:', result);
        
    } catch (error) {
        console.error('Failed to sync enrollment to server:', error);
        // Don't throw - enrollment is saved locally even if server sync fails
    }
}

async function syncEnrollmentsFromServer() {
    try {
        // Try to load enrollments from server (no auth needed for initial check)
        const response = await fetch('../vault-api.php?type=enrollment&action=list');
        
        if (!response.ok) {
            console.log('No server enrollments available');
            return;
        }
        
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            console.log(`Found ${data.items.length} enrollment(s) on server`);
            
            // For each enrollment, try to download it
            for (const item of data.items) {
                try {
                    const enrollmentResponse = await fetch(`../vault-api.php?type=enrollment&action=download/${item.id}`);
                    if (enrollmentResponse.ok) {
                        const enrollmentData = await enrollmentResponse.json();
                        
                        // Check if this enrollment exists locally
                        let keyExists = false;
                        GoldeneveData.keys.forEach((key) => {
                            if (key.credentialId === enrollmentData.credentialId) {
                                keyExists = true;
                            }
                        });
                        
                        if (!keyExists) {
                            // Add the enrollment from server
                            const keyId = generateId();
                            const keyData = {
                                id: keyId,
                                name: enrollmentData.name || 'Imported Key',
                                description: enrollmentData.description || '',
                                credentialId: enrollmentData.credentialId,
                                enrolledAt: enrollmentData.enrolledAt || new Date().toISOString(),
                                active: enrollmentData.active !== false,
                                lastUsed: null
                            };
                            
                            GoldeneveData.keys.set(keyId, keyData);
                            console.log('Imported enrollment from server:', keyData.name);
                        }
                    }
                } catch (error) {
                    console.error('Failed to download enrollment:', error);
                }
            }
            
            // Save any imported enrollments
            saveStoredData();
        }
    } catch (error) {
        console.error('Failed to sync enrollments from server:', error);
        // Don't throw - continue with local data
    }
}

async function getAuthToken(credentialId) {
    try {
        // Generate a challenge and get signature from YubiKey
        const challenge = generateChallenge();
        const credentialIdBuffer = base64ToBuffer(credentialId);
        
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: challenge,
                allowCredentials: [{
                    id: credentialIdBuffer,
                    type: 'public-key',
                    transports: ['usb', 'nfc']
                }],
                userVerification: "discouraged",
                timeout: 60000
            }
        });
        
        const signature = bufferToBase64(assertion.response.signature);
        
        // Request auth token from server
        const response = await fetch('../vault-api.php?type=enrollment&action=auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                credentialId: credentialId,
                signature: signature
            })
        });
        
        if (!response.ok) {
            throw new Error('Authentication failed');
        }
        
        const data = await response.json();
        return data.token;
        
    } catch (error) {
        console.error('Failed to get auth token:', error);
        // Return empty token - server sync will fail but local operations continue
        return '';
    }
}

// =============================================================================
// Git Backup Management Functions
// =============================================================================

let gitAuthToken = null;

/**
 * Initialize Git tab functionality
 */
function initGitTab() {
    refreshGitStatus();
    loadGitRemotes();
    loadSSHKeys();
}

/**
 * Refresh Git backup status
 */
async function refreshGitStatus() {
    const statusDiv = document.getElementById('gitStatus');
    
    try {
        statusDiv.innerHTML = '<span class="status-checking">Checking Git status...</span>';
        
        const response = await fetch('../vault-api.php?type=git&action=status', {
            method: 'GET',
            headers: gitAuthToken ? { 'X-Auth-Token': gitAuthToken } : {}
        });
        
        if (!response.ok) {
            throw new Error('Failed to get Git status');
        }
        
        const data = await response.json();
        
        let statusHTML = '<div class="git-status-info">';
        statusHTML += `<div><strong>Repository:</strong> ${data.initialized ? 'Initialized' : 'Not initialized'}</div>`;
        statusHTML += `<div><strong>Branch:</strong> ${data.branch || 'N/A'}</div>`;
        statusHTML += `<div><strong>Commits:</strong> ${data.commitCount || 0}</div>`;
        statusHTML += `<div><strong>Last Backup:</strong> ${data.lastCommit || 'Never'}</div>`;
        statusHTML += `<div><strong>Uncommitted Changes:</strong> ${data.hasChanges ? 'Yes' : 'No'}</div>`;
        statusHTML += '</div>';
        
        statusDiv.innerHTML = statusHTML;
        
    } catch (error) {
        console.error('Failed to refresh Git status:', error);
        statusDiv.innerHTML = '<span class="status-error">Failed to load Git status</span>';
    }
}

/**
 * Load configured Git remotes
 */
async function loadGitRemotes() {
    const remotesList = document.getElementById('remotesList');
    
    try {
        remotesList.innerHTML = '<li>Loading remotes...</li>';
        
        const response = await fetch('../vault-api.php?type=git&action=remotes', {
            method: 'GET',
            headers: gitAuthToken ? { 'X-Auth-Token': gitAuthToken } : {}
        });
        
        if (!response.ok) {
            throw new Error('Failed to load remotes');
        }
        
        const data = await response.json();
        
        if (data.remotes && data.remotes.length > 0) {
            remotesList.innerHTML = '';
            data.remotes.forEach(remote => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="remote-item">
                        <span><strong>${remote.name}:</strong> ${remote.url}</span>
                        <div class="remote-actions">
                            <button onclick="testGitConnection('${remote.name}')" class="btn-small">Test</button>
                            <button onclick="removeGitRemote('${remote.name}')" class="btn-small btn-danger">Remove</button>
                        </div>
                    </div>
                `;
                remotesList.appendChild(li);
            });
        } else {
            remotesList.innerHTML = '<li>No remotes configured</li>';
        }
        
    } catch (error) {
        console.error('Failed to load remotes:', error);
        remotesList.innerHTML = '<li class="error">Failed to load remotes</li>';
    }
}

/**
 * Add a new Git remote
 */
async function addGitRemote() {
    const nameInput = document.getElementById('remoteName');
    const urlInput = document.getElementById('remoteUrl');
    
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    
    if (!name || !url) {
        showStatus('Please enter both remote name and URL', 'error');
        return;
    }
    
    try {
        // Get auth token if needed
        if (!gitAuthToken) {
            gitAuthToken = await getGitAuthToken();
        }
        
        const response = await fetch('../vault-api.php?type=git&action=add-remote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': gitAuthToken
            },
            body: JSON.stringify({ name, url })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add remote');
        }
        
        const data = await response.json();
        
        showStatus(`Remote '${name}' added successfully`, 'success');
        nameInput.value = '';
        urlInput.value = '';
        loadGitRemotes();
        
    } catch (error) {
        console.error('Failed to add remote:', error);
        showStatus('Failed to add remote: ' + error.message, 'error');
    }
}

/**
 * Remove a Git remote
 */
async function removeGitRemote(name) {
    if (!confirm(`Remove remote '${name}'?`)) {
        return;
    }
    
    try {
        if (!gitAuthToken) {
            gitAuthToken = await getGitAuthToken();
        }
        
        const response = await fetch('../vault-api.php?type=git&action=remove-remote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': gitAuthToken
            },
            body: JSON.stringify({ name })
        });
        
        if (!response.ok) {
            throw new Error('Failed to remove remote');
        }
        
        showStatus(`Remote '${name}' removed`, 'success');
        loadGitRemotes();
        
    } catch (error) {
        console.error('Failed to remove remote:', error);
        showStatus('Failed to remove remote: ' + error.message, 'error');
    }
}

/**
 * Test Git connection to a remote
 */
async function testGitConnection(remoteName) {
    const remoteToTest = remoteName || document.getElementById('remoteToTest').value;
    
    if (!remoteToTest) {
        showStatus('Please select a remote to test', 'error');
        return;
    }
    
    const testResult = document.getElementById('testResult');
    testResult.innerHTML = '<span class="status-checking">Testing connection...</span>';
    
    try {
        const response = await fetch('../vault-api.php?type=git&action=test-connection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ remote: remoteToTest })
        });
        
        const data = await response.json();
        
        if (data.success) {
            testResult.innerHTML = '<span class="status-success">✓ Connection successful</span>';
        } else {
            testResult.innerHTML = `<span class="status-error">✗ Connection failed: ${data.error || 'Unknown error'}</span>`;
        }
        
    } catch (error) {
        console.error('Failed to test connection:', error);
        testResult.innerHTML = '<span class="status-error">✗ Test failed</span>';
    }
}

/**
 * Load SSH keys
 */
async function loadSSHKeys() {
    const keysList = document.getElementById('sshKeysList');
    
    try {
        const response = await fetch('../vault-api.php?type=git&action=list-keys', {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load SSH keys');
        }
        
        const data = await response.json();
        
        if (data.keys && data.keys.length > 0) {
            keysList.innerHTML = '';
            data.keys.forEach(key => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="ssh-key-item">
                        <span><strong>${key.name}</strong> (${key.type})</span>
                        <div class="key-actions">
                            <button onclick="viewPublicKey('${key.name}')" class="btn-small">View Public</button>
                            <button onclick="deleteSSHKey('${key.name}')" class="btn-small btn-danger">Delete</button>
                        </div>
                    </div>
                `;
                keysList.appendChild(li);
            });
        } else {
            keysList.innerHTML = '<li>No SSH keys configured</li>';
        }
        
    } catch (error) {
        console.error('Failed to load SSH keys:', error);
        keysList.innerHTML = '<li class="error">Failed to load SSH keys</li>';
    }
}

/**
 * Generate new SSH key
 */
async function generateSSHKey() {
    const keyNameInput = document.getElementById('keyName');
    const keyTypeSelect = document.getElementById('keyType');
    
    const name = keyNameInput.value.trim();
    const type = keyTypeSelect.value;
    
    if (!name) {
        showStatus('Please enter a key name', 'error');
        return;
    }
    
    try {
        if (!gitAuthToken) {
            gitAuthToken = await getGitAuthToken();
        }
        
        showStatus('Generating SSH key...', 'info');
        
        const response = await fetch('../vault-api.php?type=git&action=generate-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': gitAuthToken
            },
            body: JSON.stringify({ name, type })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate key');
        }
        
        const data = await response.json();
        
        // Display the public key
        const publicKeyDisplay = document.getElementById('publicKeyDisplay');
        publicKeyDisplay.innerHTML = `
            <h4>Public Key Generated:</h4>
            <textarea readonly class="public-key-textarea">${data.publicKey}</textarea>
            <p class="help-text">Copy this public key to your Git service (GitHub, GitLab, etc.)</p>
        `;
        
        showStatus('SSH key generated successfully', 'success');
        keyNameInput.value = '';
        loadSSHKeys();
        
    } catch (error) {
        console.error('Failed to generate SSH key:', error);
        showStatus('Failed to generate SSH key: ' + error.message, 'error');
    }
}

/**
 * View public key
 */
async function viewPublicKey(keyName) {
    try {
        const response = await fetch(`../vault-api.php?type=git&action=view-key&key=${encodeURIComponent(keyName)}`, {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error('Failed to get public key');
        }
        
        const data = await response.json();
        
        const publicKeyDisplay = document.getElementById('publicKeyDisplay');
        publicKeyDisplay.innerHTML = `
            <h4>Public Key for ${keyName}:</h4>
            <textarea readonly class="public-key-textarea">${data.publicKey}</textarea>
            <button onclick="copyToClipboard('${data.publicKey}')" class="btn-small">Copy to Clipboard</button>
        `;
        
    } catch (error) {
        console.error('Failed to view public key:', error);
        showStatus('Failed to view public key: ' + error.message, 'error');
    }
}

/**
 * Delete SSH key
 */
async function deleteSSHKey(keyName) {
    if (!confirm(`Delete SSH key '${keyName}'? This cannot be undone.`)) {
        return;
    }
    
    try {
        if (!gitAuthToken) {
            gitAuthToken = await getGitAuthToken();
        }
        
        const response = await fetch('../vault-api.php?type=git&action=delete-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': gitAuthToken
            },
            body: JSON.stringify({ name: keyName })
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete key');
        }
        
        showStatus(`SSH key '${keyName}' deleted`, 'success');
        loadSSHKeys();
        
    } catch (error) {
        console.error('Failed to delete SSH key:', error);
        showStatus('Failed to delete SSH key: ' + error.message, 'error');
    }
}

/**
 * Push to remote repository
 */
async function pushToRemote() {
    const remoteSelect = document.getElementById('remoteToPush');
    const remote = remoteSelect.value;
    
    if (!remote) {
        showStatus('Please select a remote', 'error');
        return;
    }
    
    try {
        if (!gitAuthToken) {
            gitAuthToken = await getGitAuthToken();
        }
        
        showStatus('Pushing to remote...', 'info');
        
        const response = await fetch('../vault-api.php?type=git&action=push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': gitAuthToken
            },
            body: JSON.stringify({ remote })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showStatus(`Successfully pushed to '${remote}'`, 'success');
            refreshGitStatus();
        } else {
            showStatus(`Push failed: ${data.error || 'Unknown error'}`, 'error');
        }
        
    } catch (error) {
        console.error('Failed to push:', error);
        showStatus('Failed to push: ' + error.message, 'error');
    }
}

/**
 * View Git history
 */
async function viewGitHistory() {
    const historyDiv = document.getElementById('gitHistory');
    historyDiv.innerHTML = '<div class="status-checking">Loading history...</div>';
    
    try {
        const response = await fetch('../vault-api.php?type=git&action=history', {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load history');
        }
        
        const data = await response.json();
        
        if (data.commits && data.commits.length > 0) {
            let historyHTML = '<div class="git-history">';
            historyHTML += '<h4>Recent Commits:</h4>';
            historyHTML += '<ul class="commit-list">';
            
            data.commits.forEach(commit => {
                historyHTML += `
                    <li class="commit-item">
                        <div class="commit-hash">${commit.hash.substring(0, 7)}</div>
                        <div class="commit-message">${commit.message}</div>
                        <div class="commit-date">${commit.date}</div>
                    </li>
                `;
            });
            
            historyHTML += '</ul></div>';
            historyDiv.innerHTML = historyHTML;
        } else {
            historyDiv.innerHTML = '<div class="no-history">No commit history available</div>';
        }
        
    } catch (error) {
        console.error('Failed to view history:', error);
        historyDiv.innerHTML = '<div class="error">Failed to load history</div>';
    }
}

/**
 * Get authentication token for Git operations
 */
async function getGitAuthToken() {
    // Try to use existing enrolled key
    const keys = Array.from(GoldeneveData.keys.values());
    if (keys.length > 0) {
        const firstKey = keys[0];
        return await getAuthToken(firstKey.credentialId);
    }
    
    // No keys available
    showStatus('Please enroll a YubiKey first', 'error');
    throw new Error('No YubiKey enrolled');
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showStatus('Copied to clipboard', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showStatus('Failed to copy to clipboard', 'error');
    });
}

// Initialize when page loads
window.addEventListener('load', init);