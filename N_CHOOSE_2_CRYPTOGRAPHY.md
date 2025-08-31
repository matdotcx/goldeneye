# N-Choose-2 Cryptography in Goldeneye: Technical Analysis

## Current System Limitation

### What We Promised vs What We Delivered
- **Promise**: "Any two enrolled keys can decrypt data" (N-choose-2 security)
- **Reality**: "Only the specific two keys used for encryption can decrypt data" (fixed pair)

### The Core Problem
The current system uses **deterministic key derivation**:
```javascript
encryptionKey = SHA-256(KeyA_CredentialID + KeyB_CredentialID + Salt)
```

This creates a **unique encryption key for each key pair combination**:
- Keys A+B → `Key_12345abcdef...`
- Keys A+C → `Key_67890ghijkl...` (completely different!)
- Keys B+C → `Key_mnopq987654...` (also different!)

Since each pair produces a different encryption key, data encrypted with one pair cannot be decrypted with another.

## Real-World Impact Examples

### Scenario 1: Two-Key Inheritance (✅ Works Perfectly)
```
Setup:
- Diego's Key (Owner)
- Spouse's Key (Inheritor)

Encryption: Uses Diego + Spouse keys
Decryption: Requires Diego + Spouse keys
Result: True two-party control ✅
```

### Scenario 2: Multi-Key Family (❌ Limited Functionality)
```
Setup:
- Key A: Diego (Owner)
- Key B: Spouse
- Key C: Child 1  
- Key D: Child 2

Encryption: System picks A + B (Diego + Spouse)
Decryption Attempts:
- A + B (Diego + Spouse) → ✅ Works
- B + C (Spouse + Child1) → ❌ Fails
- C + D (Child1 + Child2) → ❌ Fails
- A + D (Diego + Child2) → ❌ Fails

Problem: Children cannot access inheritance without Diego!
```

### Scenario 3: Corporate Key Management (❌ Major Issue)
```
Setup:
- 10 executive keys for critical system access
- Expectation: Any 2 executives can access in emergency

Reality: Only the specific 2 keys used for encryption work
Impact: 90% of executive combinations fail to unlock system
```

## Mathematical Foundation

### Current System (Fixed Pair)
```
For n keys: Only 1 working combination out of C(n,2) possible pairs

2 keys: 1/1 = 100% success rate ✅
3 keys: 1/3 = 33% success rate ❌  
4 keys: 1/6 = 17% success rate ❌
10 keys: 1/45 = 2% success rate ❌❌❌
```

### True N-Choose-2 Goal
```
For n keys: All C(n,2) combinations should work

2 keys: 1/1 = 100% success rate ✅
3 keys: 3/3 = 100% success rate ✅
4 keys: 6/6 = 100% success rate ✅  
10 keys: 45/45 = 100% success rate ✅
```

---

# Solution 1: Multiple Encrypted Copies

## How It Works
Create separate encrypted copies for every possible key pair combination.

### Implementation Strategy
```javascript
// Step 1: Generate all possible key pairs
function generateAllKeyPairs(keys) {
    const pairs = [];
    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            pairs.push([keys[i], keys[j]]);
        }
    }
    return pairs;
}

// Step 2: Encrypt data with each pair  
async function encryptForAllPairs(data, activeKeys) {
    const keyPairs = generateAllKeyPairs(activeKeys);
    const vaults = new Map();
    
    for (const [keyA, keyB] of keyPairs) {
        const salt = generateSalt();
        const encKey = await deriveKey(keyA, keyB, salt);
        const encryptedData = await encrypt(data, encKey);
        
        vaults.set(`${keyA.id}_${keyB.id}`, {
            encryptedData,
            salt,
            keyPair: [keyA.id, keyB.id]
        });
    }
    
    return vaults;
}

// Step 3: Decrypt with any valid pair
async function decryptWithAnyPair(keyA, keyB, vaults) {
    const vaultKey = `${keyA.id}_${keyB.id}` || `${keyB.id}_${keyA.id}`;
    const vault = vaults.get(vaultKey);
    
    if (!vault) throw new Error('No vault found for this key pair');
    
    const encKey = await deriveKey(keyA, keyB, vault.salt);
    return await decrypt(vault.encryptedData, encKey);
}
```

### Storage Requirements
```
Number of vaults = C(n,2) = n(n-1)/2

2 keys → 1 vault   (1x storage)
3 keys → 3 vaults  (3x storage)  
4 keys → 6 vaults  (6x storage)
5 keys → 10 vaults (10x storage)
10 keys → 45 vaults (45x storage!)
```

