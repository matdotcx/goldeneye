# Goldeneye Backup Directory

This directory stores encrypted vault backups uploaded via the admin panel.

## Security Notes

- All backup files contain encrypted data that requires YubiKeys to decrypt
- Direct access to this directory is blocked via .htaccess
- Backups are automatically cleaned up after 365 days
- Access is logged for security monitoring

## File Structure

- `BACKUP_ID.json` - Encrypted backup data
- `BACKUP_ID.meta.json` - Backup metadata (upload time, access logs, etc.)

## Backup ID Format

Backup IDs follow the pattern: `YYYYMMDD_HHMMSS_RANDOMHEX`

Example: `20250831_143022_a1b2c3d4e5f6g7h8`

## Access Control

Only the backup API script (backup-api.php) should access these files directly.
All user access must go through the API endpoints.