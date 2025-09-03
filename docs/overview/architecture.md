# Goldeneye System Architecture

## Technical Implementation

### Two-Party Control Implementation
- **Requires both YubiKeys** for any encryption or decryption operation
- **Neither key alone** can access the stored data
- **Physical possession** of both devices is mandatory
- **WebAuthn/FIDO2** provides phishing-resistant authentication

### Cryptographic Design
1. **Key Derivation**: `SHA-256(credentialID1 + credentialID2 + salt)` 
2. **Encryption**: AES-GCM with 256-bit keys
3. **Credential Binding**: Each YubiKey generates unique, stable credential IDs
4. **Salt-based Protection**: Unique salt per encryption operation prevents rainbow table attacks

## Process Workflows

### Enrollment Process
1. User inserts YubiKey 1 and authenticates via WebAuthn
2. Credential ID is extracted and stored in localStorage
3. Process repeated for YubiKey 2
4. Both credential IDs are permanently stored for key derivation

### Encryption Workflow
1. **Authentication Phase**: Both YubiKeys must authenticate (proof of possession)
2. **Key Derivation**: Combines both credential IDs with a random salt
3. **Data Encryption**: Master passphrase encrypted with AES-GCM
4. **Storage**: Encrypted data, IV, and salt stored in browser localStorage

### Decryption Workflow
1. **Authentication Phase**: Both YubiKeys must re-authenticate
2. **Key Reconstruction**: Same credential IDs + stored salt = identical encryption key
3. **Decryption**: AES-GCM decryption with reconstructed key
4. **Display**: Passphrase displayed temporarily for user

## Key Technical Decisions

### Why Credential IDs vs Authentication Signatures
- **Problem**: WebAuthn signatures include counters/challenges that change each authentication
- **Solution**: Use stable credential IDs that remain constant per YubiKey
- **Benefit**: Enables deterministic key derivation for encryption/decryption cycles

### Why localStorage vs Session Storage
- **Use Case**: Dead man's switch for inheritance scenarios
- **Requirement**: Data must persist indefinitely until accessed by inheritors
- **Security**: Acceptable risk since data is encrypted with 2PC protection

### Why Client-Side Only
- **Trust Model**: No reliance on external servers or infrastructure
- **Attack Surface**: Minimized by eliminating network components
- **Availability**: Functions independently of server uptime
- **Privacy**: Sensitive data never leaves user's device

## System Properties

### Advantages
- **True 2PC**: Cryptographically enforced two-party requirement
- **Hardware Security**: YubiKey tamper resistance
- **Offline Operation**: No network dependencies
- **Simple Deployment**: Single HTML page with embedded crypto
- **Standard Protocols**: WebAuthn/FIDO2 compatibility
- **Inheritance Ready**: Designed for estate planning scenarios

### Limitations
- **Browser Dependency**: Requires WebAuthn-capable browser
- **HTTPS Requirement**: WebAuthn mandates secure context
- **Single Domain**: Credentials bound to specific domain
- **No Key Recovery**: Lost YubiKeys = permanent data loss
- **Limited Data Size**: Designed for short passphrases, not large files

## Data Storage and Portability

All encrypted data is stored in browser `localStorage` under the current domain:
- Encrypted master passphrase
- Initialization vector (IV) for AES-GCM
- Salt for key derivation
- YubiKey credential IDs

### Backup and Recovery

The encrypted data blob is **fully portable** and can be backed up for inheritance scenarios:

1. **Export**: The localStorage data can be copied/exported to files, USB drives, or cloud storage
2. **Restore**: The blob can be restored to any compatible browser on the same domain
3. **Decrypt**: The same two YubiKeys will successfully decrypt the restored data

**Why this works**: The encrypted blob contains the original salt used for key derivation. Since YubiKey credential IDs are stable, the same keys + same salt = identical decryption key.

**Critical Requirements**:
- The blob must be restored to the **same domain** where the keys were enrolled
- Both **original YubiKeys** must be available (credential IDs are device-specific)
- The **complete localStorage data** must be preserved (partial data will fail)