# Goldeneye Cryptographic Limitation - N-choose-2 Implementation

## Current Implementation Status

**Important Note**: The current Goldeneye implementation has a cryptographic limitation that prevents true N-choose-2 functionality.

## The Problem

### Current Behavior
- When you encrypt data, it uses two specific keys (e.g., Key A + Key B) to derive the encryption key
- The encrypted data can ONLY be decrypted by those same two keys (Key A + Key B)
- Other key combinations (Key A + Key C, Key B + Key C) will NOT work

### Expected N-choose-2 Behavior
- Any two of the enrolled keys should be able to decrypt the data
- If you have keys A, B, C, D - any pair should work: AB, AC, AD, BC, BD, CD

## Why This Happens

The current system uses **deterministic key derivation**:
```
Encryption Key = SHA-256(CredentialID_A + CredentialID_B + Salt)
```

Since this is deterministic:
- Keys A+B always produce the same derived key
- Keys A+C produce a completely different derived key
- Different derived key = cannot decrypt the data

## Workaround Solutions

### Option 1: Multiple Encrypted Copies (Current)
Store multiple encrypted copies of the same data, one for each possible key pair:
- Copy 1: Encrypted with Key A + Key B
- Copy 2: Encrypted with Key A + Key C  
- Copy 3: Encrypted with Key B + Key C
- etc.

**Pros**: Simple implementation, works with current crypto
**Cons**: Storage grows quadratically (N² copies for N keys)

### Option 2: Shamir's Secret Sharing (Future)
Implement proper threshold cryptography:
- Split the master key into N shares
- Any 2 shares can reconstruct the master key
- Use master key to encrypt/decrypt data

**Pros**: True N-choose-2, constant storage
**Cons**: More complex implementation

### Option 3: Key Wrapping (Future)
- Generate random data encryption key (DEK)
- Encrypt DEK with each possible key pair
- Store encrypted data once + multiple wrapped DEKs

**Pros**: Better storage efficiency than Option 1
**Cons**: Still stores multiple key wrappings

## Current System Behavior

### For Admin Users
- When you "Encrypt & Store", it picks the first two enrolled keys
- Creates vault accessible by ALL possible key pairs (metadata only)
- But cryptographically, only the original two keys work

### For Inheritors
- They can select any two keys in the interface
- System will try to decrypt with those keys
- Will fail if not the original encryption pair
- May show confusing "cannot decrypt" errors

## Recommendations

### For Current Use
1. **Enroll exactly 2 keys** for true 2-party control
2. **Test decryption** with both keys before distributing
3. **Document which keys** were used for encryption
4. **Create backups** in case of key loss

### For Production Deployment
1. **Clearly document the limitation** to users
2. **Consider implementing Shamir's Secret Sharing**
3. **Add warning messages** when enrolling more than 2 keys
4. **Test thoroughly** with actual YubiKeys in inheritance scenarios

## Technical Implementation Notes

To implement true N-choose-2 with current architecture:

```javascript
// Would need to encrypt data for ALL possible pairs
const activeKeys = getActiveKeys();
const keyPairs = generateAllPairs(activeKeys);

for (const [keyA, keyB] of keyPairs) {
    const encKey = deriveKey(keyA, keyB, salt);
    const encryptedCopy = encrypt(data, encKey);
    storeVault(`${keyA.id}_${keyB.id}`, encryptedCopy);
}
```

This works but creates storage overhead and complexity.

## Conclusion

The current implementation provides excellent security for **2-key scenarios** but does not deliver true N-choose-2 functionality. For inheritance scenarios with more than 2 keys, consider:

1. Using multiple 2-key vaults with different key pairs
2. Implementing proper threshold cryptography (future enhancement)
3. Clearly documenting which key pairs can access each vault

The security model remains sound - the limitation is in flexibility, not security.