# Goldeneye Documentation

This directory contains comprehensive documentation for the Goldeneye dual YubiKey inheritance vault system.

## Documentation Structure

### [📋 Overview](overview/)
- **[architecture.md](overview/architecture.md)** - Technical implementation details and system design
- **[features.md](overview/features.md)** - Complete feature overview and capabilities

### [🚀 Deployment](deployment/)
- **[installation.md](deployment/installation.md)** - Complete installation guide
- **[configuration.md](deployment/configuration.md)** - System configuration and settings
- **[security-hardening.md](deployment/security-hardening.md)** - Production security guidelines

### [⚙️ Features](features/)
- **[enrollment-persistence.md](features/enrollment-persistence.md)** - YubiKey enrollment system
- **[git-backup.md](features/git-backup.md)** - Git-based backup configuration
- **[settings-persistence.md](features/settings-persistence.md)** - Server-side settings storage

### [🔒 Security](security/)
- **[analysis.md](security/analysis.md)** - Comprehensive security analysis
- **[admin-panel.md](security/admin-panel.md)** - Admin panel security documentation  
- **[n-choose-2-limitation.md](security/n-choose-2-limitation.md)** - Technical analysis of cryptographic limitations

### [🧪 Development](development/)
- **[testing.md](development/testing.md)** - Testing procedures and checklists

## Quick Navigation

### Getting Started
- New to Goldeneye? Start with [System Architecture](overview/architecture.md)
- Ready to deploy? See [Installation Guide](deployment/installation.md)
- Need security details? Check [Security Analysis](security/analysis.md)

### Common Tasks
- **Initial Setup**: [Installation](deployment/installation.md) → [Configuration](deployment/configuration.md)
- **Security Review**: [Security Analysis](security/analysis.md) + [Admin Panel Security](security/admin-panel.md)
- **Feature Setup**: [Enrollment Persistence](features/enrollment-persistence.md) + [Git Backup](features/git-backup.md)
- **Testing System**: [Testing Guide](development/testing.md)
- **Understanding Limitations**: [N-Choose-2 Analysis](security/n-choose-2-limitation.md)

## Documentation Status

This documentation has been reorganized from the original scattered markdown files for better organization and reduced redundancy. The content has been:

- ✓ **Consolidated** - Removed duplicate information across files
- ✓ **Categorized** - Organized by purpose (overview, deployment, security, development)
- ✓ **Cross-referenced** - Added navigation links between related topics
- ✓ **Updated** - Reflects current system capabilities and limitations

## Contributing to Documentation

When updating documentation:
1. Keep each section focused on its specific purpose
2. Cross-reference related information rather than duplicating
3. Update the navigation links when adding new files
4. Test all documentation links periodically