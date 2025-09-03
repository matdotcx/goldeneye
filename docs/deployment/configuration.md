# Goldeneye Configuration Guide

## Overview

This guide covers system configuration, settings management, and feature enablement for Goldeneye after initial installation.

## Server-Side Settings Persistence

As of the recent updates, Goldeneye includes server-side settings persistence to resolve localStorage limitations where settings wouldn't persist across different browsers or devices.

### How It Works

- **Server Storage**: Settings stored in `/goldeneye/data/settings.json`
- **Automatic Sync**: Admin panel auto-saves settings every 30 seconds  
- **Cross-Browser Access**: Settings available from any browser/device
- **Offline Fallback**: localStorage cache when server unavailable
- **Backup Integration**: Settings included in system backups

### Settings Structure
```json
{
  "systemName": "Custom Vault Name",
  "autoExpire": 1800000,
  "requireTwoKeys": true,
  "allowInactive": false
}
```

### API Endpoints

**Save Settings**
```http
POST /vault-api.php?type=settings&action=save
Content-Type: application/json

{
  "systemName": "My Secure Vault",
  "autoExpire": 1800000
}
```

**Load Settings**
```http
GET /vault-api.php?type=settings&action=load
```

## YubiKey Enrollment Configuration

### Enrollment Persistence System

The system provides automatic synchronization of YubiKey enrollments across browsers and devices.

#### Key Features
- **Never Expire**: Enrollment data persists indefinitely (ENROLLMENT_RETENTION_DAYS = -1)
- **Git Backup**: Automatic version control for all enrollments
- **Cross-Device Sync**: Enrollments work across different browsers
- **Authentication Required**: YubiKey verification for enrollment operations

#### Configuration Files
- **Enrollments**: `/goldeneye/data/enrollments/`
- **Git Repository**: `/goldeneye/data/git-backup/`
- **Auth Tokens**: `/goldeneye/data/.auth_tokens/` (5-minute lifetime)

### Retention Policies
```php
// Default retention settings
define('ENROLLMENT_RETENTION_DAYS', -1);    // Never expire
define('VAULT_RETENTION_DAYS', 365);        // 1 year
define('BACKUP_RETENTION_DAYS', 365);       // 1 year
define('AUTH_TOKEN_LIFETIME', 300);         // 5 minutes
```

## Git Backup Configuration

### Admin Panel Git Management

The admin panel includes a comprehensive Git Backup interface for managing backup configurations.

#### Features Available
- **Repository Management**: Add/remove remote repositories
- **SSH Key Management**: Generate and manage deployment keys
- **Connection Testing**: Verify remote repository connectivity
- **Manual Operations**: Push backups, view commit history
- **Status Monitoring**: Git repository status and statistics

#### Quick Setup via Admin Panel

1. **Access Git Backup Tab**
   - Navigate to `https://yourdomain.com/goldeneye/admin/`
   - Authenticate with YubiKey
   - Click "Git Backup" tab

2. **Generate SSH Key**
   ```
   Key Name: goldeneye-backup
   Key Type: Ed25519 (recommended)
   ```

3. **Add to Git Service**
   - Copy public key from admin panel
   - Add to GitHub/GitLab as deploy key or SSH key

4. **Configure Remote**
   ```
   Remote Name: origin
   Repository URL: git@github.com:username/goldeneye-backup.git
   ```

5. **Test and Push**
   - Click "Test" to verify connectivity
   - Use "Push to Remote" to backup enrollments

### Manual Git Configuration

```bash
# Navigate to Git backup directory
cd /var/www/html/goldeneye/data/git-backup

# Add remote repository
sudo -u www-data git remote add origin git@github.com:user/repo.git

# Configure SSH key
sudo -u www-data ssh-keygen -t ed25519 -f /var/www/.ssh/goldeneye
# Add public key to Git service

# Test connection
sudo -u www-data ssh -T git@github.com

# Push backups
sudo -u www-data git push origin main
```

## System Theme and UI

### Doves Theme Integration

The system has been consolidated with the cohesive Doves theme design (commit 66764e2), providing:

- **Consistent Styling**: Unified appearance across all interfaces
- **Responsive Design**: Optimized for desktop and mobile browsers
- **Accessibility**: Enhanced contrast and usability
- **Modern UI**: Clean, professional interface

### Customization Options

While the core theme is standardized, certain elements can be customized:

