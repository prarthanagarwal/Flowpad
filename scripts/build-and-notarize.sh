#!/usr/bin/env bash
set -e

# DMG maker's native helpers require Node 24; use the project's Volta pin.
REQUIRED_NODE=$(node -p "require('./package.json').volta.node")
if [ "$(node -p 'process.versions.node.split(".")[0]')" != "${REQUIRED_NODE%%.*}" ]; then
  if command -v volta >/dev/null 2>&1; then
    echo "Switching release build to Node ${REQUIRED_NODE}..."
    exec volta run --node "$REQUIRED_NODE" bash "$0" "$@"
  fi
  echo "This release build requires Node ${REQUIRED_NODE}. Activate Node 24 and retry."
  exit 1
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Starting macOS Build & Notarization Process ===${NC}\n"

# Load local, gitignored KEY=value credentials without evaluating the file as shell.
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    case "$line" in ''|[[:space:]]*|\#*)
      case "$line" in *=*) ;; *) continue ;; esac
      ;;
    esac
    case "$line" in export\ *) line=${line#export } ;; esac
    case "$line" in *=*) ;; *) continue ;; esac
    key=${line%%=*}
    value=${line#*=}
    key=$(printf '%s' "$key" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
    case "$value" in
      \"*\") value=${value#\"}; value=${value%\"} ;;
      \'*\') value=${value#\'}; value=${value%\'} ;;
    esac
    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      export "$key=$value"
    fi
  done < .env
fi

# 1. Validate signing credentials before starting a long build.
: "${APPLE_ID:?Set APPLE_ID in your environment}"
: "${APPLE_APP_SPECIFIC_PASSWORD:?Set APPLE_APP_SPECIFIC_PASSWORD in your environment}"
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID in your environment}"
: "${CSC_KEY_PASSWORD:?Set CSC_KEY_PASSWORD in your environment}"
export CSC_LINK="${CSC_LINK:-certificates/don.p12}"

if [ ! -f "$CSC_LINK" ]; then
  echo -e "${RED}Error: signing certificate not found at ${CSC_LINK}${NC}"
  exit 1
fi

SIGNING_IDENTITY="Developer ID Application: Prarthan Agarwal (${APPLE_TEAM_ID})"
KEYCHAIN_DIR=$(mktemp -d "$HOME/Library/Keychains/flowpad-release.XXXXXX")
KEYCHAIN_PATH="$KEYCHAIN_DIR/release.keychain-db"
KEYCHAIN_PASSWORD=$(openssl rand -hex 32)
MOUNT_DIR=""
MOUNTED=false

cleanup() {
  STATUS=$?
  if [ "$MOUNTED" = true ]; then
    echo -e "${BLUE}Unmounting DMG volume...${NC}"
    hdiutil detach "$MOUNT_DIR" -quiet || true
  fi
  security delete-keychain "$KEYCHAIN_PATH" >/dev/null 2>&1 || true
  rm -rf "$KEYCHAIN_DIR"
  return "$STATUS"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 3600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security import "$CSC_LINK" -k "$KEYCHAIN_PATH" -P "$CSC_KEY_PASSWORD" \
  -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s \
  -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" >/dev/null
if ! security find-identity -v -p codesigning "$KEYCHAIN_PATH" | grep -F "$APPLE_TEAM_ID" >/dev/null; then
  echo -e "${RED}Error: no valid Developer ID certificate was found in the signing keychain.${NC}"
  exit 1
fi
export CSC_NAME="$SIGNING_IDENTITY"
export FLOWPAD_SIGNING_KEYCHAIN="$KEYCHAIN_PATH"

# Electron's release host can be very slow on some connections. @electron/get
# supports ELECTRON_MIRROR for downloading the same versioned release archive.
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"

# 2. Extract version dynamically from package.json
VERSION=$(node -p "require('./package.json').version")
DMG_PATH="out/make/dmg/arm64/flowpad-${VERSION}-arm64.dmg"

echo -e "Target Version : ${GREEN}${VERSION}${NC}"
echo -e "Target DMG     : ${GREEN}${DMG_PATH}${NC}"
echo -e "Signing ID     : ${GREEN}${SIGNING_IDENTITY}${NC}\n"

# 3. Build macOS package
echo -e "${BLUE}Step 1: Building macOS app via Electron Forge...${NC}"
npm run build:mac
codesign --verify --deep --strict "out/flowpad-darwin-arm64/flowpad.app"

if [ ! -f "$DMG_PATH" ]; then
  echo -e "${RED}Error: DMG file not found at ${DMG_PATH}${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Build completed successfully.${NC}\n"

# 4. Sign DMG file
echo -e "${BLUE}Step 2: Signing DMG file...${NC}"
codesign --sign "$SIGNING_IDENTITY" \
  --keychain "$KEYCHAIN_PATH" \
  --options runtime \
  --timestamp \
  "$DMG_PATH"
echo -e "${GREEN}✓ DMG signed successfully.${NC}\n"

# 5. Notarize app using notarytool --wait (automatically submits and polls until complete)
echo -e "${BLUE}Step 3: Submitting to Apple Notary Service & waiting for completion...${NC}"
xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
echo -e "${GREEN}✓ Notarization accepted by Apple.${NC}\n"

# 6. Staple notarization ticket
echo -e "${BLUE}Step 4: Stapling Notarization ticket to DMG...${NC}"
xcrun stapler staple "$DMG_PATH"
echo -e "${GREEN}✓ Ticket stapled successfully.${NC}\n"

# 7. Verification step
echo -e "${BLUE}Step 5: Verifying notarized DMG & App bundle...${NC}"

# Mount this artifact at a private temporary path, independent of volume names.
MOUNT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/flowpad-verify.XXXXXX")

hdiutil attach "$DMG_PATH" -readonly -nobrowse -noautoopen -mountpoint "$MOUNT_DIR" -quiet
MOUNTED=true

echo -e "Assessing ${MOUNT_DIR}/flowpad.app..."
spctl --assess --type exec "$MOUNT_DIR/flowpad.app"

echo -e "Assessing DMG file directly..."
spctl --assess -vv "$DMG_PATH" || true

echo -e "\n${GREEN}=== ALL STEPS COMPLETED SUCCESSFULLY! ===${NC}"
echo -e "Artifact ready for distribution: ${GREEN}${DMG_PATH}${NC}"
