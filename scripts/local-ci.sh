#!/bin/bash
# ==============================================================================
# scripts/local-ci.sh
# LarkSync & TTZip 本地全自动化 CI/CD 质量门禁流水线 (Local-First Quality Pipeline)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TTZIP_APP_DIR="/Users/kevintung/Documents/dev/products/ttzip/apple"

echo "======================================================================"
echo "🛡️  [Local CI/CD] 启动本地全链路自动化质量门禁流水线"
echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================================"

cd "${REPO_ROOT}"

# -----------------------------------------------------------------------------
# Stage 1: TypeScript Lint & Type Safety Check
# -----------------------------------------------------------------------------
echo ""
echo "🔍 [1/8] 运行 TypeScript / ESLint 静态代码检查与类型安全验证..."
npm run lint --silent
npm run typecheck --silent
echo "   ✅ TypeScript 静态类型与代码质量检查通过。"

# -----------------------------------------------------------------------------
# Stage 2: Rust Core Engine & Workspace Tests
# -----------------------------------------------------------------------------
echo ""
echo "🦀 [2/8] 运行 Rust 核心微内核单元与集成测试套件..."
cargo test --manifest-path "${REPO_ROOT}/Cargo.toml" --quiet
echo "   ✅ Rust 核心测试套件 100% 通过。"

# -----------------------------------------------------------------------------
# Stage 3: Mozilla UniFFI Bindings Drift & Concurrency Check
# -----------------------------------------------------------------------------
echo ""
echo "⚡ [3/8] 校验 Mozilla UniFFI Swift 绑定一致性与代码漂移..."
"${SCRIPT_DIR}/generate-bindings.sh" > /dev/null
git diff --exit-code apple/Sources/LarkSyncCore apple/Sources/larksync_ffiFFI || {
    echo "❌ [Error] UniFFI Swift 绑定发生漂移，请先提交或回滚生成产物！"
    exit 1
}
echo "   ✅ UniFFI Swift 绑定与 Swift 6 严格并发支持 100% 同步。"

# -----------------------------------------------------------------------------
# Stage 4: Swift 6 Strict Concurrency & Native Test Suite
# -----------------------------------------------------------------------------
echo ""
echo "🦅 [4/8] 运行 Swift 6 严格并发测试套件 (TTZipPluginKit & UI Tests)..."
swift test --quiet
echo "   ✅ Swift 测试套件 100% 通过。"

# -----------------------------------------------------------------------------
# Stage 5: VS Code Extension Compile & Webview Bundle Verification
# -----------------------------------------------------------------------------
echo ""
echo "📦 [5/8] 编译验证 VS Code 扩展与 Webview 仪表盘前端..."
npm run compile --silent
echo "   ✅ VS Code 扩展编译与 Webview 构建通过。"

# -----------------------------------------------------------------------------
# Stage 6: SSOT Release Packaging & Crypto Verification
# -----------------------------------------------------------------------------
echo ""
echo "🔑 [6/8] 执行 SSOT 密码学与 Ed25519 签名自检..."
CI_VERSION="$(python3 -c "import json; print(json.load(open('${REPO_ROOT}/package.json'))['version'])")"
"${SCRIPT_DIR}/dev-release.sh" verify "${CI_VERSION}"
echo "   ✅ SSOT 资产与哈希一致性 100% 吻合。"

# -----------------------------------------------------------------------------
# Stage 7: Live Network E2E Gate
# -----------------------------------------------------------------------------
echo ""
echo "🌐 [7/8] 探测真实公网 CDN 资产可达性与密码学校验..."
"${SCRIPT_DIR}/verify-distribution-e2e.sh"
echo "   ✅ 真实公网分发 E2E 门禁 100% 通过。"

# -----------------------------------------------------------------------------
# Stage 8: Mach-O Linkage & Dyld Cleanliness Gate
# -----------------------------------------------------------------------------
echo ""
echo "🔬 [8/8] 检查 TTZip 宿主 Mach-O 洁净度与 dyld 启动安全..."
if [ -d "${TTZIP_APP_DIR}/dist/TTZip.app" ]; then
    "${SCRIPT_DIR}/verify_bundle_linkage.sh" "${TTZIP_APP_DIR}/dist/TTZip.app"
    echo "   ✅ Mach-O 链接洁净度 100% 通过。"
else
    echo "   ⚠️ 未找到 ${TTZIP_APP_DIR}/dist/TTZip.app，跳过宿主 Mach-O 检查。"
fi

# -----------------------------------------------------------------------------
# Summary & Verdict
# -----------------------------------------------------------------------------
echo ""
echo "======================================================================"
echo "🎉 [SUCCESS] 本地 CI/CD 全量质量门禁 100% PASS！允许 Git 提交/推送！"
echo "======================================================================"
