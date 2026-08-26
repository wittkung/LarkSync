# LarkSync: Lark / Feishu Knowledge Base Bi-directional Sync Engine & Live Preview Markdown Editor

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> | <b>English</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-BSD--3--Clause%20OR%20Apache--2.0-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/Rust-2021%20Edition-orange.svg" alt="Rust" />
  <img src="https://img.shields.io/badge/UniFFI-0.28-purple.svg" alt="Mozilla UniFFI" />
  <img src="https://img.shields.io/badge/Swift-6.0-green.svg" alt="Swift 6" />
  <img src="https://img.shields.io/badge/Platform-macOS%2014%2B-lightgrey.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/Architecture-Decoupled%20Plugins-gold.svg" alt="Decoupled" />
</p>

LarkSync is the official benchmark extension tailored for the **TTZip / ttsubs** desktop application ecosystem. It provides high-fidelity, bi-directional incremental synchronization for Lark / Feishu Knowledge Bases, coupled with a **Typora-inspired WYSIWYG Live Preview Markdown editor and a vectorized multi-format export pipeline**.

---

## 🌟 Key Features

1. **Pure Rust Core Engine (`larksync-core`)**
   - **Lark OpenAPI Client**: Auto-refreshes `tenant_access_token`, powered by **AIMD (Additive Increase / Multiplicative Decrease)** congestion control and Full Jitter exponential backoff to eliminate HTTP 429 Rate Limits.
   - **Bi-directional Lossless AST Converter**: Seamless transformation between Lark DocX Block Trees and GFM / CommonMark plain text.
   - **Dropbox Nucleus 3-Tree Differential Engine**: Maintains Local, Remote, and Synced Base states, providing L0–L3 conflict resolution and companion branch preservation (`.conflict.md`) for zero data loss.
   - **Streaming In-Memory Archive Packer**: Pipelines cloud knowledge bases directly into Zstandard compression via Tokio async streams, producing `.tar.zst` or `.ttzip` archives without intermediate disk staging.

2. **Mozilla UniFFI FFI Bindings (`larksync-ffi`)**
   - Built on Mozilla UniFFI 0.28+ proc-macros, eliminating manual C-ABI glue code.
   - Automatically generates strongly-typed Swift APIs and C modulemaps with full Swift 6 Strict Concurrency safety.

3. **TTZip Open Plugin SDK & Dynamic Decoupled Architecture (`TTZipPluginKit`)**
   - **100% Dynamic Decoupling**: The TTZip host application depends exclusively on the `TTZipPluginKit` contract library—zero hardcoded business dependencies.
   - **Zero-Trust Cryptographic Gates**: O(1) memory streaming SHA-256 integrity verification, Apple CryptoKit Ed25519 digital signature validation, and Zip Slip path traversal defense.
   - **Two-Phase Commit (2PC) Atomic Installation**: Sandbox staging isolation + APFS `replaceItem` atomic directory swap ensuring zero corruption on power loss or abrupt crash.
   - **Live Hot-Mounting**: Automatically and reactively mounts workspace items on the sidebar upon installation, and unmounts instantly on uninstall.

4. **Typora-inspired WYSIWYG Editor (`TTMarkdownKit`)**
   - **Live Preview Dynamic Syntax Folding**: Markdown syntax symbols fold into rich styling on blur and expand seamlessly on focus.
   - **Dual-Layer Theme Token System**: Built upon TTZip Zen Minimal $\times$ WSJ Editorial Typography $\times$ Kintsugi Gold accents, fully compatible with Typora community CSS themes.
   - **High-Fidelity Multi-format Exporter**: Native macOS CoreText vector PDF export, Retina 2x full-length PNG capture, and self-contained single-file HTML generation.

---

## 🏗️ Project Architecture

```
larksync/
├── LICENSE                             # BSD-3-Clause OR Apache-2.0 Dual License
├── Cargo.toml                          # Rust Workspace root configuration
├── marketplace.json                    # Official Marketplace V1 specification index
├── crates/
│   ├── larksync-core/                  # Core Rust domain & sync state machine
│   └── larksync-ffi/                   # Mozilla UniFFI cross-language exports
├── apple/                              # Swift 6 SPM native workspace
│   ├── Package.swift                   # Package manifest (TTZipPluginKit, TTMarkdownKit, LarkSyncPlugin)
│   └── Sources/
│       ├── larksync_ffiFFI/            # UniFFI C-ABI headers & modulemap
│       ├── LarkSyncCore/               # UniFFI-generated Swift bindings
│       ├── TTZipPluginKit/             # TTZip Official Plugin SDK (8 extension points, security, installer)
│       ├── TTMarkdownKit/              # WYSIWYG Markdown editor & theme engine
│       ├── LarkSyncUI/                 # 3-column Miller Columns workspace & Pro inspector
│       └── LarkSyncPlugin/             # Independent TTZipPlugin bundle implementation
├── docs/
│   ├── PLUGIN_DEVELOPMENT_AND_PUBLISHING.md       # Developer & Marketplace Publishing Guide (English)
│   └── PLUGIN_DEVELOPMENT_AND_PUBLISHING.zh-CN.md # Developer & Marketplace Publishing Guide (Chinese)
└── scripts/
    ├── generate-bindings.sh            # One-click script to compile Rust & generate Swift bindings
    ├── build-plugin.sh                 # Independent build script for LarkSync.ttplugin bundle
    └── dev-release.sh                  # Local developer release, Ed25519 signing, & self-verification tool
```

---

## 🚀 Developer Toolchain & Release Guide

### 1. Run Core Unit Tests
```bash
cargo test
```

### 2. Package, Compress & Sign Locally with Ed25519
```bash
# Generate keypair (first time only)
./scripts/dev-release.sh keygen

# Build, assemble, and sign v1.0.0 release archive
./scripts/dev-release.sh pack 1.0.0

# Verify signature integrity locally
./scripts/dev-release.sh verify 1.0.0
```

### 3. One-Click Install to Local TTZip
```bash
./scripts/build-plugin.sh --install-user
```

---

## 🌐 Marketplace & Cloud Distribution Workflow (GitOps)

Publishing a third-party extension to the TTZip Marketplace follows a simple 3-step GitOps loop:

```
+─────────────────────────────────────────────────────────────────────────────+
|                    Third-Party Plugin Publishing Workflow                    |
+─────────────────────────────────────────────────────────────────────────────+
|  1. Developer creates a GitHub repo using TTZipPluginKit                    |
|  2. Developer publishes <Plugin>-<Ver>.ttplugin.zip with .sig signature     |
|  3. Submit a Pull Request appending metadata to marketplace.json            |
|  4. Official CI validates signatures and merges -> Available globally!       |
+─────────────────────────────────────────────────────────────────────────────+
```

For the complete guide, please refer to [docs/PLUGIN_DEVELOPMENT_AND_PUBLISHING.md](docs/PLUGIN_DEVELOPMENT_AND_PUBLISHING.md).

---

## 📄 License

This project is licensed under either the **BSD 3-Clause License** or the **Apache License 2.0** (see [LICENSE](LICENSE) for details).