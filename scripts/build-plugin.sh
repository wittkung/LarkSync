#!/bin/bash
# SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
#
# Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
# All rights reserved.
#
# LarkSync standalone plugin build and distribution packaging script (.ttplugin Bundle)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

INSTALL_TO_APP=false
INSTALL_TO_USER=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --install-user|-u) INSTALL_TO_USER=true; shift ;;
        --install-app|-a) INSTALL_TO_APP=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "======================================================================"
echo "📦 Building LarkSync standalone plugin bundle (LarkSync.ttplugin)"
echo "======================================================================"

cd "${REPO_ROOT}"

# 1. Compile Rust core and generate UniFFI bindings
"${SCRIPT_DIR}/generate-bindings.sh"

# 2. Compile LarkSyncPlugin dynamic framework using SwiftPM
echo "🔨 [2/4] Compiling LarkSyncPlugin dynamic library and resources..."
swift build -c release --product LarkSyncPlugin

BIN_DIR="$(swift build -c release --show-bin-path)"
DIST_DIR="${REPO_ROOT}/dist"
BUNDLE_DIR="${DIST_DIR}/LarkSync.ttplugin"
CONTENTS_DIR="${BUNDLE_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
FRAMEWORKS_DIR="${CONTENTS_DIR}/Frameworks"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

# 3. Assemble .ttplugin bundle layout
echo "📦 [3/4] Assembling .ttplugin directory layout..."
rm -rf "${BUNDLE_DIR}"
mkdir -p "${MACOS_DIR}" "${FRAMEWORKS_DIR}" "${RESOURCES_DIR}"

# Copy binary
if [ -f "${BIN_DIR}/libLarkSyncPlugin.dylib" ]; then
    cp -f "${BIN_DIR}/libLarkSyncPlugin.dylib" "${MACOS_DIR}/LarkSyncPlugin"
elif [ -f "${REPO_ROOT}/apple/.build/release/libLarkSyncPlugin.dylib" ]; then
    cp -f "${REPO_ROOT}/apple/.build/release/libLarkSyncPlugin.dylib" "${MACOS_DIR}/LarkSyncPlugin"
elif [ -f "${BIN_DIR}/LarkSyncPlugin" ]; then
    cp -f "${BIN_DIR}/LarkSyncPlugin" "${MACOS_DIR}/LarkSyncPlugin"
fi

# Copy Rust UniFFI dylib
if [ -f "${REPO_ROOT}/target/release/liblarksync_ffi.dylib" ]; then
    cp -f "${REPO_ROOT}/target/release/liblarksync_ffi.dylib" "${FRAMEWORKS_DIR}/"
fi

# Fix rpath
if [ -f "${MACOS_DIR}/LarkSyncPlugin" ]; then
    chmod +x "${MACOS_DIR}/LarkSyncPlugin"
    install_name_tool -add_rpath "@loader_path/../Frameworks" "${MACOS_DIR}/LarkSyncPlugin" 2>/dev/null || true
fi

# Copy resources
if [ -d "${REPO_ROOT}/apple/Sources/TTMarkdownKit/Resources" ]; then
    cp -R "${REPO_ROOT}/apple/Sources/TTMarkdownKit/Resources/"* "${RESOURCES_DIR}/"
fi

# Generate standard Info.plist
cat << 'EOF' > "${CONTENTS_DIR}/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.ttzip.plugin.larksync</string>
    <key>CFBundleName</key>
    <string>LarkSync</string>
    <key>CFBundleDisplayName</key>
    <string>飞书知识库双向同步</string>
    <key>CFBundleExecutable</key>
    <string>LarkSyncPlugin</string>
    <key>CFBundleVersion</key>
    <string>1.0.2</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.2</string>
    <key>CFBundlePackageType</key>
    <string>BNDL</string>
    <key>NSPrincipalClass</key>
    <string>LarkSyncPlugin.LarkSyncPlugin</string>
</dict>
</plist>
EOF

# Code signing
codesign --force --sign "-" --deep "${BUNDLE_DIR}" 2>/dev/null || true

echo "======================================================================"
echo "✅ Plugin bundle build succeeded: ${BUNDLE_DIR}"
echo "======================================================================"

# 4. Optional auto-installation
if [ "${INSTALL_TO_USER}" = true ]; then
    USER_PLUGINS_DIR="${HOME}/Library/Application Support/TTZip/Plugins"
    mkdir -p "${USER_PLUGINS_DIR}"
    rm -rf "${USER_PLUGINS_DIR}/LarkSync.ttplugin"
    cp -R "${BUNDLE_DIR}" "${USER_PLUGINS_DIR}/"
    echo "🚀 Installed to user plugins directory: ${USER_PLUGINS_DIR}/LarkSync.ttplugin"
fi

if [ "${INSTALL_TO_APP}" = true ]; then
    APP_PLUGINS_DIR="${TTZIP_APP_PLUGINS_DIR:-${REPO_ROOT}/../../apple/dist/TTZip.app/Contents/PlugIns}"
    if [ -d "$(dirname "${APP_PLUGINS_DIR}")" ]; then
        mkdir -p "${APP_PLUGINS_DIR}"
        rm -rf "${APP_PLUGINS_DIR}/LarkSync.ttplugin"
        cp -R "${BUNDLE_DIR}" "${APP_PLUGINS_DIR}/"
        echo "🚀 Installed to TTZip.app bundle: ${APP_PLUGINS_DIR}/LarkSync.ttplugin"
    fi
fi
