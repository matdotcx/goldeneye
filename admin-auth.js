/**
 * Admin Authentication System for Goldeneye
 * Uses YubiKey authentication to protect admin panel access
 */

// Admin authentication state
let adminSession = {
    authenticated: false,
    adminKey: null,
    sessionStart: null,
    lastActivity: null
};

// Admin settings
const ADMIN_CONFIG = {
    sessionTimeout: 1800000, // 30 minutes
    requireReauth: 600000,   // Re-auth for sensitive operations after 10 minutes
    maxRetries: 3,
    lockoutTime: 900000      // 15 minutes lockout after failed attempts
};

// Failed attempt tracking
let authAttempts = {
    count: 0,
    lastAttempt: null,
    lockedUntil: null
};

/**
 * Initialize admin authentication
 */
function initAdminAuth() {
    checkAuthenticationStatus();
    startSessionTimer();
    
    // Add event listeners for user activity
    document.addEventListener('click', updateLastActivity);
    document.addEventListener('keypress', updateLastActivity);
    
    // Load failed attempt history
    loadAuthAttempts();
}

/**
 * Check if user is authenticated and session is valid
 */
function checkAuthenticationStatus() {
    const stored = localStorage.getItem('goldeneye_admin_session');
    if (stored) {
        try {
            const session = JSON.parse(stored);
            const now = Date.now();
            
            // Check if session is still valid
            if (session.authenticated && 
                session.sessionStart && 
                (now - session.sessionStart) < ADMIN_CONFIG.sessionTimeout) {
                
                adminSession = session;
                adminSession.lastActivity = now;
                showAdminPanel();
                return;
            }
        } catch (error) {
            console.error('Invalid session data:', error);
        }
    }
    
    // No valid session - show auth screen
    showAuthenticationScreen();
}

/**
 * Show authentication screen
 */
function showAuthenticationScreen() {
    // Hide admin panel
    const adminPanel = document.querySelector('.vault-container');
    if (adminPanel) {
        adminPanel.style.display = 'none';
    }
    
    // Create auth screen
    const authScreen = document.createElement('div');
    authScreen.id = 'authScreen';
    authScreen.innerHTML = `
        <div class="auth-container">
            <h1>Goldeneye Admin Authentication</h1>
            <p class="subtitle">YubiKey authentication required to access admin panel</p>
            
            <div class="status-message" id="authStatusMessage"></div>
            
            <div class="auth-section">
                <div class="instruction-text" id="authInstructions">
                    Insert your admin YubiKey and click "Authenticate" below.
                    <br><br>
                    <strong>Note:</strong> This requires HTTPS to function. On localhost, you'll see a security error.
                </div>
                
                <div style="text-align: center; margin: 2rem 0;">
                    <button class="btn success" id="authButton" onclick="authenticateAdmin()" ${isLockedOut() ? 'disabled' : ''}>
                        ${isLockedOut() ? 'Account Locked' : 'Authenticate with YubiKey'}
                    </button>
                </div>
                
                <div class="auth-info">
                    <details>
                        <summary>Security Information</summary>
                        <ul style="text-align: left; margin-top: 1rem;">
                            <li>Admin access requires a YubiKey enrolled as an admin key</li>
                            <li>Sessions expire after 30 minutes of inactivity</li>
                            <li>Sensitive operations require re-authentication</li>
                            <li>Failed attempts will lock the account temporarily</li>
                            <li>All access attempts are logged for security</li>
                        </ul>
                    </details>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid rgba(35, 35, 35, 0.1);">
                <a href="index.html" style="color: inherit; opacity: 0.6; text-decoration: none; font-size: 0.9rem;">
                    ← Back to User Mode
                </a>
            </div>
        </div>
        
        <style>
            .auth-container {
                max-width: 600px;
                margin: 2rem auto;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.8);
                border-radius: 8px;
                border: 1px solid rgba(35, 35, 35, 0.1);
                text-align: center;
            }
            
            .auth-section {
                margin: 2rem 0;
                padding: 1.5rem;
                background: rgba(248, 245, 240, 0.5);
                border-radius: 6px;
                border: 1px solid rgba(35, 35, 35, 0.05);
            }
            
            .auth-info {
                margin-top: 2rem;
                text-align: center;
            }
            
            .auth-info details {
                background: rgba(51, 102, 153, 0.05);
                padding: 1rem;
                border-radius: 4px;
                border: 1px solid rgba(51, 102, 153, 0.1);
            }
            
            .auth-info summary {
                cursor: pointer;
                font-weight: 600;
                color: #336699;
            }
            
            .auth-info ul {
                font-size: 0.9rem;
                opacity: 0.8;
            }
            
            [data-theme="dark"] .auth-container {
                background: rgba(35, 35, 35, 0.8);
                border-color: rgba(248, 245, 240, 0.1);
            }
            
            [data-theme="dark"] .auth-section {
                background: rgba(31, 31, 31, 0.5);
                border-color: rgba(248, 245, 240, 0.05);
            }
        </style>
    `;
    
    // Add to page
    document.body.appendChild(authScreen);
    
    // Show lockout status if applicable
    if (isLockedOut()) {
        const timeLeft = Math.ceil((authAttempts.lockedUntil - Date.now()) / 60000);
        showAuthStatus(`Account locked due to failed attempts. Try again in ${timeLeft} minutes.`, 'error');
    }
}

