# Goldeneye: Dual YubiKey Two-Party Control Inheritance Vault

## System Overview

Goldeneye is a cryptographic inheritance vault that implements true two-party control (2PC) using dual YubiKey authentication. It enables secure storage of sensitive data (primarily password vault master passphrases) that can only be accessed when both YubiKeys are present and authenticated.

## Core Security Architecture

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

## Technical Implementation

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

## Inheritance Scenario

### Setup Phase (Owner)
1. Owner enrolls two YubiKeys in Goldeneye
2. Owner encrypts master password vault passphrase
3. Owner distributes one YubiKey to each trusted inheritor
4. Inheritors store keys separately for true two-party control

### Access Phase (Inheritors)
1. Both inheritors bring their YubiKeys together
2. Both keys authenticate via WebAuthn (proof of possession)
3. System reconstructs encryption key from both credential IDs
4. Master passphrase is decrypted and displayed
5. Inheritors use passphrase to access password vault

## Security Analysis

### Threat Model Protection
- ✅ **Single Key Compromise**: Cannot access data with only one key
- ✅ **Malware/XSS**: Encrypted data useless without both physical keys
- ✅ **Server Compromise**: No server dependency
- ✅ **Phishing**: WebAuthn provides phishing resistance
- ✅ **Man-in-the-Middle**: Local-only operation eliminates network attacks

### Attack Vectors
- ⚠️ **Physical Key Theft**: Attacker needs both keys (mitigated by distribution)
- ⚠️ **Malicious JavaScript**: Could potentially steal decrypted data during display
- ⚠️ **Browser Compromise**: Root access could extract keys during authentication
- ⚠️ **Social Engineering**: Tricking both inheritors simultaneously

### Security Limitations
- **Browser Storage**: localStorage accessible to domain JavaScript
- **Client-Side Crypto**: Vulnerable to browser/OS level compromise
- **No Hardware Attestation**: Cannot verify authentic YubiKey hardware
- **Display Security**: Decrypted data visible in DOM during use

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

## Implementation Notes

### Critical Design Elements
- **Credential ID Stability**: Core to reproducible key derivation
- **Salt Storage**: Must be preserved with encrypted data
- **Error Handling**: Generic messages prevent information leakage
- **Authentication Flow**: Proof of possession before key derivation

### Future Considerations
- **Key Rotation**: No mechanism for updating enrolled keys
- **Audit Logging**: No record of access attempts
- **Multi-Device**: Cannot enroll same logical key across devices
- **Backup Strategy**: No recovery mechanism for lost keys

## Conclusion

Goldeneye implements a cryptographically sound two-party control system suitable for inheritance scenarios. The combination of YubiKey hardware security, WebAuthn authentication, and proper cryptographic key derivation creates a robust vault for sensitive data. While not suitable for all use cases, it effectively addresses the specific requirement of dead man's switch password inheritance with strong security guarantees.