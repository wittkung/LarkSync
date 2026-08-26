#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# verify_bundle_linkage.sh: TTZip & Plugin Mach-O 动态链接与 dyld 启动安全门禁

set -euo pipefail

APP_PATH="${1:-}"

if [ -z "${APP_PATH}" ] || [ ! -d "${APP_PATH}" ]; then
    echo "❌ 错误: 请指定有效的 .app 路径 (例如: ./dist/TTZip.app)"
    exit 1
fi

echo "======================================================================"
echo "🛡️  开始执行 Mach-O 与 dyld 运行时依赖门禁审计"
echo "   目标 App: ${APP_PATH}"
echo "======================================================================"

MACOS_DIR="${APP_PATH}/Contents/MacOS"
FRAMEWORKS_DIR="${APP_PATH}/Contents/Frameworks"
PLUGINS_DIR="${APP_PATH}/Contents/PlugIns"
MAIN_BIN="$(find "${MACOS_DIR}" -maxdepth 1 -type f -perm +111 | head -n 1)"

if [ -z "${MAIN_BIN}" ]; then
    echo "❌ [FAIL] 未找到主可执行文件！"
    exit 1
fi

ERRORS=0

echo "--> [1/4] 检查宿主二进制 Mach-O 依赖洁净度..."
HOST_LOAD_DYLIBS="$(otool -L "${MAIN_BIN}" | tail -n +2 | awk '{print $1}')"

FORBIDDEN_PATTERNS=("LarkSync" "larksync_ffi")
for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    if echo "${HOST_LOAD_DYLIBS}" | grep -qi "${pattern}"; then
        echo "❌ [FAIL] 宿主二进制违规直连了插件内部业务动态库: ${pattern}"
        ERRORS=$((ERRORS + 1))
    fi
done

if [ ${ERRORS} -eq 0 ]; then
    echo "   ✅ 宿主 Mach-O 依赖绝对解耦。"
fi

echo "--> [2/4] 模拟 dyld 遍历检查主程序动态库物理存在性..."
while read -r dylib; do
    if [[ "${dylib}" == @rpath/* ]]; then
        rel_name="${dylib#@rpath/}"
        target_path="${FRAMEWORKS_DIR}/${rel_name}"
        if [ ! -e "${target_path}" ] && [ ! -d "${FRAMEWORKS_DIR}/${rel_name%%/*}.framework" ]; then
            echo "❌ [FAIL] dyld 致命缺陷: 依赖 ${dylib} 但在 ${FRAMEWORKS_DIR} 中未找到！"
            ERRORS=$((ERRORS + 1))
        else
            echo "   ✅ 已验证: ${dylib} ➔ 物理存在"
        fi
    fi
done <<< "${HOST_LOAD_DYLIBS}"

echo "--> [3/4] 检查 Frameworks 内动态库 install_name 规范性..."
if [ -d "${FRAMEWORKS_DIR}" ]; then
    find "${FRAMEWORKS_DIR}" -type f -name "*.dylib" | while read -r dylib_file; do
        id_name="$(otool -D "${dylib_file}" | tail -n +2 | head -n 1)"
        if [[ "${id_name}" != @rpath/* ]]; then
            echo "❌ [FAIL] 动态库 install_name 非相对路径: ${dylib_file} (ID: ${id_name})"
            ERRORS=$((ERRORS + 1))
        fi
    done
fi

echo "--> [4/4] 执行 codesign 深度验签..."
if ! codesign --verify --deep --strict "${APP_PATH}" 2>&1; then
    echo "❌ [FAIL] 代码签名校验失败！"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✅ 代码签名与 Hardened Runtime 完整性 100% 通过。"
fi

echo "======================================================================"
if [ ${ERRORS} -eq 0 ]; then
    echo "🎉 [PASS] 所有 dyld 运行时与 Mach-O 门禁检查 100% 通过！"
    echo "======================================================================"
    exit 0
else
    echo "🚨 [BLOCKED] 发现 ${ERRORS} 项致命 dyld 链接隐患！"
    echo "======================================================================"
    exit 1
fi
