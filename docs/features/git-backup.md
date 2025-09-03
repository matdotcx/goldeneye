# Git Backup Configuration for Goldeneye

## Overview

The Goldeneye enrollment persistence system includes automatic Git-based backups. This guide covers both the web-based admin panel interface and advanced command-line configuration options for remote backup repositories.

## Local Git Backup (Default)

By default, the system creates a local Git repository at:
```
/goldeneye/data/git-backup/
```

This provides:
- Version history of all enrollments
- Recovery capability for deleted enrollments
- Audit trail of changes
- No external dependencies

## Admin Panel Git Configuration (Recommended)

The Goldeneye admin panel now includes a comprehensive Git Backup tab for managing backup configurations through a web interface.

### Accessing the Git Backup Interface

1. Navigate to the Goldeneye admin panel: `https://yourdomain.com/goldeneye/admin/`
2. Enroll a YubiKey for authentication (if not already done)
3. Click on the "Git Backup" tab

### Features Available in the UI

#### 1. Git Status Monitoring
- View repository initialization status
- Check current branch
- See total commit count
- View last backup timestamp
- Monitor uncommitted changes

#### 2. Remote Repository Management
- **Add Remote**: Enter a name and URL (GitHub, GitLab, or self-hosted)
- **Test Connection**: Verify connectivity to remote repositories
- **Remove Remote**: Delete configured remotes
- **Push to Remote**: Manually push backups to selected repository

#### 3. SSH Key Management
- **Generate Keys**: Create Ed25519 or RSA keys directly from the UI
- **View Public Keys**: Display and copy public keys for adding to Git services
- **Delete Keys**: Remove SSH keys when no longer needed

#### 4. Manual Operations
- **Push Backups**: Select a remote and push current backups
- **View History**: See recent commits with hash, message, and timestamp

### Quick Setup Guide via Admin Panel

1. **Generate SSH Key**:
   - Enter a key name (e.g., "goldeneye-github")
   - Select key type (Ed25519 recommended)
   - Click "Generate Key"
   - Copy the displayed public key

2. **Add to Git Service**:
   - GitHub: Settings → SSH and GPG keys → New SSH key
   - GitLab: Preferences → SSH Keys → Add key
   - Paste the public key and save

3. **Configure Remote**:
   - Enter remote name (e.g., "origin")
   - Enter repository URL (e.g., `git@github.com:username/goldeneye-backup.git`)
   - Click "Add Remote"

4. **Test and Push**:
   - Click "Test" next to the remote to verify connectivity
   - Select the remote from dropdown
   - Click "Push to Remote" to backup enrollments

### Authentication

The Git UI requires YubiKey authentication for write operations:
- Adding/removing remotes
- Generating/deleting SSH keys
- Pushing to remotes

Read-only operations (status, history, viewing keys) do not require authentication.

## Remote Git Backup Setup (Command Line)

### Option 1: GitHub Private Repository

#### 1. Create GitHub Repository
```bash
# Create a new private repository on GitHub
# Name: goldeneye-enrollments-backup
# Visibility: Private
```

#### 2. Generate Deploy Key
```bash
# On your server, as www-data user
sudo -u www-data ssh-keygen -t ed25519 -C "goldeneye@yourdomain.com" -f /var/www/.ssh/goldeneye_deploy

# Copy the public key
sudo cat /var/www/.ssh/goldeneye_deploy.pub
```

#### 3. Add Deploy Key to GitHub
1. Go to Repository Settings → Deploy Keys
2. Add new deploy key with write access
3. Paste the public key content

#### 4. Configure Git Remote
```bash
cd /var/www/html/goldeneye/data/git-backup
sudo -u www-data git remote add origin git@github.com:yourusername/goldeneye-enrollments-backup.git

# Configure SSH to use the deploy key
sudo -u www-data bash -c 'cat > /var/www/.ssh/config << EOF
Host github.com-goldeneye
    HostName github.com
    User git
    IdentityFile /var/www/.ssh/goldeneye_deploy
    StrictHostKeyChecking no
EOF'

# Update remote URL to use the SSH config
sudo -u www-data git remote set-url origin git@github.com-goldeneye:yourusername/goldeneye-enrollments-backup.git
```

#### 5. Create Auto-Push Script
```bash
sudo nano /usr/local/bin/goldeneye-push-backup.sh
```

Add content:
```bash
#!/bin/bash
cd /var/www/html/goldeneye/data/git-backup
sudo -u www-data git push origin main --force 2>&1 | logger -t goldeneye-backup
```

Make executable:
```bash
sudo chmod +x /usr/local/bin/goldeneye-push-backup.sh
```

#### 6. Schedule Automatic Pushes
```bash
# Edit crontab for root
sudo crontab -e

# Add hourly push (adjust frequency as needed)
0 * * * * /usr/local/bin/goldeneye-push-backup.sh

# Or for immediate push after each change, modify vault-api.php
```

### Option 2: Self-Hosted Git Server

