#!/bin/bash
# ==============================================================================
# scripts/install-git-hooks.sh
# 安装本地 CI/CD 门禁到 Git Hooks (pre-push & pre-commit)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOOKS_DIR="${REPO_ROOT}/.git/hooks"

mkdir -p "${HOOKS_DIR}"

# 1. 写入 pre-push hook (拦截一切未通过本地 CI 的 push)
cat << 'HOOK_EOF' > "${HOOKS_DIR}/pre-push"
#!/bin/bash
set -euo pipefail

echo "🛡️  [Git Hook] 正在触发 pre-push 本地 CI/CD 质量门禁..."
"$(git rev-parse --show-toplevel)/scripts/local-ci.sh"
HOOK_EOF
chmod +x "${HOOKS_DIR}/pre-push"

echo "✅ Git pre-push Hook 安装成功: ${HOOKS_DIR}/pre-push"