### Data Structure Example
```javascript
// For 4 keys: A, B, C, D
const multiVaultSystem = {
    vaults: {
        "A_B": { encryptedData: "...", salt: "...", keyPair: ["A", "B"] },
        "A_C": { encryptedData: "...", salt: "...", keyPair: ["A", "C"] },
        "A_D": { encryptedData: "...", salt: "...", keyPair: ["A", "D"] },
        "B_C": { encryptedData: "...", salt: "...", keyPair: ["B", "C"] },
        "B_D": { encryptedData: "...", salt: "...", keyPair: ["B", "D"] },
        "C_D": { encryptedData: "...", salt: "...", keyPair: ["C", "D"] }
    },
    metadata: {
        totalKeys: 4,
        totalVaults: 6,
        createdAt: "2025-08-31T...",
        dataHash: "sha256:..." // Verify all vaults contain same data
    }
}
```

### Advantages
- ✅ **Simple Implementation**: Uses existing cryptographic primitives
- ✅ **No New Dependencies**: Standard AES + SHA-256
- ✅ **Independent Security**: Each vault is separately secure
- ✅ **Backward Compatible**: Can coexist with current system
- ✅ **Easy to Understand**: Straightforward concept
- ✅ **Easy to Debug**: Each vault can be tested independently

### Disadvantages  
- ❌ **Storage Explosion**: Quadratic growth in storage requirements
- ❌ **Sync Complexity**: Must keep all vaults synchronized
- ❌ **Performance Cost**: Multiple encryption/decryption operations
- ❌ **Backup Size**: Backup files become much larger
- ❌ **Network Transfer**: More data to upload/download

---

# Solution 2: Shamir's Secret Sharing

## Mathematical Foundation
Uses polynomial interpolation to split secrets into shares where any threshold number of shares can reconstruct the original.

### Polynomial Mathematics
```
For threshold t and n total shares:
1. Create polynomial of degree (t-1): f(x) = secret + a₁x + a₂x² + ... + aₜ₋₁x^(t-1)
2. Generate n points: Share_i = (i, f(i)) for i = 1,2,...,n
3. Any t points uniquely determine the polynomial
4. Reconstruct secret = f(0) using Lagrange interpolation
```

### Example: 2-of-4 Secret Sharing
```javascript
// Step 1: Original secret
secret = 42  // Our master key (simplified)

// Step 2: Create polynomial f(x) = 42 + 17x (degree 1 for threshold 2)
// Coefficients: secret=42, a₁=17 (random)

// Step 3: Generate shares
Share_A = f(1) = 42 + 17(1) = 59  → Point (1, 59)
Share_B = f(2) = 42 + 17(2) = 76  → Point (2, 76)  
Share_C = f(3) = 42 + 17(3) = 93  → Point (3, 93)
Share_D = f(4) = 42 + 17(4) = 110 → Point (4, 110)

// Step 4: Reconstruct with ANY 2 shares
// Using shares A & C: Points (1,59) and (3,93)
// Line equation: y = mx + b
// Slope: m = (93-59)/(3-1) = 34/2 = 17
// Y-intercept: b = 59 - 17(1) = 42 ← Original secret!

// Works with ANY 2 shares: A&B, A&D, B&C, etc.
```

### Implementation Strategy
```javascript
// Galois Field arithmetic for cryptographic security
class ShamirSecretSharing {
    // Split secret into n shares, threshold t
    static splitSecret(secret, n, t) {
        const shares = [];
        const coefficients = [secret];
        
        // Generate random coefficients for polynomial
        for (let i = 1; i < t; i++) {
            coefficients.push(randomFieldElement());
        }
        
        // Evaluate polynomial at n points
        for (let i = 1; i <= n; i++) {
            const share = evaluatePolynomial(coefficients, i);
            shares.push({ x: i, y: share });
        }
        
        return shares;
    }
    
    // Reconstruct secret from t shares
    static reconstructSecret(shares) {
        if (shares.length < threshold) {
            throw new Error('Insufficient shares');
        }
        
        // Use Lagrange interpolation to find f(0)
        return lagrangeInterpolation(shares, 0);
    }
}

// Goldeneye integration
async function createShamirVault(data, keys, threshold = 2) {
    // Generate random master key
    const masterKey = generateRandomKey();
    
    // Encrypt data with master key
    const encryptedData = await encrypt(data, masterKey);
    
    // Split master key into shares
    const shares = ShamirSecretSharing.splitSecret(
        masterKey, 
        keys.length, 
        threshold
    );
    
    // Distribute shares to keys
    const keyShares = new Map();
    keys.forEach((key, index) => {
        keyShares.set(key.id, shares[index]);
    });
    
    return {
        encryptedData,
        keyShares,
        threshold,
        totalKeys: keys.length
    };
}
```

### Data Structure Example
```javascript
// Shamir-based vault for 4 keys with 2-of-4 threshold
const shamirVault = {
    encryptedData: "AES_encrypted_blob_here...", // Single encrypted copy
    threshold: 2,
    totalKeys: 4,
    keyShares: {
        "KeyA": { x: 1, y: "GF_element_59..." },   // Mathematical share
        "KeyB": { x: 2, y: "GF_element_76..." },   
        "KeyC": { x: 3, y: "GF_element_93..." },   
        "KeyD": { x: 4, y: "GF_element_110..." }
    },
    metadata: {
        createdAt: "2025-08-31T...",
        algorithm: "Shamir-SSS-GF(2^256)",
        polynomial_degree: 1
    }
}
```