#### 1. Set Up Git Server
```bash
# On backup server
sudo apt-get install git
sudo useradd -m -s /bin/bash git
sudo -u git mkdir /home/git/goldeneye-backup.git
sudo -u git git init --bare /home/git/goldeneye-backup.git
```

#### 2. Configure SSH Access
```bash
# On Goldeneye server
sudo -u www-data ssh-keygen -t ed25519 -f /var/www/.ssh/goldeneye_backup

# Copy public key to git server
sudo -u www-data ssh-copy-id -i /var/www/.ssh/goldeneye_backup.pub git@backup-server
```

#### 3. Add Remote
```bash
cd /var/www/html/goldeneye/data/git-backup
sudo -u www-data git remote add backup git@backup-server:/home/git/goldeneye-backup.git
sudo -u www-data git push backup main
```

### Option 3: GitLab Private Repository

Similar to GitHub setup but with GitLab-specific steps:

1. Create private project on GitLab
2. Generate and add deploy token with write_repository scope
3. Configure remote with token:
```bash
sudo -u www-data git remote add origin https://oauth2:YOUR_TOKEN@gitlab.com/username/goldeneye-backup.git
```

## Modifying vault-api.php for Immediate Push

To push changes immediately after each enrollment:

```php
// In vault-api.php, after gitBackup() call:
if ($type === 'enrollment') {
    gitBackup($dataFile, "Add/update enrollment: " . $dataId);
    
    // Push to remote immediately
    exec('cd ' . escapeshellarg(GIT_BACKUP_DIR) . ' && git push origin main 2>&1', $output, $returnCode);
    if ($returnCode !== 0) {
        error_log('Git push failed: ' . implode("\n", $output));
    }
}
```

## Admin Panel Configuration (Future Enhancement)

Proposed UI configuration in admin panel:

```javascript
// Configuration object for admin panel
const gitBackupConfig = {
    enabled: true,
    remoteUrl: 'git@github.com:user/goldeneye-backup.git',
    pushStrategy: 'immediate', // 'immediate', 'batch', 'scheduled'
    pushFrequency: 3600, // seconds (if scheduled)
    authentication: {
        type: 'ssh', // 'ssh' or 'https'
        keyPath: '/var/www/.ssh/goldeneye_deploy'
    }
};

// Function to update Git configuration
async function updateGitBackupConfig(config) {
    const response = await fetch('vault-api.php?type=config&action=update-git', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': authToken
        },
        body: JSON.stringify(config)
    });
    
    if (response.ok) {
        showStatus('Git backup configuration updated', 'success');
    }
}
```

## Monitoring and Maintenance

### Check Backup Status
```bash
# View last push
cd /var/www/html/goldeneye/data/git-backup
sudo -u www-data git log origin/main -1

# Check for unpushed commits
sudo -u www-data git status
sudo -u www-data git log origin/main..HEAD
```

### Manual Push
```bash
cd /var/www/html/goldeneye/data/git-backup
sudo -u www-data git push origin main
```

### Troubleshooting

#### Permission Issues
```bash
# Fix SSH permissions
sudo chown -R www-data:www-data /var/www/.ssh
sudo chmod 700 /var/www/.ssh
sudo chmod 600 /var/www/.ssh/goldeneye_*
```

#### Connection Issues
```bash
# Test SSH connection
sudo -u www-data ssh -T git@github.com-goldeneye

# Debug Git push
sudo -u www-data GIT_SSH_COMMAND="ssh -v" git push origin main
```

#### Recovery from Remote
```bash
# Clone backup repository
git clone git@github.com:username/goldeneye-enrollments-backup.git recovery

# Copy enrollments back
cp recovery/*.json /var/www/html/goldeneye/data/enrollments/
```

## Security Considerations

1. **Access Control**
   - Use deploy keys with minimal permissions
   - Never commit sensitive unencrypted data
   - Restrict repository access to necessary users only

2. **Encryption**
   - Consider encrypting backups before pushing
   - Use GPG encryption for additional security layer

3. **Audit Trail**
   - All Git commits are signed with timestamp
   - Maintain logs of push operations
   - Monitor for unauthorized access

## Best Practices

1. **Regular Testing**
   - Test recovery procedure monthly
   - Verify backup integrity
   - Document recovery steps

2. **Multiple Backups**
   - Push to multiple remote repositories
   - Keep local backups in addition to remote
   - Consider off-site physical backups

3. **Monitoring**
   - Set up alerts for failed pushes
   - Monitor repository size
   - Track enrollment changes

## Example Recovery Procedure

```bash
# 1. List available backups
cd /var/www/html/goldeneye/data/git-backup
sudo -u www-data git log --oneline --name-only

# 2. Recover specific enrollment
sudo -u www-data git show HEAD~5:abc123def456.json > /tmp/recovered.json

# 3. Restore to enrollments directory
sudo cp /tmp/recovered.json /var/www/html/goldeneye/data/enrollments/

# 4. Verify restoration
cat /var/www/html/goldeneye/data/enrollments/abc123def456.json
```

## Future Enhancements

- Web UI for backup configuration
- Automated backup verification
- Encrypted backup support
- Multi-destination backup
- Backup rotation policies
- Email notifications for backup failures