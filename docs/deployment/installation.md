# Goldeneye Installation Guide

## System Requirements

### Server Requirements
- **Web Server**: Apache 2.4+ or Nginx 1.14+
- **PHP**: 8.3+ with PHP-FPM (for vault API and persistence)
- **Git**: For enrollment backup system
- **HTTPS**: Required for WebAuthn functionality
- **Storage**: 100MB+ for data storage (scales with usage)

### Client Requirements  
- **Browser**: Chrome 67+, Firefox 60+, Safari 14+, Edge 79+
- **WebAuthn Support**: Required (all modern browsers support this)
- **JavaScript**: Enabled (required for all functionality)
- **YubiKeys**: FIDO2/WebAuthn compatible YubiKeys

## Installation Steps

### 1. Server Setup

#### Upload Files
```bash
# Upload all files to your web directory
scp -r goldeneye/ user@server:/var/www/html/goldeneye/
```

#### Set Permissions and Configuration
```bash
# Create and secure data directory (vault-api.php will create subdirectories)
mkdir -p /var/www/html/goldeneye/data
chmod 755 /var/www/html/goldeneye/data
chown www-data:www-data /var/www/html/goldeneye/data

# Ensure PHP can execute API files
chmod 644 /var/www/html/goldeneye/vault-api.php

# Install PHP-FPM if not already installed
sudo apt-get install php8.3-fpm
sudo systemctl enable php8.3-fpm
sudo systemctl start php8.3-fpm

# Enable required Apache modules
sudo a2enmod proxy_fcgi setenvif
sudo a2enconf php8.3-fpm
sudo systemctl restart apache2
```

**Important**: The system automatically creates a secure data directory structure outside the web root as of commit f45d3b9. This is a critical security improvement that prevents direct web access to sensitive data files.

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

# Data directory is automatically secured outside web root
# No additional configuration needed
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

### 3. Initial Testing

1. Access `https://yourdomain.com/goldeneye/admin/`
2. Try to enroll a test YubiKey
3. Check that backup API works
4. Test user interface at `https://yourdomain.com/goldeneye/`

## Security Configuration

### Included Security Features
The installation includes comprehensive security protections out-of-the-box:

- **HTTPS Enforcement**: Automatic HTTP to HTTPS redirects
- **Security Headers**: X-Frame-Options, Content-Security-Policy, X-Content-Type-Options
- **Data Directory Protection**: Sensitive data stored outside web root (as of commit f45d3b9)
- **Access Controls**: Basic authentication and rate limiting
- **Attack Pattern Blocking**: Common attack vector prevention

### File Permissions
```bash
# Set appropriate permissions for application files
chmod 644 /var/www/html/goldeneye/*.html
chmod 644 /var/www/html/goldeneye/*.js
chmod 644 /var/www/html/goldeneye/*.php
chmod 644 /var/www/html/goldeneye/.htaccess

# Data directory permissions are handled automatically
```

## Maintenance

### Log Monitoring
```bash
# Check web server logs for errors
tail -f /var/log/apache2/error.log | grep goldeneye
tail -f /var/log/nginx/error.log | grep goldeneye

# Monitor PHP errors
tail -f /var/log/php8.3-fpm.log
```

### Data Directory Monitoring
```bash
# Check data directory usage (automatically created outside web root)
du -sh /path/to/goldeneye/data/*

# Verify backup cleanup (should auto-clean after 365 days)
ls -la /path/to/goldeneye/data/vaults/ | head -20
```

## Troubleshooting

### Common Issues

**WebAuthn Not Working**
- Verify HTTPS is working correctly
- Check browser compatibility
- Ensure domain matches WebAuthn configuration
- Test with different YubiKey models

**API Errors**  
- Check PHP error logs
- Verify data directory exists and is writable
- Test API endpoints with curl
- Ensure adequate disk space

**Key Detection Issues**
- Clear browser localStorage and try again
- Check browser console for JavaScript errors
- Verify YubiKey firmware is up to date
- Try different USB ports

### Installation Verification Checklist

- [ ] HTTPS properly configured and working
- [ ] Data directory automatically created outside web root
- [ ] PHP error logging configured
- [ ] File permissions set correctly
- [ ] Security headers configured
- [ ] YubiKey enrollment working
- [ ] Admin panel accessible
- [ ] User interface functional

## Next Steps

After successful installation:

1. **Configuration**: Set up system settings and enrollment persistence ([Configuration Guide](configuration.md))
2. **Security Hardening**: Apply additional security measures ([Security Hardening Guide](security-hardening.md))
3. **Feature Setup**: Configure Git backups and other advanced features ([Features Documentation](../features/))
4. **Testing**: Run comprehensive system tests ([Testing Guide](../development/testing.md))

## Related Documentation

- **[Configuration Guide](configuration.md)** - System configuration and settings
- **[Security Hardening](security-hardening.md)** - Production security guidelines
- **[Enrollment Persistence](../features/enrollment-persistence.md)** - YubiKey synchronization setup
- **[Testing Guide](../development/testing.md)** - Verification procedures