### Storage Efficiency
```
Shamir's Secret Sharing storage = 1 encrypted blob + n shares

For 1KB data with 10 keys:
- Multiple Copies: 45KB (45 encrypted copies)  
- Shamir's: ~1.3KB (1 encrypted blob + 10 tiny shares)

Savings: ~97% less storage!
```

### Advantages
- ✅ **Perfect Threshold Security**: Mathematically proven
- ✅ **Storage Efficient**: Linear growth, not quadratic
- ✅ **Information Theoretic Security**: <threshold shares reveal nothing
- ✅ **Industry Standard**: Used in enterprise key management
- ✅ **Scales Excellently**: Works with 100+ keys
- ✅ **No Redundancy**: Single encrypted copy

### Disadvantages
- ❌ **Implementation Complexity**: Requires Galois Field arithmetic
- ❌ **New Dependencies**: Must implement/audit crypto library
- ❌ **Larger Attack Surface**: More complex code = more bugs
- ❌ **Share Management**: Must securely handle mathematical shares
- ❌ **Recovery Complexity**: Polynomial reconstruction vs simple decryption

---

# Comparison Matrix

| Aspect | Current System | Multiple Copies | Shamir's Secret Sharing |
|--------|----------------|-----------------|-------------------------|
| **True N-Choose-2** | ❌ No | ✅ Yes | ✅ Yes |
| **Storage (4 keys)** | 1x | 6x | 1.1x |
| **Storage (10 keys)** | 1x | 45x | 1.3x |
| **Implementation** | ✅ Simple | ⚠️ Medium | ❌ Complex |
| **New Dependencies** | ✅ None | ✅ None | ❌ Crypto library |
| **Performance** | ✅ Fast | ⚠️ Slower | ✅ Fast |
| **Security Proof** | ✅ Standard | ✅ Standard | ✅ Mathematical |
| **Backup Size** | ✅ Small | ❌ Large | ✅ Small |
| **Debugging** | ✅ Easy | ⚠️ Medium | ❌ Hard |
| **Enterprise Scale** | ❌ No | ❌ Impractical | ✅ Perfect |

---

# Recommendations by Use Case

## Immediate Fix (Current Users)
**Solution**: Document the limitation clearly
- Add warning when enrolling >2 keys
- Explain which key pair will work
- Provide testing interface to verify access

## Small Scale Inheritance (2-4 keys)
**Recommendation**: Multiple Copies approach
- Storage overhead acceptable (6x for 4 keys)
- Simple implementation with current codebase
- Easy to understand and debug
- Backward compatible

## Enterprise/Large Scale (5+ keys)  
**Recommendation**: Shamir's Secret Sharing
- Storage efficiency crucial at scale
- Mathematical security guarantees
- Industry standard approach
- Worth the implementation complexity

## Migration Strategy
```
Phase 1: Document current limitation
Phase 2: Implement Multiple Copies (for 2-4 keys)
Phase 3: Add Shamir's SSS (for 5+ keys)
Phase 4: Migrate existing vaults (optional)
```

---

# Implementation Priority

## High Priority (Should Implement)
1. **Clear limitation documentation** in UI
2. **Warning messages** for >2 keys enrollment
3. **Multiple Copies** for 2-4 key scenarios

## Medium Priority (Future Enhancement)
1. **Shamir's Secret Sharing** implementation
2. **Migration tooling** for existing vaults
3. **Performance optimizations**

## Low Priority (Nice to Have)
1. **Hybrid approach** (Multiple Copies for small n, Shamir for large n)
2. **Vault compression** to reduce storage overhead
3. **Advanced threshold schemes** (3-of-5, etc.)

---

# Security Considerations

## All Approaches Maintain
- ✅ **Two-party control requirement**
- ✅ **YubiKey hardware security**  
- ✅ **Forward secrecy** (unique salts)
- ✅ **WebAuthn phishing resistance**
- ✅ **Generic error messages**

## Specific Security Notes

### Multiple Copies
- Each vault independently secure
- Compromise of one vault doesn't affect others
- Standard AES-GCM authenticated encryption

### Shamir's Secret Sharing
- Information-theoretic security for shares
- Single point of failure in master key derivation
- Must use cryptographically secure Galois Field

## Conclusion

The **current system limitation is significant** but doesn't affect the primary 2-key inheritance use case. For production deployment:

1. **Document the limitation clearly**
2. **Implement Multiple Copies** for 3-4 key scenarios
3. **Consider Shamir's SSS** for future enterprise features

The **security remains excellent** - this is about usability and flexibility, not fundamental security flaws.