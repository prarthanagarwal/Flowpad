#!/bin/bash

# Quick Build Script - Automated version without manual confirmations
# Use this for CI/CD or when you want to run the entire process automatically

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APPLE_ID="prarthanagarwal007@gmail.com"
APPLE_APP_SPECIFIC_PASSWORD="frex-ddtp-rpxf-elev"
APPLE_TEAM_ID="NYTQ72PV9X"
CSC_LINK="certificates/don.p12"
CSC_KEY_PASSWORD="don10"
DEVELOPER_ID="Developer ID Application: Prarthan Agarwal (NYTQ72PV9X)"

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Get version from package.json
get_version() {
    if command -v node >/dev/null 2>&1; then
        node -p "require('./package.json').version"
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import json; print(json.load(open('package.json'))['version'])"
    else
        print_error "Neither Node.js nor Python3 found"
        exit 1
    fi
}

# Get architecture
get_architecture() {
    arch=$(uname -m)
    [[ "$arch" == "arm64" ]] && echo "arm64" || echo "x64"
}

# Main execution
main() {
    print_status "Starting Quick Build and Notarization Process"
    
    VERSION=$(get_version)
    ARCH=$(get_architecture)
    DMG_PATH="out/make/flowpad-${VERSION}-${ARCH}.dmg"
    
    print_status "Version: $VERSION, Architecture: $ARCH"
    print_status "DMG Path: $DMG_PATH"
    
    # Set environment variables
    export APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID CSC_LINK CSC_KEY_PASSWORD
    
    # Build
    print_status "Building application..."
    npm run build:mac
    
    # Sign DMG
    print_status "Signing DMG..."
    codesign --sign "$DEVELOPER_ID" --options runtime --timestamp "$DMG_PATH"
    
    # Submit for notarization
    print_status "Submitting for notarization..."
    submission_output=$(xcrun notarytool submit "$DMG_PATH" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" 2>&1)
    
    submission_id=$(echo "$submission_output" | grep -o '[a-f0-9-]\{36\}' | head -1)
    print_status "Submission ID: $submission_id"
    
    # Wait for notarization
    print_status "Waiting for notarization (this may take several minutes)..."
    xcrun notarytool wait "$submission_id" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID"
    
    # Staple
    print_status "Stapling notarization..."
    xcrun stapler staple "$DMG_PATH"
    
    # Verify
    print_status "Verifying final result..."
    hdiutil attach "$DMG_PATH"
    spctl --assess --type exec "/Volumes/flowpad/flowpad.app" || true
    hdiutil detach "/Volumes/Flowpad"
    
    print_success "Process completed successfully!"
    print_status "Final DMG: $DMG_PATH"
}

main "$@"
