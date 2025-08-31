# Goldeneye: Dual YubiKey Inheritance Vault

A cryptographic inheritance vault implementing true two-party control using dual YubiKey authentication for secure password inheritance.

## Overview

Goldeneye enables secure storage of sensitive data (primarily password vault master passphrases) that can only be accessed when **both** YubiKeys are present and authenticated. This creates a cryptographically enforced "dead man's switch" perfect for inheritance scenarios where trusted parties must collaborate to access critical passwords.

## Core Security Model
- **True Two-Party Control**: Neither YubiKey alone can decrypt stored data
- **Physical Possession Required**: Both hardware keys must be physically present
- **WebAuthn Authentication**: Phishing-resistant FIDO2 protocol
- **Client-Side Cryptography**: No server dependencies or network transmission

## Cryptographic Architecture

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

## File Structure

```
goldeneye/
├── index.html          # Main application (self-contained)
├── admin.html          # Admin panel for multi-key management
├── backup-api.php      # Server-side backup API
└── docs/               # Documentation (this directory)
    ├── overview/       # System overview and usage
    ├── deployment/     # Installation and configuration
    ├── security/       # Security analysis and limitations
    └── development/    # Testing and development
```

## Quick Start

1. Serve `index.html` over HTTPS (required for WebAuthn)
2. No additional dependencies or server-side components needed
3. Can be hosted on any static file server

For detailed setup instructions, see [Deployment Guide](../deployment/deployment.md).

## Security Notice

This system implements cryptographically sound two-party control but should be thoroughly evaluated for your specific threat model. Consider professional security review for high-value inheritance scenarios.

## License

This project is provided as-is for educational and personal use. Review and understand the security implications before using for critical data.