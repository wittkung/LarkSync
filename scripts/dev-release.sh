#!/bin/bash
# SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
#
# LarkSync 工业级 SSOT 一键原子打包、自动签名、哈希同步与自检工具链

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KEYS_DIR="${REPO_ROOT}/.keys"
DIST_DIR="${REPO_ROOT}/dist"
MARKETPLACE_JSON="${REPO_ROOT}/marketplace.json"
SWIFT_MODEL_FILE="${REPO_ROOT}/apple/Sources/TTZipPluginKit/TTZipMarketplaceModel.swift"

VERSION="${2:-1.0.0}"
COMMAND="${1:-help}"

mkdir -p "${KEYS_DIR}" "${DIST_DIR}"

case "${COMMAND}" in
    keygen)
        echo "🔑 正在生成 Ed25519 密钥对..."
        python3 - << 'PYEOF'
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
PYEOF
        ;;

    pack)
        echo "🚀 [1/5] 执行全量编译与 Bundle 组装..."
        "${SCRIPT_DIR}/generate-bindings.sh"
        swift build -c release --product LarkSyncPlugin
        "${SCRIPT_DIR}/build-plugin.sh"

        echo "📦 [2/5] 生成确定性 Zip 归档..."
        ZIP_NAME="LarkSync-v${VERSION}.ttplugin.zip"
        ZIP_PATH="${DIST_DIR}/${ZIP_NAME}"
        SIG_PATH="${ZIP_PATH}.sig"
        rm -f "${ZIP_PATH}" "${SIG_PATH}"

        ditto -c -k --sequesterRsrc --keepParent "${DIST_DIR}/LarkSync.ttplugin" "${ZIP_PATH}"

        echo "🔑 [3/5] 计算 SHA-256、文件大小并进行 Ed25519 数字签名与 SSOT 原子回填..."
        PRIV_KEY_FILE="${KEYS_DIR}/plugin_ed25519.seed"
        if [ -n "${PLUGIN_SIGNING_PRIVATE_KEY_B64:-}" ]; then
            SIGNING_KEY="${PLUGIN_SIGNING_PRIVATE_KEY_B64}"
        elif [ -f "${PRIV_KEY_FILE}" ]; then
            SIGNING_KEY="$(cat "${PRIV_KEY_FILE}")"
        else
            echo "❌ [Error] 未找到有效发布私钥！请设置 PLUGIN_SIGNING_PRIVATE_KEY_B64 或生成 .keys/plugin_ed25519.seed"
            exit 1
        fi

        python3 - << PYEOF
import os, sys, json, base64, hashlib, re
from datetime import datetime, timezone
from cryptography.hazmat.primitives.asymmetric import ed25519

zip_path = "${ZIP_PATH}"
sig_path = "${SIG_PATH}"
marketplace_file = "${MARKETPLACE_JSON}"
swift_file = "${SWIFT_MODEL_FILE}"
version = "${VERSION}"
signing_key_b64 = "${SIGNING_KEY}".strip()

with open(zip_path, "rb") as f:
    zip_bytes = f.read()

file_size = len(zip_bytes)
sha256_hex = hashlib.sha256(zip_bytes).hexdigest()

seed = base64.b64decode(signing_key_b64)
priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(seed)
pub_key = priv_key.public_key()

sig_bytes = priv_key.sign(zip_bytes)
with open(sig_path, "wb") as f:
    f.write(sig_bytes)

sig_b64 = base64.b64encode(sig_bytes).decode("utf-8")
pub_b64 = base64.b64encode(pub_key.public_bytes_raw()).decode("utf-8")
now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

print(f"   ► 真实文件大小: {file_size} bytes")
print(f"   ► 真实 SHA-256 : {sha256_hex}")
print(f"   ► Ed25519 签名 : {sig_b64[:32]}...")
print(f"   ► 发布者公钥   : {pub_b64}")

if os.path.exists(marketplace_file):
    with open(marketplace_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    data["updatedAt"] = now_iso
    for p in data.get("plugins", []):
        if p.get("id") == "com.ttzip.plugin.larksync":
            p["version"] = version
            p["size"] = file_size
            p["sha256"] = sha256_hex
            p["signature"] = sig_b64
            p["publicKey"] = pub_b64
            p["publishedAt"] = now_iso
            p["downloadUrl"] = f"https://github.com/wittkung/LarkSync/releases/download/v{version}/LarkSync-v{version}.ttplugin.zip"
    
    with open(marketplace_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"   ✅ 已自动同步回填: {marketplace_file}")

if os.path.exists(swift_file):
    with open(swift_file, "r", encoding="utf-8") as f:
        swift_content = f.read()
    
    swift_content = re.sub(r'size:\s*\d+', f'size: {file_size}', swift_content)
    swift_content = re.sub(r'sha256:\s*"[a-fA-F0-9]+"', f'sha256: "{sha256_hex}"', swift_content)
    swift_content = re.sub(r'signature:\s*"[^"]+"', f'signature: "{sig_b64}"', swift_content)
    swift_content = re.sub(r'publicKey:\s*"[^"]+"', f'publicKey: "{pub_b64}"', swift_content)
    swift_content = re.sub(r'version:\s*"[^"]+"', f'version: "{version}"', swift_content)
    swift_content = re.sub(r'downloadUrl:\s*"[^"]+"', f'downloadUrl: "https://github.com/wittkung/LarkSync/releases/download/v{version}/LarkSync-v{version}.ttplugin.zip"', swift_content)
    swift_content = re.sub(r'publishedAt:\s*"[^"]+"', f'publishedAt: "{now_iso}"', swift_content)

    with open(swift_file, "w", encoding="utf-8") as f:
        f.write(swift_content)
    print(f"   ✅ 已自动同步回填: {swift_file}")
PYEOF

        echo "🔍 [4/5] 执行闭环一致性与密码学校验 (Verification Gate)..."
        "${SCRIPT_DIR}/dev-release.sh" verify "${VERSION}"

        echo "🧪 [5/5] 运行 Swift 单元测试套件验证端到端安全门禁..."
        swift test --filter TTZipPluginSecurityTests

        echo "======================================================================"
        echo "🎉 SSOT 一键原子发版与同步完成！所有资产、索引与 Swift 状态均 100% 吻合。"
        echo "======================================================================"
        ;;

    verify)
        VERSION="${2:-1.0.0}"
        ZIP_PATH="${REPO_ROOT}/dist/LarkSync-v${VERSION}.ttplugin.zip"
        SIG_PATH="${ZIP_PATH}.sig"
        PUB_FILE="${KEYS_DIR}/plugin_ed25519.pub"
        
        echo "🔍 正在进行物理 Zip 与 Ed25519 签名自检..."
        python3 - << PYEOF
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
    print("✅ Ed25519 签名验证 100% 通过！")
except Exception as e:
    print(f"❌ 签名验证失败: {e}")
    sys.exit(1)
PYEOF
        ;;

    *)
        echo "用法: $0 {keygen|pack <version>|verify <version>}"
        exit 1
        ;;
esac
