# Goldeneye Testing Guide

## Testing Checklist

### Admin Panel Testing

#### Key Management
- [ ] **Enroll Multiple Keys**: Enroll 3-4 YubiKeys with descriptive names
- [ ] **Key Naming**: Test key naming and description editing
- [ ] **Key Status**: Test enable/disable functionality for keys
- [ ] **Key Deletion**: Test key deletion with confirmation prompts
- [ ] **Key Testing**: Use "Test" button to verify individual key authentication

#### Data Operations
- [ ] **Data Encryption**: Store sensitive data using admin panel
- [ ] **Key Selection**: Verify any two active keys can decrypt data
- [ ] **Multiple Vaults**: Test storing multiple pieces of data
- [ ] **Key Pair Validation**: Verify invalid key combinations are rejected

#### Backup System
- [ ] **Local Backup**: Create and download backup files
- [ ] **Server Upload**: Upload backup to server and receive backup ID
- [ ] **Server Download**: Restore data using backup ID
- [ ] **File Import**: Import backup from local file
- [ ] **Data Validation**: Verify backup integrity and structure

### User Interface Testing

#### Simple Mode (index.html)
- [ ] **Key Detection**: Insert any enrolled YubiKey and verify detection
- [ ] **Authentication Flow**: Test two-key authentication process
- [ ] **Data Retrieval**: Successfully unlock and display vault data
- [ ] **Auto-Hide**: Verify data auto-hides after 2 minutes
- [ ] **Key Reuse Prevention**: Verify same key cannot authenticate twice
- [ ] **Session Management**: Test session timeout and cleanup

### Security Testing

#### N-Choose-2 Verification
- [ ] **Any Two Keys**: Verify any combination of 2 enrolled keys works
- [ ] **Insufficient Keys**: Verify single key cannot access data
- [ ] **Wrong Keys**: Verify unenrolled keys are rejected
- [ ] **Key Deactivation**: Verify disabled keys cannot decrypt
- [ ] **Key Deletion**: Verify deleted keys cannot decrypt existing data

#### Data Persistence
- [ ] **Browser Refresh**: Data survives page refresh
- [ ] **Browser Restart**: Data survives browser restart
- [ ] **Different Browsers**: Same data accessible from different browsers
- [ ] **Backup Portability**: Backups work when restored on different machines

## Test Scenarios

### Scenario 1: Initial Setup
1. Access admin panel (admin/index.html)
2. Enroll first YubiKey with name "Owner Primary"
3. Enroll second YubiKey with name "Inheritor Key 1" 
4. Store test data: "MyVault123!Secret"
5. Verify both keys required for decryption

### Scenario 2: Multi-Key Inheritance
1. Enroll third YubiKey: "Inheritor Key 2"
2. Verify any two of the three keys can decrypt
3. Test all possible combinations:
   - Owner + Inheritor 1
   - Owner + Inheritor 2  
   - Inheritor 1 + Inheritor 2

### Scenario 3: Key Management
1. Disable "Owner Primary" key
2. Verify only Inheritor keys can now decrypt
3. Re-enable Owner key
4. Delete one Inheritor key
5. Verify remaining keys still work

### Scenario 4: Backup and Restore
1. Create local backup file
2. Upload backup to server (note backup ID)
3. Reset system completely
4. Restore from server using backup ID
5. Verify all keys and data restored correctly

### Scenario 5: User Interface
1. Access user interface (index.html)
2. Insert first enrolled key - verify detection
3. Insert second enrolled key - verify detection
4. Unlock vault and verify data display
5. Wait for auto-hide after 2 minutes

## Edge Cases to Test

### Error Conditions
- [ ] No keys enrolled (should show error message)
- [ ] Only one key enrolled (should require second key)
- [ ] Same key used twice (should reject)
- [ ] Network error during backup upload
- [ ] Invalid backup ID for download
- [ ] Corrupted backup file import
- [ ] WebAuthn timeout or cancellation

### Security Edge Cases  
- [ ] Key authentication with wrong credential ID
- [ ] Modified backup data (should detect corruption)
- [ ] Very large backup files (should respect size limits)
- [ ] Rapid repeated authentication attempts
- [ ] Session timeout during multi-key auth

### Browser Compatibility
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (macOS)
- [ ] Edge
- [ ] Mobile browsers (iOS Safari, Android Chrome)

## Performance Testing

- [ ] **Key Enrollment**: Should complete within 10 seconds
- [ ] **Authentication**: Should complete within 5 seconds per key  
- [ ] **Data Encryption**: Should complete within 2 seconds
- [ ] **Data Decryption**: Should complete within 2 seconds
- [ ] **Backup Creation**: Should complete within 5 seconds
- [ ] **Server Upload**: Should complete within 10 seconds

## Security Verification

### Cryptographic Validation
- [ ] **Key Derivation**: Verify same key pairs produce same derived key
- [ ] **Salt Uniqueness**: Verify each encryption uses unique salt
- [ ] **IV Uniqueness**: Verify each encryption uses unique IV
- [ ] **Credential ID Stability**: Verify YubiKey credential IDs are stable

### Access Control
- [ ] **Backup Directory**: Verify /backups/ returns 403/404 on direct access
- [ ] **API Endpoints**: Verify only valid endpoints respond
- [ ] **File Permissions**: Check backup files have restricted permissions
- [ ] **Error Messages**: Verify no sensitive information in error messages

## Production Readiness Checklist

- [ ] **HTTPS Required**: System only works over HTTPS
- [ ] **Backup Retention**: Server cleans up old backups automatically  
- [ ] **Error Logging**: Server logs errors without exposing sensitive data
- [ ] **Rate Limiting**: Consider adding rate limits to backup API
- [ ] **Monitoring**: Set up monitoring for backup directory disk usage
- [ ] **Documentation**: Admin and user guides are complete and accurate

## Known Limitations

1. **Domain Binding**: YubiKeys enrolled on one domain cannot be used on another
2. **Browser Storage**: localStorage can be cleared by user or browser settings
3. **No Key Recovery**: Lost YubiKeys cannot be recovered or replaced
4. **Single Vault**: Current implementation supports one vault per key set
5. **No Audit Trail**: No logging of key usage or access attempts in user mode

## Reporting Issues

When reporting test failures, include:
- Browser and version
- YubiKey model and firmware
- Exact error messages
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)