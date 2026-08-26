#!/bin/bash
# SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
#
# LarkSync 开发者本地发版、打包、Ed25519 签名与自检工具

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KEYS_DIR="${REPO_ROOT}/.keys"

COMMAND="${1:-help}"

mkdir -p "${KEYS_DIR}"

case "${COMMAND}" in
    # --------------------------------------------------------------------------
    # 1. 生成 Ed25519 密钥对 (若不存在)
    # --------------------------------------------------------------------------
    keygen)
        echo "🔑 正在生成 Ed25519 密钥对..."
        python3 - << 'EOF'
import os, base64
from cryptography.hazmat.primitives.asymmetric import ed25519

keys_dir = os.path.expanduser(".keys")
os.makedirs(keys_dir, exist_ok=True)

priv_file = os.path.join(keys_dir, "plugin_ed25519.seed")
pub_file = os.path.join(keys_dir, "plugin_ed25519.pub")

if os.path.exists(priv_file):
    print("⚠️ 密钥已存在，跳过生成。")
else:
    priv_key = ed25519.Ed25519PrivateKey.generate()
    seed_bytes = priv_key.private_bytes_raw()
    pub_bytes = priv_key.public_key().public_bytes_raw()
    
    with open(priv_file, "w") as f:
        f.write(base64.b64encode(seed_bytes).decode("utf-8"))
    with open(pub_file, "w") as f:
        f.write(base64.b64encode(pub_bytes).decode("utf-8"))
    
    print("✅ 密钥生成完毕:")
    print(f"   Private Key Seed (Base64): {base64.b64encode(seed_bytes).decode('utf-8')}")
    print(f"   Public Key (Base64): {base64.b64encode(pub_bytes).decode('utf-8')}")
EOF
        ;;

    # --------------------------------------------------------------------------
    # 2. 本地全量构建、组装、压缩与签名
    # --------------------------------------------------------------------------
    pack)
        VERSION="${2:-1.0.0}"
        echo "📦 开始本地全量构建与打包 v${VERSION}..."
        
        # 1. 编译 UniFFI
        "${SCRIPT_DIR}/generate-bindings.sh"
        
        # 2. 编译 Swift
        swift build -c release --product LarkSyncPlugin
        
        # 3. 组装 Bundle
        "${SCRIPT_DIR}/build-plugin.sh"
        
        # 4. 打包 Zip
        DIST_DIR="${REPO_ROOT}/dist"
        ZIP_PATH="${DIST_DIR}/LarkSync-v${VERSION}.ttplugin.zip"
        SIG_PATH="${ZIP_PATH}.sig"
        
        echo "🗜️ 使用 ditto 压缩 .ttplugin Bundle..."
        ditto -c -k --sequesterRsrc --keepParent "${DIST_DIR}/LarkSync.ttplugin" "${ZIP_PATH}"
        
        # 5. 计算 SHA-256
        shasum -a 256 "${ZIP_PATH}" > "${DIST_DIR}/checksums.txt"
        
        # 6. 使用本地密钥签名
        PRIV_KEY_FILE="${KEYS_DIR}/plugin_ed25519.seed"
        if [ ! -f "${PRIV_KEY_FILE}" ]; then
            echo "⚠️ 未发现本地私钥，正在自动生成..."
            "${SCRIPT_DIR}/dev-release.sh" keygen
        fi
        
        export PLUGIN_SIGNING_PRIVATE_KEY_B64="$(cat "${PRIV_KEY_FILE}")"
        python3 - << EOF
import os, base64
from cryptography.hazmat.primitives.asymmetric import ed25519

key_b64 = os.environ["PLUGIN_SIGNING_PRIVATE_KEY_B64"].strip()
seed = base64.b64decode(key_b64)
priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(seed)

with open("${ZIP_PATH}", "rb") as f:
    data = f.read()

sig = priv_key.sign(data)
with open("${SIG_PATH}", "wb") as f:
    f.write(sig)

sig_b64 = base64.b64encode(sig).decode("utf-8")
pub_b64 = base64.b64encode(priv_key.public_key().public_bytes_raw()).decode("utf-8")

print(f"🔏 Ed25519 签名生成成功: {sig_b64[:20]}...")
print(f"🔑 Public Key: {pub_b64}")
EOF
        echo "======================================================================"
        echo "✅ 产物已就绪: ${ZIP_PATH}"
        echo "   SHA256: $(awk '{print $1}' "${DIST_DIR}/checksums.txt")"
        echo "   签名文件: ${SIG_PATH}"
        echo "======================================================================"
        ;;

    # --------------------------------------------------------------------------
    # 3. 本地自测验证器 (模拟 TTZipPluginSecurity)
    # --------------------------------------------------------------------------
    verify)
        VERSION="${2:-1.0.0}"
        ZIP_PATH="${REPO_ROOT}/dist/LarkSync-v${VERSION}.ttplugin.zip"
        SIG_PATH="${ZIP_PATH}.sig"
        PUB_FILE="${KEYS_DIR}/plugin_ed25519.pub"
        
        echo "🔍 正在进行密码学自检..."
        python3 - << EOF
import sys, base64
from cryptography.hazmat.primitives.asymmetric import ed25519

with open("${PUB_FILE}", "r") as f:
    pub_b64 = f.read().strip()

with open("${ZIP_PATH}", "rb") as f:
    data = f.read()

with open("${SIG_PATH}", "rb") as f:
    sig = f.read()

pub_bytes = base64.b64decode(pub_b64)
pub_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)

try:
    pub_key.verify(sig, data)
    print("✅ [PASS] Ed25519 签名验证 100% 通过！(与 Apple CryptoKit 行为完全一致)")
except Exception as e:
    print(f"❌ [FAIL] 签名验证失败: {e}")
    sys.exit(1)
EOF
        ;;

    *)
        echo "用法: $0 {keygen | pack <version> | verify <version>}"
        exit 1
        ;;
esac
