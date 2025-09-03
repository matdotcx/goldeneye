# Goldeneye Enrollment Persistence System

## Overview

The Goldeneye enrollment persistence system ensures YubiKey enrollments are synchronized across browsers and devices, solving the limitation of browser-specific localStorage. This documentation covers the implementation, setup, and maintenance of the persistence system.

## Architecture

### Components

1. **Vault API (`vault-api.php`)**: Server-side PHP API handling data persistence
2. **JavaScript Client (`goldeneye-admin.js`)**: Client-side enrollment sync
3. **Git Backup System**: Automated version control for enrollment data
4. **Directory Structure**: Organized storage with different retention policies

### Data Flow

```
Browser A (Enroll Key) → localStorage → Sync to Server → Git Backup
                                              ↓
Browser B (Load Page) ← localStorage ← Sync from Server
```

## Server Setup

### Prerequisites

- PHP 8.3+ with PHP-FPM
- Apache with mod_rewrite, mod_proxy_fcgi
- Git installed on server
- Write permissions for web user (www-data)

### Directory Structure

The system creates the following directory structure:

```
/goldeneye/
├── vault-api.php           # Main API endpoint
├── data/                   # Data storage root (www-data owned)
│   ├── enrollments/        # YubiKey enrollments (never expire)
│   ├── vaults/            # Encrypted vaults (365-day retention)
│   ├── backups/           # General backups (365-day retention)
│   ├── git-backup/        # Git repository for enrollments
│   └── .auth_tokens/      # Temporary auth tokens (5-min lifetime)
```

### Initial Setup

1. **Create data directory with proper permissions:**
```bash
sudo mkdir -p /path/to/goldeneye/data
sudo chown www-data:www-data /path/to/goldeneye/data
sudo chmod 755 /path/to/goldeneye/data
```

2. **Ensure PHP-FPM is installed and running:**
```bash
sudo apt-get install php8.3-fpm
sudo systemctl enable php8.3-fpm
sudo systemctl start php8.3-fpm
```

3. **Configure Apache (if needed):**
```apache
<FilesMatch \.php$>
    SetHandler "proxy:unix:/var/run/php/php8.3-fpm.sock|fcgi://localhost"
</FilesMatch>
```

4. **Git backup initialization (automatic):**
   - The system automatically initializes a Git repository on first run
   - Located at `data/git-backup/`
   - Commits are made automatically when enrollments are uploaded

## API Endpoints

### Base URL
```
https://yourdomain.com/goldeneye/vault-api.php
```

### Endpoints

#### 1. List Enrollments
```http
GET /vault-api.php?type=enrollment&action=list
```
- **Auth Required**: No (needed for initial sync)
- **Response**: JSON array of enrollment metadata

#### 2. Upload Enrollment
```http
POST /vault-api.php?type=enrollment&action=upload
Headers:
  Content-Type: application/json
  X-Auth-Token: <token-from-yubikey-auth>
Body:
{
  "credentialId": "base64-credential-id",
  "name": "Key Name",
  "description": "Key Description",
  "enrolledAt": "ISO-8601-timestamp",
  "active": true
}
```
- **Auth Required**: Yes (YubiKey authentication)
- **Response**: Success with enrollment ID

#### 3. Download Enrollment
```http
GET /vault-api.php?type=enrollment&action=download/<enrollment-id>
```
- **Auth Required**: No (needed for sync)
- **Response**: Full enrollment data

#### 4. Authenticate
```http
POST /vault-api.php?type=enrollment&action=auth
Body:
{
  "credentialId": "base64-credential-id",
  "signature": "base64-signature"
}
```
- **Auth Required**: No
- **Response**: Auth token valid for 5 minutes

## Client-Side Implementation

### Enrollment Sync Process

1. **On Page Load (`init()`):**
   - Load local enrollments from localStorage
   - Call `syncEnrollmentsFromServer()`
   - Merge server enrollments with local data

2. **On New Enrollment (`enrollNewKey()`):**
   - Save to localStorage
   - Call `syncEnrollmentToServer()`
   - Upload to server with YubiKey auth

3. **Authentication Flow:**
   - User touches YubiKey for authentication
   - Generate signature with WebAuthn
   - Exchange signature for auth token
   - Use token for upload operations

### JavaScript Functions

```javascript
// Sync enrollment to server after creation
async function syncEnrollmentToServer(keyData)

// Load enrollments from server on page load
async function syncEnrollmentsFromServer()

// Get auth token using YubiKey
async function getAuthToken(credentialId)
```

## Git Backup System

### How It Works

1. **Automatic Initialization:**
   - On first API call, creates `data/git-backup/` repository
   - Sets up git config with default user
   - Creates initial commit with README

2. **Enrollment Backup:**
   - Every enrollment upload triggers a Git commit
   - Commit message: "Add/update enrollment: <enrollment-id>"
   - Both data and metadata files are committed

