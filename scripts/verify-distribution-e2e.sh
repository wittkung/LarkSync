#!/bin/bash
# ==============================================================================
# scripts/verify-distribution-e2e.sh
# 生产级云端分发与真实网络连通性 E2E 门禁验证脚本
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MARKETPLACE_FILE="${REPO_ROOT}/marketplace.json"
USER_AGENT="TTZip-App/1.0.0 (macOS; CI-E2E-Gate)"

echo "🌐 [E2E Gate] 开始执行云端分发真实网络连通性与密码学校验..."

if [ ! -f "${MARKETPLACE_FILE}" ]; then
    echo "❌ [Fail] 未找到 ${MARKETPLACE_FILE}"
    exit 1
fi

PLUGINS_COUNT=$(python3 -c "import json; print(len(json.load(open('${MARKETPLACE_FILE}'))['plugins']))")
echo "📦 检测到 ${PLUGINS_COUNT} 个插件条目，开始逐一探测真实网络链路..."

for i in $(seq 0 $((PLUGINS_COUNT - 1))); do
    PLUGIN_ID=$(python3 -c "import json; print(json.load(open('${MARKETPLACE_FILE}'))['plugins'][$i]['id'])")
    VERSION=$(python3 -c "import json; print(json.load(open('${MARKETPLACE_FILE}'))['plugins'][$i]['version'])")
    DOWNLOAD_URL=$(python3 -c "import json; print(json.load(open('${MARKETPLACE_FILE}'))['plugins'][$i]['downloadUrl'])")
    EXPECTED_SHA256=$(python3 -c "import json; print(json.load(open('${MARKETPLACE_FILE}'))['plugins'][$i]['sha256'])")
    PUBLIC_KEY_B64=$(python3 -c "import json; print(json.load(open('${MARKETPLACE_FILE}'))['plugins'][$i]['publicKey'])")
    SIGNATURE_B64=$(python3 -c "import json; print(json.load(open('${MARKETPLACE_FILE}'))['plugins'][$i]['signature'])")

    echo "----------------------------------------------------------------------"
    echo "🔍 正在检验插件 [${PLUGIN_ID} v${VERSION}]..."
    echo "   URL: ${DOWNLOAD_URL}"

    HTTP_CODE=$(curl -s -L -o /dev/null -w "%{http_code}" -H "User-Agent: ${USER_AGENT}" "${DOWNLOAD_URL}")
    if [ "${HTTP_CODE}" != "200" ]; then
        echo "❌ [FAIL] 真实网络下载探测失败！HTTP Status Code: ${HTTP_CODE} (期望: 200)"
        echo "   可能原因: GitHub Release 资产未发布、Tag 不匹配、或者处于 Private/Draft 状态！"
        exit 1
    fi
    echo "   ✅ HTTP 200 OK (302 重定向跟随正常)"

    TEMP_ZIP=$(mktemp /tmp/plugin_e2e_XXXXXX.zip)
    curl -s -L -H "User-Agent: ${USER_AGENT}" "${DOWNLOAD_URL}" -o "${TEMP_ZIP}"

    ACTUAL_SHA256=$(shasum -a 256 "${TEMP_ZIP}" | awk '{print $1}')
    if [ "${ACTUAL_SHA256}" != "${EXPECTED_SHA256}" ]; then
        echo "❌ [FAIL] 云端资产 SHA-256 不一致！"
        echo "   期望值: ${EXPECTED_SHA256}"
        echo "   实际值: ${ACTUAL_SHA256}"
        rm -f "${TEMP_ZIP}"
        exit 1
    fi
    echo "   ✅ SHA-256 校验 100% 匹配: ${ACTUAL_SHA256:0:16}..."

    python3 - << PYEOF
import sys, base64
from cryptography.hazmat.primitives.asymmetric import ed25519

pub_bytes = base64.b64decode("${PUBLIC_KEY_B64}")
sig_bytes = base64.b64decode("${SIGNATURE_B64}")
pub_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)

with open("${TEMP_ZIP}", "rb") as f:
    content = f.read()

try:
    pub_key.verify(sig_bytes, content)
    print("   ✅ Ed25519 签名验证 100% 通过！")
except Exception as e:
    print(f"❌ [FAIL] 云端资产 Ed25519 签名校验失败: {e}")
    sys.exit(1)
PYEOF
    rm -f "${TEMP_ZIP}"
done

echo "======================================================================"
echo "🎉 [PASS] 全球云端分发与真实网络 E2E 门禁全部通过！资产就绪度 100%！"
echo "======================================================================"
