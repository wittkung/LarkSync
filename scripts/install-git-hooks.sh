#!/bin/bash
# ==============================================================================
# scripts/install-git-hooks.sh
# 安装本地 CI/CD 门禁到 Git Hooks (Husky pre-commit / pre-push & .git/hooks)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOOKS_DIR="${REPO_ROOT}/.git/hooks"
HUSKY_DIR="${REPO_ROOT}/.husky"

mkdir -p "${HOOKS_DIR}" "${HUSKY_DIR}"

# 1. 确保 Husky 脚本具有执行权限
chmod +x "${HUSKY_DIR}/pre-commit" 2>/dev/null || true
if [ -f "${HUSKY_DIR}/pre-push" ]; then
    chmod +x "${HUSKY_DIR}/pre-push"
fi

# 2. 写入 .git/hooks/pre-push (双重防线：无论是否通过 Husky 均强制拦截未通过本地 CI 的 push)
cat << 'HOOK_EOF' > "${HOOKS_DIR}/pre-push"
#!/bin/bash
set -euo pipefail

echo "🛡️  [Git Hook] 正在触发 pre-push 本地 CI/CD 质量门禁..."
"$(git rev-parse --show-toplevel)/scripts/local-ci.sh"
HOOK_EOF
chmod +x "${HOOKS_DIR}/pre-push"

echo "✅ Git pre-push Hook 安装成功: ${HOOKS_DIR}/pre-push 与 ${HUSKY_DIR}/pre-push"
