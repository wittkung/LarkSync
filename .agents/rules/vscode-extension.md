---
trigger: always_on
---

# LarkSync — VS Code 插件开发规范

## 一、 开发与构建规范
1. **构建生命周期**：
   - 调试编译：`npm run compile`
   - 类型检查：`npm run typecheck`
   - 打包验证：`npm run build`
2. **VS Code API 兼容性**：
   - 最低兼容版本为 VS Code `^1.80.0`，严禁使用超出目标版本的未稳定 Proposed API。
   - 所有在 `package.json` 中声明的 command、views、configuration 必须与 `src/` 下的注册逻辑 100% 对齐。

## 二、 错误处理与日志
- 严禁静默吞没飞书 API 报错。所有网络请求异常必须捕获并向 VS Code 状态栏或 OutputChannel 输出结构化日志。
- 面向用户的报错通知统一使用 `vscode.window.showErrorMessage` / `showWarningMessage`，并提供重试或跳转配置的操作按钮。
