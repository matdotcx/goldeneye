# Goldeneye Security Hardening Guide

## Overview

This guide provides comprehensive security hardening measures for production Goldeneye deployments, building on the secure defaults provided by the installation.

## Critical Security Fix Implementation

As of commit f45d3b9, Goldeneye includes a **critical security improvement** that moves the data directory outside the web root, preventing direct web access to sensitive files.

### What Changed
- **Data Directory**: Moved from `/goldeneye/data/` to secure location outside web root
- **Automatic Protection**: No manual configuration required
- **Backward Compatibility**: Existing installations automatically migrate
- **Enhanced Security**: Eliminates direct file access attack vectors

## File System Security

### Directory Permissions

The system automatically configures secure permissions:

```bash
# Verify secure permissions (should be set automatically)
ls -la /path/to/goldeneye/data/
# drwxr-xr-x www-data www-data data/
# drwx------ www-data www-data data/.auth_tokens/
# drwxr-xr-x www-data www-data data/enrollments/
# drwxr-xr-x www-data www-data data/git-backup/
```

### Additional File Hardening

```bash
# Restrict access to sensitive files
chmod 600 /var/www/html/goldeneye/vault-api.php
chmod 644 /var/www/html/goldeneye/*.html
chmod 644 /var/www/html/goldeneye/*.js

# Secure configuration files
chmod 644 /var/www/html/goldeneye/.htaccess
chown root:root /var/www/html/goldeneye/.htaccess
```

## Web Server Security

### Apache Security Headers

```apache
# Enhanced security headers (.htaccess)
<IfModule mod_headers.c>
    # Prevent clickjacking
    Header always set X-Frame-Options "SAMEORIGIN"
    
    # Prevent MIME type sniffing
    Header always set X-Content-Type-Options "nosniff"
    
    # Enable XSS protection
    Header always set X-XSS-Protection "1; mode=block"
    
    # Control referrer information
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    
    # Strict Content Security Policy
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'none'; child-src 'none';"
    
    # HTTP Strict Transport Security
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    
    # Prevent caching of sensitive content
    Header always set Cache-Control "no-cache, no-store, must-revalidate"
    Header always set Pragma "no-cache"
    Header always set Expires "0"
</IfModule>

# Disable server signature
ServerTokens Prod
ServerSignature Off
```

### Nginx Security Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    root /var/www/html/goldeneye;
    
    # SSL Security
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Hide server information
    server_tokens off;
    more_set_headers 'Server: ';
    
    # Disable caching for security
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
}
```

## Access Control and Rate Limiting

### IP-Based Access Control

```apache
# Restrict admin access to specific IPs (.htaccess in admin/)
<RequireAll>
    Require all granted
    Require ip 192.168.1.0/24
    Require ip 10.0.0.0/8
</RequireAll>
```

### Rate Limiting

```nginx
# Nginx rate limiting
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
    limit_req_zone $binary_remote_addr zone=admin:10m rate=5r/m;
}

server {
    location /vault-api.php {
        limit_req zone=api burst=5 nodelay;
    }
    
    location /admin/ {
        limit_req zone=admin burst=3 nodelay;
    }
}
```

### Fail2Ban Integration

```ini
# /etc/fail2ban/jail.d/goldeneye.conf
[goldeneye-auth]
enabled = true
port = http,https
filter = goldeneye-auth
logpath = /var/log/apache2/access.log
maxretry = 3
bantime = 3600
findtime = 600

[goldeneye-api]
enabled = true
port = http,https
filter = goldeneye-api
logpath = /var/log/apache2/access.log
maxretry = 10
bantime = 1800
findtime = 300
```

## Database and File Security

### Encryption at Rest

```bash
# Enable filesystem encryption (example with LUKS)
sudo apt-get install cryptsetup

# Create encrypted partition for data
sudo cryptsetup luksFormat /dev/sdb1
sudo cryptsetup luksOpen /dev/sdb1 goldeneye-data
sudo mkfs.ext4 /dev/mapper/goldeneye-data
sudo mount /dev/mapper/goldeneye-data /var/goldeneye-data
```

### Backup Security

```bash
# Encrypt backups before storage
gpg --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
    --s2k-digest-algo SHA512 --s2k-count 65536 --symmetric \
    --output backup.gpg backup.json

# Store encrypted backups
rsync -av --delete backup.gpg user@backup-server:/secure/backups/
```

## Network Security

### Firewall Configuration

```bash
# UFW firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (for redirects)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Restrict SSH access
sudo ufw allow from 192.168.1.0/24 to any port 22
```

### SSL/TLS Hardening

```apache
# Apache SSL configuration
SSLEngine on
SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
SSLCipherSuite ECDHE+AESGCM:ECDHE+AES256:ECDHE+AES128:!aNULL:!MD5:!DSS
SSLHonorCipherOrder on
SSLCompression off
SSLSessionTickets off

# OCSP Stapling
SSLUseStapling on
SSLStaplingCache "shmcb:logs/stapling-cache(150000)"
```

## Monitoring and Alerting

### Log Monitoring

```bash
# Monitor authentication attempts
tail -f /var/log/apache2/access.log | grep -E "(admin|vault-api)" | \
    grep -E "(40[1-4]|50[0-5])" | \
    while read line; do
        echo "$(date): Suspicious activity: $line" | \
        mail -s "Goldeneye Security Alert" admin@yourdomain.com
    done
```

### File Integrity Monitoring

```bash
# Install and configure AIDE
sudo apt-get install aide
sudo aideinit

