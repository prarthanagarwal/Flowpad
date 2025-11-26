#!/bin/bash

# Flowpad Build and Notarization Automation Script
# This script automates the entire build, signing, and notarization process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APPLE_ID="prarthanagarwal007@gmail.com"
APPLE_APP_SPECIFIC_PASSWORD="frex-ddtp-rpxf-elev"
APPLE_TEAM_ID="NYTQ72PV9X"
CSC_LINK="certificates/don.p12"
CSC_KEY_PASSWORD="don10"
DEVELOPER_ID="Developer ID Application: Prarthan Agarwal (NYTQ72PV9X)"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for user confirmation
wait_for_confirmation() {
    echo -e "${YELLOW}Press Enter to continue or Ctrl+C to abort...${NC}"
    read -r
}

# Function to extract version from package.json
get_version() {
    if command_exists node; then
        node -p "require('./package.json').version"
    elif command_exists python3; then
        python3 -c "import json; print(json.load(open('package.json'))['version'])"
    else
        print_error "Neither Node.js nor Python3 found. Cannot extract version from package.json"
        exit 1
    fi
}

# Function to get architecture
get_architecture() {
    arch=$(uname -m)
    if [[ "$arch" == "arm64" ]]; then
        echo "arm64"
    elif [[ "$arch" == "x86_64" ]]; then
        echo "x64"
    else
        echo "arm64"  # Default to arm64
    fi
}

# Function to build the app
build_app() {
    print_status "Starting build process..."
    
    # Set environment variables
    export APPLE_ID="$APPLE_ID"
    export APPLE_APP_SPECIFIC_PASSWORD="$APPLE_APP_SPECIFIC_PASSWORD"
    export APPLE_TEAM_ID="$APPLE_TEAM_ID"
    export CSC_LINK="$CSC_LINK"
    export CSC_KEY_PASSWORD="$CSC_KEY_PASSWORD"
    
    # Run the build
    print_status "Running npm run build:mac..."
    npm run build:mac
    
    if [[ $? -eq 0 ]]; then
        print_success "Build completed successfully!"
    else
        print_error "Build failed!"
        exit 1
    fi
}

# Function to sign the DMG
sign_dmg() {
    local dmg_path="$1"
    
    print_status "Signing DMG file: $dmg_path"
    
    codesign --sign "$DEVELOPER_ID" \
        --options runtime \
        --timestamp \
        "$dmg_path"
    
    if [[ $? -eq 0 ]]; then
        print_success "DMG signed successfully!"
    else
        print_error "DMG signing failed!"
        exit 1
    fi
}