```css
/* Custom system name styling */
.system-name {
    color: var(--primary-color);
    font-weight: bold;
}

/* Custom vault timeout display */
.timeout-indicator {
    background: var(--warning-color);
    border-radius: 4px;
}
```

## Admin Panel Configuration

### Access Control Settings

```javascript
// Session and authentication timeouts
const ADMIN_CONFIG = {
    sessionTimeout: 1800000,    // 30 minutes
    requireReauth: 600000,      // 10 minutes for sensitive operations
    maxRetries: 3,              // Failed authentication attempts
    lockoutTime: 900000         // 15 minutes lockout
};
```

### Security Features

- **YubiKey Required**: Admin access requires enrolled admin key
- **Session Management**: 30-minute timeout with activity tracking
- **Re-authentication**: Required for sensitive operations (key deletion, system reset)
- **Enhanced Delete Protection**: Multi-step confirmation process
- **Security Logging**: All actions logged with timestamps

## API Configuration

### Vault API Settings

The `vault-api.php` handles multiple data types with different retention policies:

```php
// Data type configurations
$dataTypes = [
    'enrollment' => [
        'retention_days' => -1,    // Never expire
        'auth_required' => true,
        'backup_enabled' => true
    ],
    'vault' => [
        'retention_days' => 365,
        'auth_required' => false,
        'backup_enabled' => true
    ],
    'settings' => [
        'retention_days' => -1,    // Never expire
        'auth_required' => false,
        'backup_enabled' => true
    ]
];
```

### Directory Structure

The system automatically creates the following secure directory structure:

```
/goldeneye/data/           # Secure data root (outside web root)
├── enrollments/           # YubiKey enrollments (never expire)
├── vaults/               # Encrypted vaults (365-day retention)  
├── backups/              # General backups (365-day retention)
├── settings.json         # System settings (never expires)
├── git-backup/           # Git repository for version control
└── .auth_tokens/         # Temporary auth tokens (5-min lifetime)
```

## Environment-Specific Configuration

### Development Environment

```javascript
// Enable debug mode
localStorage.setItem('goldeneye_debug', 'true');

// Disable HTTPS requirement (localhost testing)
const DEVELOPMENT_MODE = (location.hostname === 'localhost');
```

### Production Environment

```apache
# Enhanced security headers
<IfModule mod_headers.c>
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
</IfModule>
```

## Monitoring and Maintenance

### Configuration Monitoring

```bash
# Check settings persistence
curl -s "https://yourdomain.com/goldeneye/vault-api.php?type=settings&action=load" | jq

# Monitor enrollment synchronization
ls -la /var/www/html/goldeneye/data/enrollments/

# Check Git backup status
cd /var/www/html/goldeneye/data/git-backup && sudo -u www-data git status
```

### Automated Tasks

```bash
# Add to crontab for regular maintenance
0 2 * * * /usr/local/bin/goldeneye-cleanup.sh    # Daily cleanup
0 * * * * /usr/local/bin/goldeneye-backup.sh     # Hourly Git push
```

## Troubleshooting Configuration

### Common Configuration Issues

**Settings Not Persisting**
- Check PHP write permissions to data directory
- Verify API endpoints are accessible
- Test with browser developer tools

**Enrollment Sync Failures**
- Check YubiKey authentication is working
- Verify server-side storage is functional
- Review error logs for API failures

**Git Backup Issues**
- Test SSH key permissions and connectivity
- Verify remote repository access
- Check Git repository integrity

### Debug Mode

Enable comprehensive debugging:

```javascript
// Enable in browser console
localStorage.setItem('goldeneye_debug', 'true');

// Check debug output
console.log('Debug mode enabled');
// Additional debug information will appear in console
```

## Next Steps

After configuration:

1. **Security Hardening**: Apply production security measures ([Security Hardening Guide](security-hardening.md))
2. **Feature Setup**: Configure advanced features ([Features Documentation](../features/))
3. **Testing**: Verify all configurations ([Testing Guide](../development/testing.md))
4. **Monitoring**: Set up ongoing monitoring and maintenance

## Related Documentation

- **[Installation Guide](installation.md)** - Initial system setup
- **[Security Hardening](security-hardening.md)** - Production security
- **[Enrollment Persistence](../features/enrollment-persistence.md)** - YubiKey sync system
- **[Git Backup Setup](../features/git-backup.md)** - Backup configuration details
- **[Settings Persistence](../features/settings-persistence.md)** - Server-side settings system