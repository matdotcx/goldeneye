# Goldeneye Admin Panel Security

## Access Control System

### Primary Authentication
- **YubiKey Required**: Admin access requires a YubiKey enrolled as an admin key
- **Session Management**: 30-minute session timeout with activity tracking
- **Failed Attempt Protection**: Account lockout after 3 failed attempts (15-minute lockout)
- **HTTPS Enforcement**: WebAuthn requires secure connection

### Authentication Flow
1. **Initial Access**: Visiting `/admin/` shows authentication screen
2. **YubiKey Challenge**: System prompts for YubiKey insertion and touch
3. **Session Creation**: Successful auth creates encrypted session in localStorage
4. **Admin Panel Access**: Full admin functionality becomes available
5. **Activity Monitoring**: Sessions expire after 30 minutes of inactivity

## Sensitive Operations Protection

### Re-Authentication Required
These operations require YubiKey re-authentication (after 10 minutes of inactivity):

- **Key Deletion**: Delete any enrolled YubiKey
- **System Reset**: Complete data wipe
- **Backup Restore**: Restoring from backup files
- **Admin Settings**: Configuration changes

### Enhanced Delete Protection
When deleting a key or resetting the system:

1. **Re-Authentication**: Touch YubiKey to confirm identity
2. **Multi-Step Confirmation**: Multiple confirmation dialogs
3. **Exact Text Verification**: Must type "DELETE" or "RESET EVERYTHING"
4. **Security Logging**: All actions logged with timestamps
5. **Final Warning**: Last chance to abort

## Session Security

### Encrypted Storage
- Sessions stored with encryption in localStorage
- Timeout protection with auto-logout after 30 minutes
- Activity tracking updates on every click/keystroke
- Manual logout via red "Logout" button in top-right

### Attack Prevention
- **Rate Limiting**: Maximum 3 authentication attempts
- **Temporary Lockout**: 15-minute cooldown after failed attempts
- **Attempt Logging**: All authentication attempts logged
- **Generic Errors**: No information disclosure in error messages

## Security Logging

All security events are logged with:
- Timestamp
- Event type (login, logout, key_deleted, etc.)
- User details
- Browser information
- Action results

### Events Logged
- `admin_login` - Successful authentication
- `admin_logout` - Manual or automatic logout
- `auth_failed` - Failed authentication attempt
- `account_locked` - Account locked due to failures
- `key_deleted` - YubiKey deletion
- `system_reset` - Complete data wipe
- `reauth_required` - Re-authentication prompt
- `reauth_success` - Successful re-authentication

## Localhost Testing

Since WebAuthn requires HTTPS, localhost testing uses a simulation mode:

### Simulated Authentication
- Shows "HTTPS required" message
- 2-second delay to simulate YubiKey interaction
- Creates test session with simulated admin key
- All security features work except actual YubiKey validation

## Production Configuration

### Security Headers
```apache
Header always set X-Frame-Options "SAMEORIGIN"
Header always set X-Content-Type-Options "nosniff"
Header always set X-XSS-Protection "1; mode=block"
Header always set Content-Security-Policy "default-src 'self'"
```

### Admin Access Logging
```apache
# Log all admin panel access
<FilesMatch "admin\.html$">
    CustomLog logs/goldeneye_admin_access.log combined
</FilesMatch>
```

## Usage Instructions

### For System Owner
1. **First-Time Setup**:
   - Visit `https://yourdomain.com/goldeneye/admin/`
   - Insert admin YubiKey when prompted
   - Touch key to authenticate
   - Admin panel becomes available

2. **Daily Usage**:
   - Sessions last 30 minutes
   - Logout button in top-right corner
   - Re-authentication required for dangerous operations

### Emergency Access
If locked out:
- Wait 15 minutes for lockout to expire
- Ensure you're using correct admin YubiKey
- Check browser console for errors
- Verify HTTPS is working properly

## Advanced Configuration

### Timeout Settings
```javascript
const ADMIN_CONFIG = {
    sessionTimeout: 1800000,    // 30 minutes (adjustable)
    requireReauth: 600000,      // 10 minutes (adjustable)
    maxRetries: 3,              // Failed attempts (adjustable)
    lockoutTime: 900000         // 15 minutes (adjustable)
};
```

## Important Security Notes

### Admin Key Management
- Only enroll trusted admin keys
- Store admin key separately from inheritance keys
- Consider having a backup admin key
- Document admin key location securely

### Session Security
- Always logout when finished
- Don't leave admin panel open on shared computers
- Clear browser data if compromised
- Use private/incognito browsing for extra security

### Incident Response
If security is compromised:
1. Immediately logout from all sessions
2. Clear browser localStorage
3. Consider system reset if necessary
4. Re-enroll keys with new credentials
5. Review security logs for suspicious activity