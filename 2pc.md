

## Key Features

**1. Two-Party Control Architecture**
- Requires both YubiKeys to decrypt data
- Each key generates unique cryptographic signatures during authentication
- Signatures are combined to derive the encryption key
- Neither key alone can decrypt the data

**2. Security Implementation**
- Uses WebAuthn/FIDO2 for phishing-resistant authentication
- AES-GCM encryption for data protection
- Unique salt per encryption operation
- Signatures from both keys create the encryption key material

**3. User Interface**
- Visual status indicators for each YubiKey
- Clear enrollment workflow
- Secure data storage and retrieval
- Auto-hide decrypted data after 30 seconds

## Deployment Instructions

### For Hetzner Server

1. **Basic HTTP Server** (quickest setup):
```bash
# Create directory
mkdir yubikey-2pc
cd yubikey-2pc

# Save the HTML file as index.html
nano index.html
# Paste the artifact content

# Run with Python (if available)
python3 -m http.server 8080

# Or with Node.js
npx http-server -p 8080
```

2. **Nginx Deployment** (production):
```bash
# Copy to web root
sudo cp index.html /var/www/html/yubikey-2pc/

# Configure Nginx
sudo nano /etc/nginx/sites-available/yubikey-2pc
```

Add this configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    root /var/www/html/yubikey-2pc;
    index index.html;
    
    # Important: WebAuthn requires HTTPS
    add_header Strict-Transport-Security "max-age=31536000";
}
```

3. **Docker Deployment**:
```dockerfile
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/
EXPOSE 80
```

```bash
docker build -t yubikey-2pc .
docker run -p 8080:80 yubikey-2pc
```

## Usage Workflow

1. **Initial Setup**:
   - Insert first YubiKey and click "Enrol YubiKey 1"
   - Touch the key when it blinks
   - Remove first key, insert second YubiKey
   - Click "Enrol YubiKey 2" and touch when it blinks

2. **Storing Data**:
   - Enter sensitive data in the text area
   - Click "Encrypt & Store"
   - Touch YubiKey 1 when prompted
   - Touch YubiKey 2 when prompted
   - Data is now encrypted with both keys

3. **Retrieving Data**:
   - Click "Authenticate & Decrypt"
   - Touch both YubiKeys when prompted
   - Decrypted data appears for 30 seconds

## Technical Details

The system implements true two-party control through:

- **Threshold Cryptography**: Both YubiKey signatures are required to reconstruct the encryption key
- **WebAuthn Signatures**: Each authentication produces a unique signature that changes every time
- **Key Derivation**: SHA-256 hash of combined signatures + salt creates the AES key
- **Local Storage**: Credentials and encrypted data stored in browser localStorage
- **No Server Required**: Fully client-side implementation

## Security Considerations

1. **HTTPS Required**: WebAuthn only works over HTTPS (or localhost for testing)
2. **Browser Storage**: Data persists in localStorage - clear it when done with sensitive data
3. **Same Origin**: Keys are bound to the domain where they're enrolled
4. **Physical Security**: Keep the two YubiKeys physically separated for true two-party control

This system provides genuine two-party control where both YubiKeys must be present and authenticated to decrypt the data, implementing the cryptographic split control you specified in your requirements.