# Create monitoring script
#!/bin/bash
# /usr/local/bin/goldeneye-integrity-check.sh
/usr/bin/aide --check --verbose=3 | \
    grep -E "(changed|added|removed)" | \
    mail -s "Goldeneye File Changes Detected" admin@yourdomain.com

# Add to crontab
0 3 * * * /usr/local/bin/goldeneye-integrity-check.sh
```

### Security Scanning

```bash
# Automated vulnerability scanning
#!/bin/bash
# /usr/local/bin/goldeneye-security-scan.sh

# Check for outdated packages
apt list --upgradable | grep -E "(php|apache|nginx)" > /tmp/updates.txt
if [ -s /tmp/updates.txt ]; then
    mail -s "Security Updates Available" admin@yourdomain.com < /tmp/updates.txt
fi

# Check SSL certificate expiry
openssl x509 -in /path/to/cert.pem -noout -checkend 2592000 || \
    echo "SSL certificate expires in 30 days" | \
    mail -s "SSL Certificate Expiry Warning" admin@yourdomain.com
```

## Application-Level Security

### Admin Panel Hardening

```javascript
// Enhanced session security
const SECURITY_CONFIG = {
    sessionTimeout: 1800000,        // 30 minutes
    requireReauth: 600000,          // 10 minutes for sensitive ops
    maxRetries: 3,                  // Failed attempts before lockout
    lockoutTime: 900000,            // 15 minutes lockout
    passwordComplexity: {
        minLength: 12,
        requireUppercase: true,
        requireNumbers: true,
        requireSymbols: true
    }
};
```

### Input Validation

```php
// Enhanced input validation in vault-api.php
function validateInput($data, $type) {
    // Sanitize input
    $data = filter_var($data, FILTER_SANITIZE_STRING, FILTER_FLAG_NO_ENCODE_QUOTES);
    
    // Type-specific validation
    switch($type) {
        case 'credentialId':
            if (!preg_match('/^[A-Za-z0-9+\/]+=*$/', $data)) {
                throw new InvalidArgumentException('Invalid credential ID format');
            }
            break;
        case 'authToken':
            if (!preg_match('/^[a-f0-9]{64}$/', $data)) {
                throw new InvalidArgumentException('Invalid auth token format');
            }
            break;
    }
    
    return $data;
}
```

## Incident Response

### Security Event Logging

```php
// Enhanced logging system
function logSecurityEvent($event, $details) {
    $logEntry = [
        'timestamp' => date('c'),
        'event' => $event,
        'ip' => $_SERVER['REMOTE_ADDR'],
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'details' => $details
    ];
    
    // Write to secure log file
    file_put_contents(
        '/var/log/goldeneye/security.log',
        json_encode($logEntry) . "\n",
        FILE_APPEND | LOCK_EX
    );
    
    // Alert on critical events
    if (in_array($event, ['admin_login_failed', 'multiple_auth_failures', 'key_deleted'])) {
        mail('security@yourdomain.com', 'Goldeneye Security Alert', json_encode($logEntry));
    }
}
```

### Emergency Response Procedures

```bash
#!/bin/bash
# /usr/local/bin/goldeneye-emergency-shutdown.sh

# Immediate response to security incident
echo "Emergency shutdown initiated at $(date)" >> /var/log/goldeneye/emergency.log

# Disable web access temporarily
echo "Deny from all" > /var/www/html/goldeneye/.htaccess.emergency
mv /var/www/html/goldeneye/.htaccess.emergency /var/www/html/goldeneye/.htaccess

# Block suspicious IPs
SUSPICIOUS_IP="$1"
if [ ! -z "$SUSPICIOUS_IP" ]; then
    iptables -A INPUT -s $SUSPICIOUS_IP -j DROP
    echo "Blocked IP: $SUSPICIOUS_IP" >> /var/log/goldeneye/emergency.log
fi

# Notify administrators
echo "Emergency shutdown completed. Manual intervention required." | \
    mail -s "URGENT: Goldeneye Emergency Shutdown" admin@yourdomain.com
```

## Regular Security Maintenance

### Security Checklist (Weekly)

- [ ] Review access logs for suspicious activity
- [ ] Check SSL certificate status and expiry
- [ ] Update system packages and dependencies  
- [ ] Verify backup integrity and encryption
- [ ] Test emergency response procedures
- [ ] Review user access and permissions

### Security Checklist (Monthly)

- [ ] Perform penetration testing
- [ ] Update security policies and procedures
- [ ] Review and rotate API keys if applicable
- [ ] Audit user accounts and access levels
- [ ] Update incident response documentation
- [ ] Test backup restoration procedures

## Production Deployment Checklist

Before deploying to production:

- [ ] **HTTPS Required**: SSL/TLS properly configured
- [ ] **Data Directory**: Secured outside web root (automatic)
- [ ] **Security Headers**: All recommended headers enabled
- [ ] **Access Controls**: IP restrictions and rate limiting configured
- [ ] **Monitoring**: Logging and alerting systems active
- [ ] **Backups**: Encrypted backup system tested
- [ ] **Incident Response**: Emergency procedures documented
- [ ] **Updates**: All security patches applied

## Related Documentation

- **[Installation Guide](installation.md)** - Initial secure setup
- **[Configuration Guide](configuration.md)** - System configuration
- **[Security Analysis](../security/analysis.md)** - Comprehensive security review
- **[Admin Panel Security](../security/admin-panel.md)** - Administrative security features