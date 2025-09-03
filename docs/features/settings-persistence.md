# Settings Persistence Implementation

## Overview
Implemented server-side storage for admin settings to resolve localStorage limitations where settings wouldn't persist across different browsers or devices.

## Problem Solved
- Previously, system name and other settings were only stored in browser localStorage
- Settings would be lost when accessing from different browser or after clearing browser data
- No way to backup or restore settings configuration

## Implementation Details

### 1. Server-Side Storage (vault-api.php)
- Added new settings storage functionality to existing vault-api.php
- Settings stored in `/goldeneye/data/settings.json`
- Endpoints:
  - `POST /vault-api.php?type=settings` with `action=save` - Saves settings
  - `GET /vault-api.php?type=settings&action=load` - Loads settings
- Settings file included in backup/restore operations

### 2. Admin Panel Updates (goldeneye-admin.js)
- `saveSettingsToServer()` - Saves settings to server via API
- `loadSettingsFromServer()` - Loads settings from server on init
- Auto-saves to server every 30 seconds
- Falls back to localStorage if server unavailable

### 3. User Interface Updates
- Main interface (`index.html`) loads system settings from server
- Admin panel saves settings automatically every 30 seconds
- Graceful fallback to localStorage cache when server unavailable
- Automatic migration of existing localStorage-only settings

## Settings Structure
```json
{
  "systemName": "Custom Vault Name",
  "autoExpire": 1800000,
  "requireTwoKeys": true,
  "allowInactive": false
}
```

## Benefits
1. Settings persist across browsers and devices
2. Settings included in system backups
3. Settings survive browser data clearing
4. Centralized configuration management
5. Offline fallback via localStorage cache

## Migration
- Existing localStorage settings automatically migrated on first load
- No user action required
- Backward compatible with existing installations