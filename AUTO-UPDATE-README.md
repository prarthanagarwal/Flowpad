# Flowpad Auto-Update System

This document explains how the auto-update system works in Flowpad and provides instructions for building and publishing releases.

## Overview

Flowpad uses a hybrid build system:
- **Windows**: Built with electron-forge (Squirrel.Windows)
- **macOS**: Built with electron-builder

The auto-update system uses `electron-updater` to check for and apply updates from GitHub releases.

## Auto-Update Files

For the auto-update system to work, the following files must be included in each GitHub release:

### Windows
- `Flowpad-Setup-x.y.z.exe` - The installer
- `latest.yml` - Contains metadata about the release (version, file hash, etc.)

### macOS
- `Flowpad-x.y.z-mac.dmg` - The installer
- `latest-mac.yml` - Contains metadata about the release

## Build and Publish Process

### Windows Build

```bash
# Build Windows installer with auto-update metadata
npm run make-win-with-metadata

# The following files will be generated:
# - out/make/squirrel.windows/x64/Flowpad-Setup-x.y.z.exe
# - out/make/squirrel.windows/x64/latest.yml
```

### macOS Build

```bash
# Build macOS DMG with auto-update metadata
npm run build-mac-with-metadata

# The following files will be generated:
# - out/Flowpad-x.y.z-mac.dmg
# - out/latest-mac.yml
```

### Publishing to GitHub

1. Create a new GitHub release with tag `vX.Y.Z` (must match the version in package.json)
2. Upload the following files:
   - `Flowpad-Setup-x.y.z.exe`
   - `latest.yml`
   - `Flowpad-x.y.z-mac.dmg` (if building for macOS)
   - `latest-mac.yml` (if building for macOS)

## How Auto-Update Works

1. When the app starts, it calls `autoUpdater.checkForUpdatesAndNotify()`
2. The updater looks for update metadata at:
   - Windows: `https://github.com/PrarthanAgarwal/Flowpad/releases/download/vX.Y.Z/latest.yml`
   - macOS: `https://github.com/PrarthanAgarwal/Flowpad/releases/download/vX.Y.Z/latest-mac.yml`
3. If an update is found, the user is notified and can download and install it

## Troubleshooting

If auto-updates aren't working:

1. Verify the app's version in package.json matches the GitHub release tag (without the 'v' prefix)
2. Check that the latest.yml and latest-mac.yml files are correctly uploaded to the GitHub release
3. Ensure the app has internet access and can reach GitHub
4. Check the app logs for any auto-update related errors
5. Verify that the app-update.yml file is correctly embedded in the app resources

## Manual Testing

You can manually trigger an update check from the app:

1. Open the developer tools (Ctrl+Shift+I)
2. Run: `window.electronAPI.checkForUpdates()`

## Notes for Developers

- The auto-update system relies on correct versioning. Always increment the version in package.json before building a new release.
- The update metadata files (latest.yml and latest-mac.yml) are automatically generated during the build process.
- The app-update.yml file is embedded in the app resources to tell the auto-updater where to look for updates. 