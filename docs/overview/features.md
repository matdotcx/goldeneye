# Goldeneye Feature Overview

A comprehensive list of Goldeneye's capabilities for secure inheritance and cryptographic vault management.

## Core Features

### Dual YubiKey Authentication
- **True Two-Party Control**: Neither YubiKey alone can decrypt stored data
- **Physical Possession Required**: Both hardware keys must be physically present
- **WebAuthn Authentication**: Phishing-resistant FIDO2 protocol
- **Stable Credential IDs**: Deterministic key derivation for encryption/decryption

### Cryptographic Security
- **AES-GCM-256 Encryption**: Industry-standard authenticated encryption
- **SHA-256 Key Derivation**: Combines credential IDs with unique salts
- **Forward Secrecy**: Unique salt per encryption prevents replay attacks
- **Client-Side Only**: No server dependencies for decryption

### Data Management
- **Portable Backups**: Encrypted data blob can be exported/imported
- **Domain Binding**: Credentials tied to specific domain for security
- **Browser Storage**: localStorage for inheritance scenarios requiring persistence
- **Data Integrity**: Authenticated encryption prevents tampering

## Admin Panel Features

### YubiKey Management
- **Multi-Key Enrollment**: Support for multiple YubiKeys (with limitations)
- **Key Testing**: Verify individual key functionality
- **Key Naming**: Descriptive names and descriptions for organization
- **Key Status Control**: Enable/disable keys as needed

### Access Control
- **Session Management**: 30-minute timeout with activity tracking
- **Re-authentication**: Required for sensitive operations
- **Failed Attempt Protection**: Account lockout after 3 failed attempts
- **Enhanced Delete Protection**: Multi-step confirmation for dangerous operations

### Backup System
- **Local Backups**: Download encrypted data as files
- **Server Storage**: Upload backups with unique IDs for retrieval
- **Backup Validation**: Integrity checking on import/export
- **Multiple Formats**: Support for various backup scenarios

## Server-Side Features

### Enrollment Persistence
- **Cross-Browser Sync**: YubiKey enrollments work across devices
- **Automatic Backup**: Git-based version control for enrollments
- **No Expiration**: Enrollment data persists indefinitely
- **Authentication Required**: YubiKey verification for enrollment uploads

### Settings Persistence
- **Server-Side Storage**: System settings persist across browsers
- **Auto-Sync**: Automatic synchronization every 30 seconds
- **Offline Fallback**: localStorage cache when server unavailable
- **Migration Support**: Automatic migration from localStorage-only setups

### Git Backup System
- **Version History**: Complete audit trail of all changes
- **Remote Push**: Support for GitHub, GitLab, and self-hosted repositories
- **SSH Key Management**: Generate and manage deployment keys
- **Web UI**: Admin panel interface for backup configuration

## User Interface Features

### Simple Mode (index.html)
- **Key Detection**: Automatic YubiKey recognition
- **Guided Flow**: Step-by-step authentication process
- **Auto-Hide**: Security timeout for displayed passwords
- **Session Management**: Prevents key reuse in same session

### Admin Interface (admin/index.html)
- **Tabbed Navigation**: Organized by function (Keys, Data, Backups, etc.)
- **Real-Time Status**: Live updates for operations
- **Responsive Design**: Works across desktop and mobile browsers
- **Security Headers**: Content Security Policy and security hardening

## Security Features

### Threat Protection
- **Single Key Compromise**: Data remains secure with only one key
- **Malware Resistance**: Encrypted data useless without physical keys
- **Phishing Resistance**: WebAuthn prevents credential theft
- **Offline Security**: No network attack vectors during decryption

### Access Control
- **Physical Security**: Hardware security modules (YubiKeys)
- **Domain Binding**: Credentials work only on enrollment domain
- **Session Isolation**: Independent sessions prevent cross-contamination
- **Inheritance Model**: Distributed key custody

## Technical Features

### Browser Compatibility
- **WebAuthn Support**: Chrome 67+, Firefox 60+, Safari 14+, Edge 79+
- **HTTPS Required**: Secure context mandatory for WebAuthn
- **Cross-Platform**: Works on desktop, mobile, and tablet browsers
- **Progressive Enhancement**: Graceful degradation for unsupported features

### Performance
- **Instant Access**: No network latency for decryption
- **Minimal Dependencies**: Self-contained JavaScript implementation
- **Small Footprint**: Single HTML file for user interface
- **Efficient Storage**: Compact data structure for backups

### Deployment
- **Static Hosting**: No server-side requirements for basic functionality
- **HTTPS Only**: Built-in redirects and security enforcement
- **Directory Security**: Automatic protection for sensitive directories
- **Configuration Files**: Example configurations for Apache and Nginx

## Current Limitations

### N-Choose-2 Limitation
- **Fixed Key Pairs**: Only the specific two keys used for encryption can decrypt
- **Not True N-Choose-2**: Adding more keys doesn't provide flexible access
- **Works for 2-Key**: Perfect for standard inheritance scenarios
- **Documented Workarounds**: Multiple encrypted copies or Shamir's Secret Sharing

### Technical Constraints
- **Domain Binding**: Cannot transfer credentials between domains
- **No Key Recovery**: Lost YubiKeys result in permanent data loss
- **Browser Dependency**: Requires WebAuthn-capable browser
- **Limited Data Size**: Optimized for passphrases, not large files

### Feature Gaps
- **No Audit Logging**: Limited logging of access attempts
- **No Key Rotation**: Cannot update enrolled YubiKeys
- **Single Vault**: One encrypted data store per key set
- **No Mobile App**: Browser-only interface

## Planned Enhancements

### Short Term
- **UI Improvements**: Better error messages and status indicators
- **Backup Validation**: Enhanced integrity checking
- **Mobile Optimization**: Better responsive design
- **Documentation Updates**: Comprehensive user guides

### Medium Term
- **True N-Choose-2**: Implementation using Shamir's Secret Sharing
- **Key Rotation**: Ability to update enrolled YubiKeys
- **Audit Trail**: Comprehensive logging system
- **Multi-Vault**: Support for multiple encrypted data stores

### Long Term
- **Mobile App**: Native iOS/Android applications
- **Hardware Integration**: Support for additional security keys
- **Enterprise Features**: LDAP integration, centralized management
- **Advanced Backup**: Encrypted off-site backup options

## Related Documentation

- **[Architecture](architecture.md)** - Technical implementation details
- **[Enrollment Persistence](../features/enrollment-persistence.md)** - YubiKey synchronization system
- **[Git Backup](../features/git-backup.md)** - Backup system configuration
- **[Security Analysis](../security/analysis.md)** - Comprehensive security review
- **[N-Choose-2 Limitation](../security/n-choose-2-limitation.md)** - Technical analysis of cryptographic constraints