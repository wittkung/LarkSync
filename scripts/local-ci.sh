#!/bin/bash
# ==============================================================================
# scripts/local-ci.sh
# LarkSync & TTZip local automated CI/CD quality gate pipeline (Local-First Quality Pipeline)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TTZIP_APP_DIR="${TTZIP_APP_DIR:-${REPO_ROOT}/../../apple}"

echo "======================================================================"
echo "🛡️  [Local CI/CD] Starting automated quality gate pipeline"
echo "   Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================================"

cd "${REPO_ROOT}"

# -----------------------------------------------------------------------------
# Stage 1: TypeScript Lint & Type Safety Check
# -----------------------------------------------------------------------------
echo ""
echo "🔍 [1/8] Running TypeScript / ESLint static check & type safety validation..."
npm run lint --silent
npm run typecheck --silent
echo "   ✅ TypeScript static checks passed."

# -----------------------------------------------------------------------------
# Stage 2: Rust Core Engine & Workspace Tests
# -----------------------------------------------------------------------------
echo ""
echo "🦀 [2/8] Running Rust core microkernel unit and integration test suite..."
cargo test --manifest-path "${REPO_ROOT}/Cargo.toml" --quiet
echo "   ✅ Rust core test suite 100% passed."

# -----------------------------------------------------------------------------
# Stage 3: Mozilla UniFFI Bindings Drift & Concurrency Check
# -----------------------------------------------------------------------------
echo ""
echo "⚡ [3/8] Verifying Mozilla UniFFI Swift bindings consistency..."
"${SCRIPT_DIR}/generate-bindings.sh" > /dev/null
git diff --exit-code apple/Sources/LarkSyncCore apple/Sources/larksync_ffiFFI || {
    echo "❌ [Error] UniFFI Swift bindings drifted, please commit or reset generated artifacts!"
    exit 1
}
echo "   ✅ UniFFI Swift bindings synchronized with Swift 6 strict concurrency."

# -----------------------------------------------------------------------------
# Stage 4: Swift 6 Strict Concurrency & Native Test Suite
# -----------------------------------------------------------------------------
echo ""
echo "🦅 [4/8] Running Swift 6 strict concurrency test suite (TTZipPluginKit & UI Tests)..."
swift test --quiet
echo "   ✅ Swift test suite 100% passed."

# -----------------------------------------------------------------------------
# Stage 5: VS Code Extension Compile & Webview Bundle Verification
# -----------------------------------------------------------------------------
echo ""
echo "📦 [5/8] Compiling VS Code extension and Webview dashboard bundle..."
npm run compile --silent
echo "   ✅ VS Code extension compile & Webview build passed."

# -----------------------------------------------------------------------------
# Stage 6: SSOT Release Packaging & Crypto Verification
# -----------------------------------------------------------------------------
echo ""
echo "🔑 [6/8] Executing SSOT cryptographic integrity and Ed25519 signature checks..."
CI_VERSION="$(python3 -c "import json; print(json.load(open('${REPO_ROOT}/package.json'))['version'])")"
"${SCRIPT_DIR}/dev-release.sh" verify "${CI_VERSION}"
echo "   ✅ SSOT assets and hash consistency verified."

# -----------------------------------------------------------------------------
# Stage 7: Live Network E2E Gate
# -----------------------------------------------------------------------------
echo ""
echo "🌐 [7/8] Probing remote distribution assets and cryptographic integrity..."
"${SCRIPT_DIR}/verify-distribution-e2e.sh"
echo "   ✅ Distribution E2E verification passed."

# -----------------------------------------------------------------------------
# Stage 8: Mach-O Linkage & Dyld Cleanliness Gate
# -----------------------------------------------------------------------------
echo ""
echo "🔬 [8/8] Inspecting Mach-O linkage and dyld startup security..."
if [ -d "${TTZIP_APP_DIR}/dist/TTZip.app" ]; then
    "${SCRIPT_DIR}/verify_bundle_linkage.sh" "${TTZIP_APP_DIR}/dist/TTZip.app"
    echo "   ✅ Mach-O linkage integrity 100% passed."
else
    echo "   ⚠️ ${TTZIP_APP_DIR}/dist/TTZip.app not found, skipping host Mach-O inspection."
fi

# -----------------------------------------------------------------------------
# Summary & Verdict
# -----------------------------------------------------------------------------
echo ""
echo "======================================================================"
echo "🎉 [SUCCESS] Local CI/CD quality gate 100% PASS!"
echo "======================================================================"
