# LarkSync: 飞书知识库同步引擎与所见即所得编辑器

<p align="center">
  <b>简体中文</b> | <a href="README.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-BSD--3--Clause%20OR%20Apache--2.0-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/Rust-2021%20Edition-orange.svg" alt="Rust" />
  <img src="https://img.shields.io/badge/UniFFI-0.28-purple.svg" alt="Mozilla UniFFI" />
  <img src="https://img.shields.io/badge/Swift-6.0-green.svg" alt="Swift 6" />
  <img src="https://img.shields.io/badge/Platform-macOS%2014%2B-lightgrey.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/Architecture-Decoupled%20Plugins-gold.svg" alt="Decoupled" />
</p>

LarkSync 是专为 **TTZip / ttsubs** 桌面生态打造的飞书知识库双向增量同步官方标杆插件，同时集成了**类 Typora 所见即所得 (Live Preview) 现代化 Markdown 主题编辑器与高保真矢量导出引擎**。

---

## 🌟 核心特性

1. **纯 Rust 核心引擎 (`larksync-core`)**
   - **飞书 OpenAPI 客户端**：自动维护 `tenant_access_token`，集成 **AIMD (Additive Increase / Multiplicative Decrease)** 弹性拥塞控制与 Full Jitter 指数退避，彻底消除 429 Rate Limit。
   - **双向无损 AST 转换**：DocX Block 树与 GFM / CommonMark 纯文本精准互转。
   - **Dropbox Nucleus 3-Tree 差异状态机**：维护 Local、Remote 与 Synced Base 三方状态，提供 L0~L3 级冲突解决与伴生冲突分叉（`.conflict.md`），保证 0 数据丢失。
   - **零落地流式打包**：基于 Tokio 异步管道边拉取边 zstd 压缩，一键导出 `.tar.zst` / `.ttzip` 归档。

2. **Mozilla UniFFI 跨语言绑定 (`larksync-ffi`)**
   - 全面抛弃手写 C-ABI，使用 Mozilla UniFFI 0.28+ proc-macro 体系。
   - 一键生成 100% 强类型的 Swift 接口与 C modulemap，天然支持 Swift 6 Strict Concurrency。

3. **TTZip 开源插件 SDK 与动态解耦架构 (`TTZipPluginKit`)**
   - **100% 动态解耦**：宿主 TTZipApp 仅依赖 `TTZipPluginKit` 契约库，绝无插件业务代码硬依赖；
   - **零信任密码学门禁**：基于 Apple CryptoKit 的 Ed25519 签名验证、O(1) 内存分块流式 SHA-256 哈希校验与 Zip Slip 路径穿越防御；
   - **两阶段提交原子安装 (2PC)**：Staging 沙盒隔离校验 + APFS `replaceItem` 原子目录置换，确保断电或崩溃零损坏；
   - **响应式热挂载 (Live Hot-Mount)**：安装后左侧边栏即时动态出现工作区入口，卸载后即时响应式移除。

4. **类 Typora 所见即所得编辑器 (`TTMarkdownKit`)**
   - **Live Preview 动态语法折叠**：光标离开时隐藏 Markdown 符号呈现富文本，光标进入时原地展开源码，保持 100% 纯文本字节级无损。
   - **双层主题 Token 体系**：以 TTZip Zen 极简 $\times$ WSJ Editorial 典雅排版 $\times$ Kintsugi Gold 金线为核心底座，无缝兼容 Typora 社区海量 CSS 主题。
   - **高保真多格式导出**：macOS 原生 CoreText 矢量 PDF 导出、Retina 2x 长图截取与自包含单文件 HTML 生成。

---

## 🏗️ 项目架构

```
larksync/
├── LICENSE                             # BSD-3-Clause OR Apache-2.0 双重开源协议
├── Cargo.toml                          # Rust Workspace 根配置
├── marketplace.json                    # 官方插件商店索引规范 (Marketplace V1)
├── crates/
│   ├── larksync-core/                  # 纯 Rust 核心领域引擎
│   └── larksync-ffi/                   # Mozilla UniFFI 跨语言导出
├── apple/                              # Swift 6 SPM 原生模块
│   ├── Package.swift                   # Package 声明 (TTZipPluginKit, TTMarkdownKit, LarkSyncPlugin)
│   └── Sources/
│       ├── larksync_ffiFFI/            # UniFFI C-ABI 头文件与 modulemap
│       ├── LarkSyncCore/               # UniFFI 自动生成的 Swift 绑定
│       ├── TTZipPluginKit/             # TTZip 官方开源插件 SDK (8 大扩展点、安全门禁与安装器)
│       ├── TTMarkdownKit/              # 类 Typora 所见即所得编辑器与主题引擎
│       ├── LarkSyncUI/                 # 3 栏米勒列工作区与 Pro 检查器
│       └── LarkSyncPlugin/             # 遵循 TTZipPlugin 协议的独立 Bundle 实现
├── docs/
│   ├── PLUGIN_DEVELOPMENT_AND_PUBLISHING.md       # 插件开发与上架指南 (English)
│   └── PLUGIN_DEVELOPMENT_AND_PUBLISHING.zh-CN.md # 插件开发与上架指南 (简体中文)
└── scripts/
    ├── generate-bindings.sh            # 一键编译 Rust 并自动生成 Swift 绑定
    ├── build-plugin.sh                 # 独立构建 LarkSync.ttplugin Bundle 包
    └── dev-release.sh                  # 本地发版、Ed25519 签名、SHA-256 生成与自检工具
```

---

## 🚀 开发者工具链与发版指引

### 1. 运行核心单元测试
```bash
cargo test
```

### 2. 本地一键打包、压缩与 Ed25519 签名
```bash
# 生成密钥对 (仅首次)
./scripts/dev-release.sh keygen

# 全量构建、组装并签名 v1.0.0 插件包
./scripts/dev-release.sh pack 1.0.0

# 密码学验签自检
./scripts/dev-release.sh verify 1.0.0
```

### 3. 一键安装到本地 TTZip
```bash
./scripts/build-plugin.sh --install-user
```

---

## 🌐 插件生态与云端分发流程 (GitOps Marketplace)

第三方开发者上架插件采用 3 步闭环标准：

```
+─────────────────────────────────────────────────────────────────────────────+
|                         第三方开发者上架插件 3 步闭环                       |
+─────────────────────────────────────────────────────────────────────────────+
|  1. 开发者在 GitHub 新建仓库并使用 TTZipPluginKit 开发插件                 |
|  2. 开发者在 GitHub Releases 发布 <Plugin>-<Ver>.ttplugin.zip 与 .sig 签名  |
|  3. 向官方插件市场提 PR 在 marketplace.json 中追加自身元数据条目            |
|  4. 官方 CI 自动化验签通过并 Merge ➔ 全球 TTZip 客户端商店立即展示该插件！  |
+─────────────────────────────────────────────────────────────────────────────+
```

完整开发与发布指南请阅读 [docs/PLUGIN_DEVELOPMENT_AND_PUBLISHING.zh-CN.md](docs/PLUGIN_DEVELOPMENT_AND_PUBLISHING.zh-CN.md)。

---

## 📄 开源许可证

本项目采用 **BSD 3-Clause License** 或 **Apache License 2.0** 双重许可（详情参见 [LICENSE](LICENSE)）。
