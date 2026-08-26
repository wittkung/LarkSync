#!/bin/bash
# SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
#
# LarkSync Mozilla UniFFI Swift 绑定全自动生成与同步脚本

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "🔨 [1/4] 编译 larksync-ffi 动态库..."
cargo build -p larksync-ffi
cargo build -p larksync-ffi --release

DYLIB_PATH="${REPO_ROOT}/target/debug/liblarksync_ffi.dylib"
OUT_DIR="${REPO_ROOT}/apple/Sources/LarkSyncCore"
INCLUDE_DIR="${REPO_ROOT}/apple/Sources/larksync_ffiFFI/include"

mkdir -p "${OUT_DIR}"
mkdir -p "${INCLUDE_DIR}"

echo "⚡ [2/4] 使用 uniffi-bindgen 从 proc-macro 提炼 Swift 绑定..."
cargo run -p larksync-ffi --bin uniffi-bindgen generate \
    --library "${DYLIB_PATH}" \
    --language swift \
    --out-dir "${OUT_DIR}"

SWIFT_FFI="${OUT_DIR}/larksync_ffi.swift"

echo "🔧 [3/4] 注入 Swift 6 严格并发支持 (nonisolated(unsafe) & @unchecked Sendable)..."
sed -i '' 's/private class UniffiHandleMap<T>/private final class UniffiHandleMap<T>: @unchecked Sendable/g' "${SWIFT_FFI}"
sed -i '' 's/static var vtable: UniffiVTableCallbackInterfaceSyncProgressCallback/nonisolated(unsafe) static var vtable: UniffiVTableCallbackInterfaceSyncProgressCallback/g' "${SWIFT_FFI}"
sed -i '' 's/fileprivate static var handleMap =/nonisolated(unsafe) fileprivate static var handleMap =/g' "${SWIFT_FFI}"
sed -i '' 's/private var initializationResult:/nonisolated(unsafe) private var initializationResult:/g' "${SWIFT_FFI}"

# 注入 Sendable 一致性
cat << 'EOF' >> "${SWIFT_FFI}"

// MARK: - Swift 6 Concurrency Extensions
extension LarkSyncEngine: @unchecked Sendable {}
extension LarkAuthConfig: Sendable {}
extension WikiSpaceItem: Sendable {}
extension WikiNodeItem: Sendable {}
extension SyncProgressEventDto: Sendable {}
EOF

echo "📦 [4/4] 同步 C 头文件与 modulemap 到 larksync_ffiFFI 模块..."
if [ -f "${OUT_DIR}/larksync_ffiFFI.h" ]; then
    cp -f "${OUT_DIR}/larksync_ffiFFI.h" "${INCLUDE_DIR}/"
fi
if [ -f "${OUT_DIR}/larksync_ffiFFI.modulemap" ]; then
    cp -f "${OUT_DIR}/larksync_ffiFFI.modulemap" "${INCLUDE_DIR}/module.modulemap"
fi

echo "✅ [Done] Mozilla UniFFI Swift 绑定与 Swift 6 严格并发支持生成完成: ${OUT_DIR}"