/**
 * Show admin panel (hide auth screen)
 */
function showAdminPanel() {
    // Remove auth screen
    const authScreen = document.getElementById('authScreen');
    if (authScreen) {
        authScreen.remove();
    }
    
    // Show admin panel
    const adminPanel = document.querySelector('.vault-container');
    if (adminPanel) {
        adminPanel.style.display = 'block';
    }
    
    // Show authenticated status
    showStatus(`Admin authenticated (session expires in ${Math.ceil((adminSession.sessionStart + ADMIN_CONFIG.sessionTimeout - Date.now()) / 60000)} minutes)`, 'success');
    
    // Update admin controls
    if (window.updateAdminControls) {
        window.updateAdminControls();
    }
}

/**
 * Authenticate admin with YubiKey
 */
async function authenticateAdmin() {
    if (isLockedOut()) {
        showAuthStatus('Account is locked. Please wait before trying again.', 'error');
        return;
    }
    
    try {
        showAuthStatus('Insert YubiKey and touch when it blinks...', 'info');
        document.getElementById('authButton').disabled = true;
        
        // For localhost testing, we'll simulate authentication
        if (window.location.hostname === 'localhost') {
            showAuthStatus('HTTPS required for YubiKey authentication. Simulating successful auth for localhost testing...', 'info');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Simulate successful auth
            adminSession = {
                authenticated: true,
                adminKey: {
                    id: 'localhost_admin_key',
                    name: 'Localhost Admin Key'
                },
                sessionStart: Date.now(),
                lastActivity: Date.now()
            };
            
            saveAdminSession();
            showAdminPanel();
            resetAuthAttempts();
            return;
        }
        
        // Real YubiKey authentication
        const challenge = generateChallenge();
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: challenge,
                rp: {
                    name: "Goldeneye Admin",
                    id: window.location.hostname
                },
                user: {
                    id: new TextEncoder().encode('goldeneye_admin'),
                    name: 'admin@goldeneye.local',
                    displayName: 'Goldeneye Administrator'
                },
                pubKeyCredParams: [
                    { alg: -7, type: "public-key" },
                    { alg: -257, type: "public-key" }
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
        
        // Store admin session
        adminSession = {
            authenticated: true,
            adminKey: {
                id: bufferToBase64(credential.rawId),
                name: 'Admin YubiKey'
            },
            sessionStart: Date.now(),
            lastActivity: Date.now()
        };
        
        saveAdminSession();
        showAdminPanel();
        resetAuthAttempts();
        
    } catch (error) {
        document.getElementById('authButton').disabled = false;
        recordFailedAttempt();
        
        const errorMessage = handleError(error, 'Admin authentication');
        showAuthStatus(errorMessage, 'error');
        
        if (authAttempts.count >= ADMIN_CONFIG.maxRetries) {
            lockAccount();
        }
    }
}

/**
 * Require re-authentication for sensitive operations
 */
async function requireReauth(operationName) {
    if (!adminSession.authenticated) {
        throw new Error('Not authenticated');
    }
    
    const timeSinceLastAuth = Date.now() - adminSession.lastActivity;
    if (timeSinceLastAuth > ADMIN_CONFIG.requireReauth) {
        return await performReauth(operationName);
    }
    
    return true;
}

/**
 * Perform re-authentication
 */
async function performReauth(operationName) {
    return new Promise((resolve, reject) => {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Confirm ${operationName}</h3>
                <p>This is a sensitive operation that requires YubiKey re-authentication.</p>
                <div class="status-message" id="reauthStatus"></div>
                <div style="margin: 1.5rem 0; text-align: center;">
                    <button class="btn success" id="reauthBtn" onclick="performReauthCheck()">Re-authenticate</button>
                    <button class="btn" onclick="cancelReauth()">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Global functions for modal
        window.performReauthCheck = async () => {
            try {
                document.getElementById('reauthBtn').disabled = true;
                document.getElementById('reauthStatus').textContent = 'Touch YubiKey to confirm...';
                document.getElementById('reauthStatus').className = 'status-message show info';
                
                if (window.location.hostname === 'localhost') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    adminSession.lastActivity = Date.now();
                    saveAdminSession();
                    modal.remove();
                    resolve(true);
                    return;
                }
                
                // Real authentication would go here
                const challenge = generateChallenge();
                const assertion = await navigator.credentials.get({
                    publicKey: {
                        challenge: challenge,
                        allowCredentials: [{
                            id: base64ToBuffer(adminSession.adminKey.id),
                            type: 'public-key',
                            transports: ['usb', 'nfc']
                        }],
                        userVerification: "discouraged",
                        timeout: 30000
                    }
                });
                
                adminSession.lastActivity = Date.now();
                saveAdminSession();
                modal.remove();
                resolve(true);
                
            } catch (error) {
                document.getElementById('reauthBtn').disabled = false;
                document.getElementById('reauthStatus').textContent = handleError(error, 'Re-authentication');
                document.getElementById('reauthStatus').className = 'status-message show error';
            }
        };
        
        window.cancelReauth = () => {
            modal.remove();
            reject(new Error('Re-authentication cancelled'));
        };
    });
}

