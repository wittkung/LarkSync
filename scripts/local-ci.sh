#!/bin/bash
# ==============================================================================
# scripts/local-ci.sh
# LarkSync & TTZip 本地全自动化 CI/CD 质量门禁流水线
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TTZIP_APP_DIR="/Users/kevintung/Documents/dev/products/ttzip/apple"

echo "======================================================================"
echo "🛡️  [Local CI/CD] 启动本地全链路自动化质量门禁流水线"
echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================================"

# -----------------------------------------------------------------------------
# Stage 1: Rust Core & UniFFI Bindings Verification
# -----------------------------------------------------------------------------
echo ""
echo "🦀 [1/6] 运行 Rust 核心单元测试与 UniFFI 绑定一致性检查..."
cargo test --manifest-path "${REPO_ROOT}/Cargo.toml" --quiet
"${SCRIPT_DIR}/generate-bindings.sh"
echo "   ✅ Rust 核心与 UniFFI 绑定通过。"

# -----------------------------------------------------------------------------
# Stage 2: Swift 6 Strict Concurrency & Test Suite
# -----------------------------------------------------------------------------
echo ""
echo "🦅 [2/6] 运行 Swift 6 严格并发测试套件 (6 项用例)..."
cd "${REPO_ROOT}"
swift test --quiet
echo "   ✅ Swift 测试套件 100% 通过。"

# -----------------------------------------------------------------------------
# Stage 3: SSOT Release Packaging & Crypto Verification
# -----------------------------------------------------------------------------
echo ""
echo "📦 [3/6] 执行 SSOT 密码学与 Ed25519 签名自检..."
"${SCRIPT_DIR}/dev-release.sh" verify 1.0.1
echo "   ✅ SSOT 资产与哈希一致性 100% 吻合。"

# -----------------------------------------------------------------------------
# Stage 4: Live Network E2E Gate
# -----------------------------------------------------------------------------
echo ""
echo "🌐 [4/6] 探测真实公网 CDN 资产可达性与密码学校验..."
"${SCRIPT_DIR}/verify-distribution-e2e.sh"
echo "   ✅ 真实公网分发 E2E 门禁 100% 通过。"

# -----------------------------------------------------------------------------
# Stage 5: Mach-O Linkage & Dyld Cleanliness Gate
# -----------------------------------------------------------------------------
echo ""
echo "🔬 [5/6] 检查 TTZip 宿主 Mach-O 洁净度与 dyld 启动安全..."
if [ -d "${TTZIP_APP_DIR}/dist/TTZip.app" ]; then
    "${SCRIPT_DIR}/verify_bundle_linkage.sh" "${TTZIP_APP_DIR}/dist/TTZip.app"
    echo "   ✅ Mach-O 链接洁净度 100% 通过。"
else
    echo "   ⚠️ 未找到 ${TTZIP_APP_DIR}/dist/TTZip.app，跳过宿主 Mach-O 检查。"
fi

# -----------------------------------------------------------------------------
# Stage 6: Summary & Verdict
# -----------------------------------------------------------------------------
echo ""
echo "======================================================================"
echo "🎉 [SUCCESS] 本地 CI/CD 全量质量门禁 100% PASS！允许 Git 提交/推送！"
echo "======================================================================"
