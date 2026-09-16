#!/bin/bash
# SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
#
# LarkSync 独立插件构建与分发打包脚本 (.ttplugin Bundle)

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
echo "📦 构建 LarkSync 独立插件包 (LarkSync.ttplugin)"
echo "======================================================================"

cd "${REPO_ROOT}"

# 1. 编译 Rust 核心与生成 UniFFI 绑定
"${SCRIPT_DIR}/generate-bindings.sh"

# 2. 使用 SPM 编译 LarkSyncPlugin
echo "🔨 [2/4] 编译 LarkSyncPlugin 动态库与资源..."
swift build -c release --product LarkSyncPlugin

BIN_DIR="$(swift build -c release --show-bin-path)"
DIST_DIR="${REPO_ROOT}/dist"
BUNDLE_DIR="${DIST_DIR}/LarkSync.ttplugin"
CONTENTS_DIR="${BUNDLE_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
FRAMEWORKS_DIR="${CONTENTS_DIR}/Frameworks"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

# 3. 组装 .ttplugin Bundle 目录拓扑
echo "📦 [3/4] 组装 .ttplugin 标准目录拓扑..."
rm -rf "${BUNDLE_DIR}"
mkdir -p "${MACOS_DIR}" "${FRAMEWORKS_DIR}" "${RESOURCES_DIR}"

# 拷贝二进制
if [ -f "${BIN_DIR}/libLarkSyncPlugin.dylib" ]; then
    cp -f "${BIN_DIR}/libLarkSyncPlugin.dylib" "${MACOS_DIR}/LarkSyncPlugin"
elif [ -f "${REPO_ROOT}/apple/.build/release/libLarkSyncPlugin.dylib" ]; then
    cp -f "${REPO_ROOT}/apple/.build/release/libLarkSyncPlugin.dylib" "${MACOS_DIR}/LarkSyncPlugin"
elif [ -f "${BIN_DIR}/LarkSyncPlugin" ]; then
    cp -f "${BIN_DIR}/LarkSyncPlugin" "${MACOS_DIR}/LarkSyncPlugin"
fi

# 拷贝 Rust 底层 UniFFI 库
if [ -f "${REPO_ROOT}/target/release/liblarksync_ffi.dylib" ]; then
    cp -f "${REPO_ROOT}/target/release/liblarksync_ffi.dylib" "${FRAMEWORKS_DIR}/"
fi

# 修复 rpath
if [ -f "${MACOS_DIR}/LarkSyncPlugin" ]; then
    chmod +x "${MACOS_DIR}/LarkSyncPlugin"
    install_name_tool -add_rpath "@loader_path/../Frameworks" "${MACOS_DIR}/LarkSyncPlugin" 2>/dev/null || true
fi

# 拷贝资源
if [ -d "${REPO_ROOT}/apple/Sources/TTMarkdownKit/Resources" ]; then
    cp -R "${REPO_ROOT}/apple/Sources/TTMarkdownKit/Resources/"* "${RESOURCES_DIR}/"
fi

# 生成标准 Info.plist
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
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>BNDL</string>
    <key>NSPrincipalClass</key>
    <string>LarkSyncPlugin.LarkSyncPlugin</string>
</dict>
</plist>
EOF

# 代码签名
codesign --force --sign "-" --deep "${BUNDLE_DIR}" 2>/dev/null || true

echo "======================================================================"
echo "✅ 插件包构建成功: ${BUNDLE_DIR}"
echo "======================================================================"

# 4. 可选自动安装
if [ "${INSTALL_TO_USER}" = true ]; then
    USER_PLUGINS_DIR="${HOME}/Library/Application Support/TTZip/Plugins"
    mkdir -p "${USER_PLUGINS_DIR}"
    rm -rf "${USER_PLUGINS_DIR}/LarkSync.ttplugin"
    cp -R "${BUNDLE_DIR}" "${USER_PLUGINS_DIR}/"
    echo "🚀 已成功安装至用户插件目录: ${USER_PLUGINS_DIR}/LarkSync.ttplugin"
fi

if [ "${INSTALL_TO_APP}" = true ]; then
    APP_PLUGINS_DIR="${REPO_ROOT}/../products/ttzip/apple/dist/TTZip.app/Contents/PlugIns"
    mkdir -p "${APP_PLUGINS_DIR}"
    rm -rf "${APP_PLUGINS_DIR}/LarkSync.ttplugin"
    cp -R "${BUNDLE_DIR}" "${APP_PLUGINS_DIR}/"
    echo "🚀 已成功安装至 TTZip.app 内置插件目录: ${APP_PLUGINS_DIR}/LarkSync.ttplugin"
fi