3. **Version History:**
   - All changes are tracked in Git
   - Can recover any previous version
   - Provides audit trail of all enrollments

### Admin Panel Git Management

The admin panel now includes a dedicated **Git Backup** tab for managing backup configurations through a web interface. This provides:

- Visual status monitoring
- Remote repository management
- SSH key generation and management
- Manual push operations
- Commit history viewing

See [Git Backup Setup Guide](git-backup.md#admin-panel-git-configuration-recommended) for detailed instructions on using the web interface.

### Manual Git Operations

```bash
# View backup history
cd /path/to/goldeneye/data/git-backup
sudo -u www-data git log --oneline

# Recover a deleted enrollment
sudo -u www-data git show <commit-hash>:enrollment-id.json

# Check backup status
sudo -u www-data git status
```

### Setting Up Remote Backup (Optional)

To push backups to a remote Git repository:

1. **Add SSH key for www-data user:**
```bash
sudo -u www-data ssh-keygen -t ed25519 -C "goldeneye-backup"
# Add the public key to your Git service (GitHub, GitLab, etc.)
```

2. **Configure remote repository:**
```bash
cd /path/to/goldeneye/data/git-backup
sudo -u www-data git remote add origin git@github.com:username/goldeneye-backups.git
```

3. **Create automated push script:**
```bash
#!/bin/bash
cd /path/to/goldeneye/data/git-backup
sudo -u www-data git push origin main
```

4. **Add to crontab for regular pushes:**
```bash
# Push every hour
0 * * * * /path/to/push-backups.sh
```

## Security Features

### Authentication
- YubiKey-based authentication for uploads
- 5-minute auth token lifetime
- Tokens stored server-side with expiration

### Data Protection
- Enrollments use deterministic IDs (hash of credentialId)
- Only YubiKey holder can generate correct ID
- Client-side encryption before server storage (optional)

### Retention Policies
- **Enrollments**: Never expire (`ENROLLMENT_RETENTION_DAYS = -1`)
- **Vaults/Backups**: 365-day retention
- **Auth Tokens**: 5-minute lifetime with automatic cleanup

## Troubleshooting

### Common Issues

#### 1. "Failed to create directory" Error
```bash
# Fix permissions
sudo chown -R www-data:www-data /path/to/goldeneye/data
sudo chmod -R 755 /path/to/goldeneye/data
```

#### 2. PHP 503 Errors
```bash
# Check PHP-FPM status
sudo systemctl status php8.3-fpm

# Restart if needed
sudo systemctl restart php8.3-fpm
```

#### 3. Git "dubious ownership" Warning
```bash
# Run Git commands as www-data
sudo -u www-data git -C /path/to/data/git-backup <command>
```

#### 4. Enrollments Not Syncing
- Check browser console for errors
- Verify API endpoints are accessible
- Check server error logs: `/var/log/apache2/error.log`

### Debug Mode

Enable debug output in JavaScript console:
```javascript
// In browser console
localStorage.setItem('goldeneye_debug', 'true');
```

## Maintenance

### Regular Tasks

1. **Monitor disk usage:**
```bash
du -sh /path/to/goldeneye/data/*
```

2. **Check Git backup status:**
```bash
cd /path/to/goldeneye/data/git-backup
sudo -u www-data git status
sudo -u www-data git log --oneline -10
```

3. **Clean expired auth tokens (automatic):**
   - Happens automatically on 1% of API requests
   - Or manually: Remove files older than 5 minutes from `.auth_tokens/`

### Backup Recovery

To recover lost enrollments from Git:

```bash
# List all enrollment backups
cd /path/to/goldeneye/data/git-backup
sudo -u www-data git log --name-only --pretty=format:"%h %s"

# Restore specific enrollment
sudo -u www-data git show <commit>:enrollment-id.json > /path/to/goldeneye/data/enrollments/enrollment-id.json
```

## Future Enhancements

### Planned Features

1. **Admin Panel Configuration:**
   - Add UI for setting remote Git URL
   - Configure retention policies
   - View backup status

2. **Enhanced Security:**
   - End-to-end encryption of enrollments
   - Multi-factor authentication for admin access
   - Audit logging of all operations

3. **Improved Backup:**
   - Automatic push to remote repository
   - Multiple backup destinations
   - Encrypted off-site backups

### Configuration Options (Proposed)

```javascript
// In admin panel settings
const backupConfig = {
    gitRemoteUrl: 'git@github.com:user/goldeneye-backups.git',
    pushFrequency: 'hourly', // 'immediate', 'hourly', 'daily'
    encryptBackups: true,
    retentionDays: {
        enrollments: -1,  // Never expire
        vaults: 365,
        backups: 30
    }
};
```

## Support

For issues or questions:
1. Check the browser console for JavaScript errors
2. Review server logs at `/var/log/apache2/`
3. Verify all prerequisites are installed
4. Ensure proper file permissions

## License

Part of the Goldeneye project - see main README for license information.