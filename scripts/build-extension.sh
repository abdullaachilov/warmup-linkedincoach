#!/usr/bin/env bash
set -euo pipefail

# Build the extension by copying source and injecting secrets.
# Usage: HMAC_SECRET=xxx ./scripts/build-extension.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$ROOT_DIR/extension/src"
BUILD_DIR="$ROOT_DIR/extension-build"

if [ -z "${HMAC_SECRET:-}" ]; then
  # Try reading from backend/.env
  if [ -f "$ROOT_DIR/backend/.env" ]; then
    HMAC_SECRET=$(grep '^HMAC_SHARED_SECRET=' "$ROOT_DIR/backend/.env" | cut -d= -f2)
  fi
fi

if [ -z "${HMAC_SECRET:-}" ]; then
  echo "ERROR: HMAC_SECRET env var is required (or set HMAC_SHARED_SECRET in backend/.env)"
  exit 1
fi

# Clean and copy
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy manifest and icons from extension root
cp "$ROOT_DIR/extension/manifest.json" "$BUILD_DIR/"
if [ -d "$ROOT_DIR/extension/icons" ]; then
  cp -r "$ROOT_DIR/extension/icons" "$BUILD_DIR/"
fi

# Copy source files
cp -r "$SRC_DIR/background" "$BUILD_DIR/"
cp -r "$SRC_DIR/content" "$BUILD_DIR/"
cp -r "$SRC_DIR/shared" "$BUILD_DIR/"
cp -r "$SRC_DIR/sidepanel" "$BUILD_DIR/"

# Inject HMAC secret
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s|__HMAC_SECRET__|${HMAC_SECRET}|g" "$BUILD_DIR/shared/constants.js"
else
  sed -i "s|__HMAC_SECRET__|${HMAC_SECRET}|g" "$BUILD_DIR/shared/constants.js"
fi

# Verify injection worked
if grep -q '__HMAC_SECRET__' "$BUILD_DIR/shared/constants.js"; then
  echo "ERROR: HMAC_SECRET injection failed"
  exit 1
fi

echo "Extension built successfully in $BUILD_DIR"
