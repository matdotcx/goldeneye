# Goldeneye Deployment Guide

## System Requirements

### Server Requirements
- **Web Server**: Apache 2.4+ or Nginx 1.14+
- **PHP**: 7.4+ (for backup API)
- **HTTPS**: Required for WebAuthn functionality
- **Storage**: 100MB+ for backup storage (scales with usage)

### Client Requirements  
- **Browser**: Chrome 67+, Firefox 60+, Safari 14+, Edge 79+
- **WebAuthn Support**: Required (all modern browsers support this)
- **JavaScript**: Enabled (required for all functionality)
- **YubiKeys**: FIDO2/WebAuthn compatible YubiKeys

## Deployment Steps

### 1. Server Setup

#### Upload Files
```bash
# Upload all files to your web directory
scp -r goldeneye/ user@server:/var/www/html/goldeneye/
```

#### Set Permissions and Configuration
```bash
# Create and secure backup directory
mkdir -p /var/www/html/goldeneye/backups
chmod 755 /var/www/html/goldeneye/backups
chown www-data:www-data /var/www/html/goldeneye/backups

# Ensure PHP can write backup files
chmod 644 /var/www/html/goldeneye/backup-api.php

# IMPORTANT: .htaccess files are included with basic security
# but you should customize them for your deployment:

# Customize main .htaccess (recommended)
nano /var/www/html/goldeneye/.htaccess
# - Update Content-Security-Policy with your domain
# - Add additional rate limiting if needed
# - Configure custom logging paths

# Backup directory .htaccess should work as-is but can be enhanced
nano /var/www/html/goldeneye/backups/.htaccess
# - Add custom logging if desired
# - Configure additional protections

# Set appropriate permissions
chmod 644 /var/www/html/goldeneye/.htaccess
chmod 644 /var/www/html/goldeneye/backups/.htaccess
```

**⚠️ Critical Security Note**: The included `.htaccess` files provide essential security protections including:
- HTTPS redirect (required for WebAuthn)
- Basic security headers
- Backup directory protection
- Attack pattern blocking

While functional out-of-the-box, customizing them for your specific deployment is strongly recommended.

#### Configure Web Server

**Apache Configuration**
```apache
<Directory "/var/www/html/goldeneye">
    AllowOverride All
    Require all granted
    
    # Force HTTPS (required for WebAuthn)
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</Directory>

<Directory "/var/www/html/goldeneye/backups">
    # Additional security for backup directory
    Require all denied
    AllowOverride All
</Directory>
```

**Nginx Configuration**
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    root /var/www/html/goldeneye;
    
    # SSL configuration (required for WebAuthn)
    ssl_certificate /path/to/your/certificate.pem;
    ssl_certificate_key /path/to/your/private-key.pem;
    
    location / {
        try_files $uri $uri/ =404;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
    
    location /backups/ {
        deny all;
        return 404;
    }
    
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 2. SSL/HTTPS Setup

**Using Let's Encrypt (Recommended)**
```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-apache

# Get certificate
sudo certbot --apache -d yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

**Verify HTTPS**
- Visit https://yourdomain.com/goldeneye/
- Check that browser shows secure lock icon
- Test WebAuthn functionality

### 3. Security Hardening

#### File Permissions
```bash
# Restrict access to sensitive files
chmod 600 /var/www/html/goldeneye/backup-api.php
chmod 700 /var/www/html/goldeneye/backups
chmod 644 /var/www/html/goldeneye/*.html
chmod 644 /var/www/html/goldeneye/*.js
```

#### Security Headers
```apache
# Add to .htaccess in goldeneye root directory
<IfModule mod_headers.c>
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
</IfModule>
```

### 4. Initial Testing

1. Access `https://yourdomain.com/goldeneye/admin.html`
2. Try to enroll a test YubiKey
3. Check that backup API works
4. Test user interface at `https://yourdomain.com/goldeneye/`

## Maintenance

### Backup Monitoring
```bash
# Monitor backup directory size
du -sh /var/www/html/goldeneye/backups/

# Check backup cleanup (should auto-clean after 365 days)
ls -la /var/www/html/goldeneye/backups/ | head -20
```

### Log Monitoring
```bash
# Check web server logs for errors
tail -f /var/log/apache2/error.log | grep goldeneye
tail -f /var/log/nginx/error.log | grep goldeneye
```

## Troubleshooting

### Common Issues

**WebAuthn Not Working**
- Verify HTTPS is working correctly
- Check browser compatibility
- Ensure domain matches WebAuthn configuration
- Test with different YubiKey models

**Backup API Errors**  
- Check PHP error logs
- Verify file permissions on backups/ directory
- Test API endpoints with curl
- Ensure adequate disk space

**Key Detection Issues**
- Clear browser localStorage and try again
- Check browser console for JavaScript errors
- Verify YubiKey firmware is up to date
- Try different USB ports

## Production Checklist

- [ ] HTTPS properly configured and working
- [ ] Backup directory secured and inaccessible via web
- [ ] PHP error logging configured
- [ ] File permissions set correctly
- [ ] Security headers configured
- [ ] Backup retention policy configured
- [ ] Testing completed successfully
- [ ] Documentation provided to users