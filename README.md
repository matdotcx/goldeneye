# Goldeneye: Dual YubiKey Inheritance Vault

A cryptographic inheritance vault implementing true two-party control using dual YubiKey authentication for secure password inheritance.

## Overview

Goldeneye enables secure storage of sensitive data (primarily password vault master passphrases) that can only be accessed when **both** YubiKeys are present and authenticated. This creates a cryptographically enforced "dead man's switch" perfect for inheritance scenarios where trusted parties must collaborate to access critical passwords.

## How It Works

### Core Security Model
- **True Two-Party Control**: Neither YubiKey alone can decrypt stored data
- **Physical Possession Required**: Both hardware keys must be physically present
- **WebAuthn Authentication**: Phishing-resistant FIDO2 protocol
- **Client-Side Cryptography**: No server dependencies or network transmission

### Cryptographic Architecture

```
Key Derivation: SHA-256(credentialID1 + credentialID2 + salt)
Encryption: AES-GCM-256
Authentication: WebAuthn/FIDO2 signatures
Storage: Browser localStorage (encrypted)
```

## Usage Scenarios

### Initial Setup (Key Owner)
1. Insert first YubiKey and authenticate via WebAuthn
2. Insert second YubiKey and authenticate  
3. Enter master password/passphrase to encrypt
4. Distribute one key to each trusted inheritor

### Access Recovery (Inheritors)
1. Both inheritors meet with their respective YubiKeys
2. Both keys authenticate via WebAuthn (proof of possession)
3. System reconstructs encryption key from credential IDs
4. Master passphrase is decrypted and displayed
5. Use passphrase to access password vault

## Technical Implementation

### Why These Design Choices?

**Credential IDs vs Authentication Signatures**
- WebAuthn signatures include counters/challenges that change each use
- Credential IDs remain stable, enabling deterministic key derivation
- Allows reliable encryption/decryption cycles

**localStorage vs Session Storage**
- Inheritance scenarios require indefinite data persistence
- Data remains available until inheritors access it
- Acceptable security risk since data requires both keys to decrypt

**Client-Side Only Architecture**
- No reliance on external servers or infrastructure
- Minimized attack surface by eliminating network components
- Functions independently of server uptime
- Sensitive data never leaves user's device

### Security Features

**Cryptographic Security**
- Mathematical requirement for both keys
- Non-repudiation through WebAuthn signatures
- Forward secrecy via unique salts per encryption
- Authenticated encryption prevents tampering

**Physical Security**
- Hardware security modules (YubiKeys) provide tamper resistance
- Offline operation eliminates network attack vectors
- Inheritance model distributes keys to separate parties

## Security Analysis

### Protected Against
- Single key compromise
- Malware/XSS attacks (data encrypted until both keys present)
- Server compromise (no server dependency)
- Phishing (WebAuthn provides resistance)
- Man-in-the-middle (local-only operation)

### Potential Attack Vectors
- Physical theft of both keys (mitigated by key distribution)
- Malicious JavaScript during decryption display
- Browser/OS level compromise during authentication
- Social engineering of both inheritors simultaneously

### Known Limitations
- Browser storage accessible to domain JavaScript
- Client-side crypto vulnerable to browser/OS compromise
- No hardware attestation of authentic YubiKey devices
- Decrypted data visible in DOM during display
- No key recovery mechanism for lost YubiKeys

## Requirements

- WebAuthn-capable browser (Chrome, Firefox, Safari, Edge)
- HTTPS context (required for WebAuthn)
- Two YubiKey devices (or compatible FIDO2 hardware keys)

## File Structure

```
goldeneye/
├── index.html          # Main application (self-contained)
├── README.md          # This file
└── GOLDENEYE_SYSTEM_SUMMARY.md  # Technical documentation
```

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

This portability makes Goldeneye practical for inheritance - the encrypted vault can be stored in multiple secure locations alongside instructions for inheritors.

## Deployment

Goldeneye is designed as a single, self-contained HTML file for maximum portability and security:

1. Serve `index.html` over HTTPS (required for WebAuthn)
2. No additional dependencies or server-side components needed
3. Can be hosted on any static file server

## Inheritance Best Practices

1. **Test the system** before distributing keys
2. **Create multiple backups** of the encrypted data blob
3. **Document the process** for inheritors including domain location
4. **Store backup information** about the hosting domain and recovery procedure
5. **Consider key custody** - separate trusted parties
6. **Plan for contingencies** - what if one key is lost?
7. **Verify backup integrity** by testing restore process before deployment

## Limitations

- **No key rotation**: Cannot update enrolled YubiKeys
- **Single domain binding**: Credentials tied to specific domain
- **No audit logging**: No record of access attempts
- **No backup recovery**: Lost YubiKeys = permanent data loss
- **Limited data size**: Optimized for passphrases, not large files

## Security Notice

This system implements cryptographically sound two-party control but should be thoroughly evaluated for your specific threat model. Consider professional security review for high-value inheritance scenarios.

## License

This project is provided as-is for educational and personal use. Review and understand the security implications before using for critical data.