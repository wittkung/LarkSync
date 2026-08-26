# Implementation Plan: TTZip 插件系统级质量门禁、C-ABI 架构治理与全状态交互闭环

## 一、 技术上下文 (Technical Context)

| 维度 | 规范与技术选型 |
| :--- | :--- |
| **宿主环境** | macOS 14.0+ (Apple Silicon arm64 / Intel x86_64) |
| **开发语言** | Swift 6 (StrictConcurrency) + Rust 2021 |
| **跨库通信** | C-ABI Frozen VTable (`TTZipPluginVTable_v1`) + AppKit `NSHostingView` |
| **状态机模型** | `@Observable` 强类型分区注册表 (`TTZipPluginRegistry`) + 7 态生命周期 |
| **SSOT 发布工具链** | `scripts/dev-release.sh pack` (物理 Zip ➔ SHA-256 / Ed25519 ➔ JSON / Swift 原子写回) |
| **四大质量门禁** | 1. 链接洁净度 (`verify_bundle_linkage.sh`)<br>2. SSOT 一致性 (`dev-release.sh verify`)<br>3. 真实公网 E2E (`verify-distribution-e2e.sh`)<br>4. 实机黑盒 Smoke |

---

## 二、 宪法与安全铁律检查 (Constitution & Security Gates)

- [x] **微内核绝对隔离**：宿主二进制中 0 包含任何插件业务 `LC_LOAD_DYLIB`；
- [x] **C-ABI 稳定性保证**：所有跨 Mach-O 插件调用严格通过 C99 内存对齐的虚函数表（`TTZipPluginVTable_v1`）；
- [x] **SSOT 单一事实源**：禁止在任何 JSON 或 Swift 常量中手工维护哈希/签名，全量由打包脚本自动回填；
- [x] **零崩溃实机验收**：每次发布必须通过真实的 `.app` 启动与 UI 冒烟测试；
- [x] **全状态 UX 闭环**：杜绝三栏灰白空白，实施全屏 Onboarding 向导与情境感知空状态。

---

## 三、 阶段性设计工件 (Phase Deliverables)

1. **Phase 0: Research (`research.md`)**：
   - 6 大专精子 Agent 深度审计与底层技术机理复盘；
2. **Phase 1: Design & Contracts**：
   - **Data Model (`data-model.md`)**：`TTZipPluginVTable_v1`, `WorkspacePhase`, `PluginLifecycleState`, `ContributionPartitionMap`；
   - **Contracts (`contracts/cabi-vtable-v1.json`)**：C-ABI 虚函数表与扩展点契约 Schema；
   - **Quickstart (`quickstart.md`)**：4 大质量门禁执行与本地实机验证流水线指南。