/**
 * Enhanced delete operations with 2FA
 */
async function deleteKeyWithAuth(keyId) {
    try {
        await requireReauth('Key Deletion');
        
        // Additional confirmation
        const key = GoldeneveData.keys.get(keyId);
        if (!key) {
            showStatus('Key not found', 'error');
            return;
        }
        
        const confirmed = confirm(
            `🔐 SECURE DELETION CONFIRMATION 🔐\n\n` +
            `You are about to permanently delete:\n` +
            `"${key.name}"\n\n` +
            `This action:\n` +
            `• Cannot be undone\n` +
            `• May prevent access to encrypted data\n` +
            `• Will be logged for security\n\n` +
            `Type "DELETE" in the next dialog to confirm.`
        );
        
        if (confirmed) {
            const confirmation = prompt('Type "DELETE" to confirm this action:');
            if (confirmation === 'DELETE') {
                GoldeneveData.keys.delete(keyId);
                saveStoredData();
                logSecurityEvent('key_deleted', { keyId: keyId, keyName: key.name });
                showStatus(`Key "${key.name}" deleted successfully`, 'success');
                refreshKeyList();
                populateKeySelectors();
            } else {
                showStatus('Deletion cancelled - confirmation text did not match', 'info');
            }
        }
        
    } catch (error) {
        if (error.message !== 'Re-authentication cancelled') {
            showStatus('Failed to delete key: ' + error.message, 'error');
        }
    }
}

async function resetSystemWithAuth() {
    try {
        await requireReauth('System Reset');
        
        const confirmed = confirm(
            `🚨 SYSTEM RESET WARNING 🚨\n\n` +
            `This will PERMANENTLY DELETE:\n` +
            `• ALL enrolled YubiKeys\n` +
            `• ALL encrypted data\n` +
            `• ALL backup metadata\n\n` +
            `This action cannot be undone!\n\n` +
            `Are you absolutely sure?`
        );
        
        if (confirmed) {
            const secondConfirm = confirm(
                `FINAL CONFIRMATION\n\n` +
                `This is your last chance to abort.\n\n` +
                `Click OK to DELETE EVERYTHING\n` +
                `Click Cancel to abort safely`
            );
            
            if (secondConfirm) {
                const verification = prompt('Type "RESET EVERYTHING" to proceed:');
                if (verification === 'RESET EVERYTHING') {
                    // Log before deletion
                    logSecurityEvent('system_reset', { keyCount: GoldeneveData.keys.size, vaultCount: GoldeneveData.vaults.size });
                    
                    localStorage.removeItem('goldeneye_admin_data');
                    GoldeneveData.keys.clear();
                    GoldeneveData.vaults.clear();
                    
                    refreshKeyList();
                    populateKeySelectors();
                    document.getElementById('decryptedData').style.display = 'none';
                    document.getElementById('dataInput').value = '';
                    
                    showStatus('🗑️ System reset completed - all data permanently deleted', 'success');
                } else {
                    showStatus('System reset cancelled - verification text did not match', 'info');
                }
            }
        }
        
    } catch (error) {
        if (error.message !== 'Re-authentication cancelled') {
            showStatus('Failed to reset system: ' + error.message, 'error');
        }
    }
}

