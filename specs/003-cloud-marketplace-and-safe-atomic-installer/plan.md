# Implementation Plan: TTZip 云端插件商店分发协议与安全原子安装引擎

## 一、 技术上下文 (Technical Context)

| 维度 | 规格 / 选型 |
| :--- | :--- |
| **宿主环境** | macOS 14+ (Apple Silicon + Intel x86_64) |
| **开发语言** | Swift 6 (严格并发检查 StrictConcurrency) + Rust 2021 |
| **分发协议** | Marketplace V1 Specification (GitHub Releases + 静态索引 JSON) |
| **密码学安全** | Apple CryptoKit (Ed25519 数字签名验证) + O(1) 内存流式 SHA-256 |
| **网络引擎** | URLSessionDownloadDelegate + Swift 6 Actor + AsyncStream 节流推送 |
| **安装模型** | 两阶段提交 (2PC Staging -> APFS replaceItem 原子替换) + 动态热插拔 |
| **CI/CD** | GitHub Actions 多架构交叉编译 + lipo 缝合 Universal Binary |

---

## 二、 宪法与安全铁律检查 (Constitution & Security Gates)

- [x] **零信任验签门禁**：所有从云端拉取的 `.ttplugin.zip` 必须通过 SHA-256 哈希比对与 Ed25519 官方公钥签名校验；
- [x] **内存与资源安全**：流式下载与哈希计算杜绝全量加载大文件，防止内存激增；
- [x] **文件系统安全沙盒**：解压严格拦截 Zip Slip 相对路径穿越与非法 Symlink 逃逸；
- [x] **崩溃一致性保障**：两阶段提交（2PC）确保在断电、进程崩溃时旧插件完好无损，支持无缝回滚；
- [x] **Swift 6 严格并发**：网络下载、文件 I/O、密码学校验全量 Actor 隔离，UI 状态更新强绑定 `@MainActor`。

---

## 三、 阶段性设计工件 (Phase Deliverables)

1. **Phase 0: Research (`research.md`)**：
   - 工业界分发拓扑对比（VS Code vs Raycast vs Obsidian vs Homebrew）；
   - Apple CryptoKit Ed25519 签名兼容性与性能基准；
   - 两阶段提交与 APFS `replaceItem` 原子一致性推导。
2. **Phase 1: Design & Contracts**：
   - **Data Model (`data-model.md`)**：`MarketplaceIndex`, `PluginManifest`, `DownloadProgress`, `PluginInstallPhase` 数据结构；
   - **Contracts (`contracts/marketplace-v1.json`)**：标准 JSON Schema 契约；
   - **Quickstart (`quickstart.md`)**：端到端本地验证、发版打包与安装测试指引。