# Function to submit for notarization
submit_for_notarization() {
    local dmg_path="$1"
    
    print_status "Submitting DMG for notarization..."
    
    # Submit for notarization and capture the submission ID
    local submission_output
    submission_output=$(xcrun notarytool submit "$dmg_path" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" 2>&1)
    
    if [[ $? -eq 0 ]]; then
        # Extract the submission ID from the output
        local submission_id
        submission_id=$(echo "$submission_output" | grep -o '[a-f0-9-]\{36\}' | head -1)
        
        if [[ -n "$submission_id" ]]; then
            print_success "Notarization submitted successfully!"
            print_status "Submission ID: $submission_id"
            echo "$submission_id"  # Return the submission ID
        else
            print_error "Could not extract submission ID from output:"
            echo "$submission_output"
            exit 1
        fi
    else
        print_error "Notarization submission failed!"
        echo "$submission_output"
        exit 1
    fi
}

# Function to wait for notarization
wait_for_notarization() {
    local submission_id="$1"
    
    print_status "Waiting for notarization to complete..."
    print_status "This may take several minutes..."
    
    xcrun notarytool wait "$submission_id" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID"
    
    if [[ $? -eq 0 ]]; then
        print_success "Notarization completed successfully!"
    else
        print_error "Notarization failed or timed out!"
        exit 1
    fi
}

# Function to staple the notarization
staple_notarization() {
    local dmg_path="$1"
    
    print_status "Stapling notarization ticket to DMG..."
    
    xcrun stapler staple "$dmg_path"
    
    if [[ $? -eq 0 ]]; then
        print_success "Notarization stapled successfully!"
    else
        print_error "Stapling failed!"
        exit 1
    fi
}

# Function to verify the final result
verify_final_result() {
    local dmg_path="$1"
    
    print_status "Verifying the final result..."
    
    # Mount the DMG
    print_status "Mounting DMG for verification..."
    hdiutil attach "$dmg_path"
    
    # Check the app bundle
    print_status "Checking app bundle signature..."
    spctl --assess --type exec "/Volumes/Flowpad/Flowpad.app"
    
    if [[ $? -eq 0 ]]; then
        print_success "App bundle verification passed!"
    else
        print_warning "App bundle verification failed, but this might be normal for development builds"
    fi
    
    # Unmount the DMG
    print_status "Unmounting DMG..."
    hdiutil detach "/Volumes/Flowpad"
    
    print_success "Verification completed!"
}

# Main execution
main() {
    print_status "Starting Flowpad Build and Notarization Process"
    print_status "================================================"
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    
    if ! command_exists codesign; then
        print_error "codesign not found. Please install Xcode command line tools."
        exit 1
    fi
    
    if ! command_exists xcrun; then
        print_error "xcrun not found. Please install Xcode command line tools."
        exit 1
    fi
    
    if ! command_exists hdiutil; then
        print_error "hdiutil not found. This should be available on macOS."
        exit 1
    fi
    
    # Get version and architecture
    VERSION=$(get_version)
    ARCH=$(get_architecture)
    
    print_status "Detected version: $VERSION"
    print_status "Detected architecture: $ARCH"
    
    # Construct DMG path
    DMG_PATH="out/make/Flowpad-${VERSION}-${ARCH}.dmg"
    
    print_status "Expected DMG path: $DMG_PATH"
    
    # Check if DMG already exists
    if [[ -f "$DMG_PATH" ]]; then
        print_warning "DMG file already exists. Do you want to rebuild?"
        echo "1) Rebuild (recommended)"
        echo "2) Use existing DMG"
        echo "3) Exit"
        read -p "Choose option (1-3): " choice
        
        case $choice in
            1)
                print_status "Proceeding with rebuild..."
                ;;
            2)
                print_status "Using existing DMG..."
                ;;
            3)
                print_status "Exiting..."
                exit 0
                ;;
            *)
                print_error "Invalid choice. Exiting..."
                exit 1
                ;;
        esac
    fi
    
    # Step 1: Build the app
    if [[ "$choice" != "2" ]]; then
        print_status "Step 1: Building the application"
        wait_for_confirmation
        build_app
    fi
    
    # Verify DMG exists
    if [[ ! -f "$DMG_PATH" ]]; then
        print_error "DMG file not found at: $DMG_PATH"
        print_status "Available files in out/make/:"
        ls -la out/make/ 2>/dev/null || print_error "out/make/ directory not found"
        exit 1
    fi
    
    # Step 2: Sign the DMG
    print_status "Step 2: Signing the DMG"
    wait_for_confirmation
    sign_dmg "$DMG_PATH"
    
    # Step 3: Submit for notarization
    print_status "Step 3: Submitting for notarization"
    wait_for_confirmation
    SUBMISSION_ID=$(submit_for_notarization "$DMG_PATH")
    
    # Step 4: Wait for notarization
    print_status "Step 4: Waiting for notarization"
    wait_for_confirmation
    wait_for_notarization "$SUBMISSION_ID"
    
    # Step 5: Staple the notarization
    print_status "Step 5: Stapling notarization"
    wait_for_confirmation
    staple_notarization "$DMG_PATH"
    
    # Step 6: Verify the final result
    print_status "Step 6: Verifying final result"
    wait_for_confirmation
    verify_final_result "$DMG_PATH"
    
    # Final summary
    print_success "================================================"
    print_success "Build and Notarization Process Completed!"
    print_success "================================================"
    print_status "Final DMG location: $DMG_PATH"
    print_status "File size: $(du -h "$DMG_PATH" | cut -f1)"
    print_status "Ready for distribution!"
}

# Run the main function
main "$@"