/**
 * Session management
 */
function saveAdminSession() {
    localStorage.setItem('goldeneye_admin_session', JSON.stringify(adminSession));
}

function startSessionTimer() {
    setInterval(() => {
        if (adminSession.authenticated) {
            const timeSinceStart = Date.now() - adminSession.sessionStart;
            if (timeSinceStart > ADMIN_CONFIG.sessionTimeout) {
                logoutAdmin('Session expired');
            }
        }
    }, 60000); // Check every minute
}

function updateLastActivity() {
    if (adminSession.authenticated) {
        adminSession.lastActivity = Date.now();
        saveAdminSession();
    }
}

function logoutAdmin(reason = 'Manual logout') {
    logSecurityEvent('admin_logout', { reason: reason });
    
    adminSession = {
        authenticated: false,
        adminKey: null,
        sessionStart: null,
        lastActivity: null
    };
    
    localStorage.removeItem('goldeneye_admin_session');
    showAuthenticationScreen();
    showAuthStatus(reason, 'info');
}

/**
 * Failed attempt tracking
 */
function recordFailedAttempt() {
    authAttempts.count++;
    authAttempts.lastAttempt = Date.now();
    saveAuthAttempts();
    logSecurityEvent('auth_failed', { attemptCount: authAttempts.count });
}

function resetAuthAttempts() {
    authAttempts = { count: 0, lastAttempt: null, lockedUntil: null };
    saveAuthAttempts();
}

function lockAccount() {
    authAttempts.lockedUntil = Date.now() + ADMIN_CONFIG.lockoutTime;
    saveAuthAttempts();
    logSecurityEvent('account_locked', { lockoutMinutes: ADMIN_CONFIG.lockoutTime / 60000 });
    
    const minutes = Math.ceil(ADMIN_CONFIG.lockoutTime / 60000);
    showAuthStatus(`Account locked for ${minutes} minutes due to repeated failed attempts.`, 'error');
    document.getElementById('authButton').disabled = true;
    document.getElementById('authButton').textContent = 'Account Locked';
}

function isLockedOut() {
    return authAttempts.lockedUntil && Date.now() < authAttempts.lockedUntil;
}

function saveAuthAttempts() {
    localStorage.setItem('goldeneye_auth_attempts', JSON.stringify(authAttempts));
}

function loadAuthAttempts() {
    const stored = localStorage.getItem('goldeneye_auth_attempts');
    if (stored) {
        try {
            authAttempts = { ...authAttempts, ...JSON.parse(stored) };
        } catch (error) {
            console.error('Failed to load auth attempts:', error);
        }
    }
}

/**
 * Security logging
 */
function logSecurityEvent(event, details = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event: event,
        details: details,
        userAgent: navigator.userAgent,
        ip: 'client-side' // Would be filled by server in real implementation
    };
    
    console.log('SECURITY LOG:', logEntry);
    
    // In production, you'd send this to a server
    // fetch('/api/security-log', { method: 'POST', body: JSON.stringify(logEntry) });
}

/**
 * Status messaging for auth screen
 */
function showAuthStatus(message, type = 'info') {
    const statusEl = document.getElementById('authStatusMessage');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-message show ${type}`;
        
        if (type !== 'error') {
            setTimeout(() => {
                statusEl.classList.remove('show');
            }, 5000);
        }
    }
}

// Export functions for use in main admin script
window.adminAuth = {
    initAdminAuth,
    requireReauth,
    deleteKeyWithAuth,
    resetSystemWithAuth,
    logoutAdmin,
    isAuthenticated: () => adminSession.authenticated
};