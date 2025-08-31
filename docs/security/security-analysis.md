# Goldeneye Security Analysis

## Security Features

### Cryptographic Security
- **True 2PC**: Mathematical requirement for both keys
- **Non-repudiation**: WebAuthn signatures prove key possession
- **Forward Secrecy**: Each encryption uses unique salt
- **Authenticated Encryption**: AES-GCM prevents tampering

### Physical Security
- **Hardware Security Keys**: YubiKeys provide tamper-resistant storage
- **Offline Operation**: No network dependencies for decryption
- **Local Storage**: Data never transmitted to external servers
- **Inheritance Model**: Keys distributed to separate trusted parties

### Implementation Security
- **Generic Error Messages**: Prevents information disclosure attacks
- **Stable Key Material**: Uses credential IDs, not variable authentication signatures
- **Browser Security**: Leverages Web Crypto API for cryptographic operations
- **Domain Binding**: WebAuthn credentials tied to specific domain

## Threat Model Protection

### Protected Against
- ✓ **Single Key Compromise**: Neither YubiKey alone can decrypt stored data
- ✓ **Malware/XSS**: Encrypted data useless without both physical keys
- ✓ **Server Compromise**: No server dependency
- ✓ **Phishing**: WebAuthn provides phishing resistance
- ✓ **Man-in-the-Middle**: Local-only operation eliminates network attacks

### Attack Vectors
- ⚠ **Physical Key Theft**: Attacker needs both keys (mitigated by distribution)
- ⚠ **Malicious JavaScript**: Could potentially steal decrypted data during display
- ⚠ **Browser Compromise**: Root access could extract keys during authentication
- ⚠ **Social Engineering**: Tricking both inheritors simultaneously

## Security Limitations

### Browser Storage
- localStorage accessible to domain JavaScript
- Data remains available until inheritors access it
- Acceptable security risk since data requires both keys to decrypt

### Client-Side Cryptography
- Vulnerable to browser/OS level compromise
- No hardware attestation of authentic YubiKey devices
- Decrypted data visible in DOM during display

### Domain Binding
- Credentials tied to specific domain where enrolled
- Cannot transfer keys between domains
- Backup and restore must occur on same domain

## Admin Panel Security

### Access Control
- **YubiKey Required**: Admin access requires enrolled admin key
- **Session Management**: 30-minute session timeout with activity tracking
- **Failed Attempt Protection**: Account lockout after 3 failed attempts
- **HTTPS Enforcement**: WebAuthn requires secure connection

### Sensitive Operations Protection
These operations require YubiKey re-authentication:
- Key deletion
- System reset
- Backup operations
- Admin settings changes

### Enhanced Delete Protection
- Re-authentication required
- Multi-step confirmation dialogs
- Exact text verification ("DELETE", "RESET EVERYTHING")
- Security logging with timestamps

## N-Choose-2 Cryptographic Limitation

### Current System Limitation
- Data encrypted with specific key pair can only be decrypted by same pair
- Adding more than 2 keys doesn't provide true N-choose-2 functionality
- Only the specific two keys used for encryption will work

### Impact
- **2-Key Scenarios**: Works perfectly (100% success rate)
- **3+ Key Scenarios**: Only 1 out of C(n,2) combinations work
- **Example**: With 4 keys, only 1 of 6 possible pairs can decrypt

For detailed technical analysis, see [N-Choose-2 Cryptography](n-choose-2-analysis.md).

## Security Best Practices

### For System Owners
- Test the system before distributing keys
- Create multiple backups of encrypted data
- Store backup information securely
- Consider key custody arrangements
- Plan for contingencies (key loss scenarios)

### For Inheritors
- Store YubiKeys separately for true two-party control
- Test keys periodically to ensure functionality
- Understand the decryption process
- Keep backup information secure

### For Administrators
- Always logout when finished with admin panel
- Don't leave admin panel open on shared computers
- Use private/incognito browsing for extra security
- Clear browser data if security is compromised

## Incident Response

If security is compromised:
1. Immediately logout from all sessions
2. Clear browser localStorage
3. Consider system reset if necessary
4. Re-enroll keys with new credentials
5. Review security logs for suspicious activity

## Security Notice

This system implements cryptographically sound two-party control but should be thoroughly evaluated for your specific threat model. The system is designed to be secure by default while maintaining usability for inheritance scenarios.

Consider professional security review for high-value inheritance scenarios.