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
    cp -f "${BIN_DIR}/libLarkSyncPlugin.dylib" "${MACOS_DIR}/LarkSync"
elif [ -f "${REPO_ROOT}/apple/.build/release/libLarkSyncPlugin.dylib" ]; then
    cp -f "${REPO_ROOT}/apple/.build/release/libLarkSyncPlugin.dylib" "${MACOS_DIR}/LarkSync"
elif [ -f "${BIN_DIR}/LarkSyncPlugin" ]; then
    cp -f "${BIN_DIR}/LarkSyncPlugin" "${MACOS_DIR}/LarkSync"
fi
ln -sf "LarkSync" "${MACOS_DIR}/LarkSyncPlugin"

# Copy Rust UniFFI dylib
if [ -f "${REPO_ROOT}/target/release/liblarksync_ffi.dylib" ]; then
    cp -f "${REPO_ROOT}/target/release/liblarksync_ffi.dylib" "${FRAMEWORKS_DIR}/"
    install_name_tool -id "@rpath/liblarksync_ffi.dylib" "${FRAMEWORKS_DIR}/liblarksync_ffi.dylib" 2>/dev/null || true
fi

# Fix rpath and dylib linkage
if [ -f "${MACOS_DIR}/LarkSync" ]; then
    chmod +x "${MACOS_DIR}/LarkSync"
    OLD_FFI_PATH=$(otool -L "${MACOS_DIR}/LarkSync" | awk '{print $1}' | grep "liblarksync_ffi.dylib" || true)
    if [ -n "${OLD_FFI_PATH}" ] && [ "${OLD_FFI_PATH}" != "@rpath/liblarksync_ffi.dylib" ]; then
        install_name_tool -change "${OLD_FFI_PATH}" "@rpath/liblarksync_ffi.dylib" "${MACOS_DIR}/LarkSync" 2>/dev/null || true
    fi
    install_name_tool -add_rpath "@loader_path/../Frameworks" "${MACOS_DIR}/LarkSync" 2>/dev/null || true
    install_name_tool -add_rpath "@executable_path/../Frameworks" "${MACOS_DIR}/LarkSync" 2>/dev/null || true
    HOST_FRAMEWORKS="${TTZIP_HOST_FRAMEWORKS:-${REPO_ROOT}/../../apple/dist/TTZip.app/Contents/Frameworks}"
    if [ -d "${HOST_FRAMEWORKS}" ]; then
        install_name_tool -add_rpath "${HOST_FRAMEWORKS}" "${MACOS_DIR}/LarkSync" 2>/dev/null || true
    fi
fi

# Copy resources
if [ -d "${REPO_ROOT}/apple/Sources/TTMarkdownKit/Resources" ]; then
    cp -R "${REPO_ROOT}/apple/Sources/TTMarkdownKit/Resources/"* "${RESOURCES_DIR}/"
fi

# Generate standard plugin.json manifest
cat << 'EOF' > "${RESOURCES_DIR}/plugin.json"
{
  "id": "com.ttzip.plugin.larksync",
  "name": "飞书知识库同步",
  "version": "1.0.2",
  "minHostVersion": "1.0.0",
  "entryPoint": "LarkSync",
  "author": "Witt Kung",
  "description": "双向增量同步飞书知识库，支持 DocX 高保真 Markdown 互转、类 Typora 所见即所得编辑与一键 zstd 归档备份",
  "iconSystemName": "cloud.fill",
  "homepage": "https://github.com/wittkung/LarkSync",
  "permissions": [
    "permission.network",
    "permission.keychain",
    "permission.fs.write",
    "permission.archive"
  ]
}
EOF

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
    <string>LarkSync</string>
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
