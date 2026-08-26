# Feature Specification: 001 LarkSync TTZip Plugin & Typora-like WYSIWYG Editor

- **Feature Directory**: `specs/001-larksync-ttzip-plugin-wysiwyg-editor`
- **Classification**: `[Full SDD]`
- **Status**: `Specified`
- **Created**: 2026-08-26
- **Author**: Witt Kung & Antigravity Architectural Team
- **License**: BSD-3-Clause OR Apache-2.0

---

## 1. Executive Summary & Problem Statement

LarkSync is evolving from a single VS Code extension into a core desktop plugin for **TTZip / ttsubs**, combining:
1. **High-Performance Rust Core Engine**: Feishu OpenAPI with AIMD congestion control, DocX Block Tree ⇄ GFM lossless conversion, Dropbox Nucleus 3-Tree sync state machine, SQLite WAL storage, and zero-disk streaming Zstd packaging.
2. **Mozilla UniFFI 0.28 Cross-Language Bindings**: Strong-typed Swift 6 interfaces without manual C-ABI glue.
3. **TTZip Open Plugin Architecture (`TTZipPluginKit`)**: 8 standard extension points (Sidebar, Workspace, Inspector, Preview, Archive Source, Omnibar, Context Menu, Keychain Vault) governed by Object-Capability security.
4. **Typora-Grade Live Preview WYSIWYG Editor (`TTMarkdownKit`)**: CodeMirror 6 active/inactive dynamic syntax folding, dual-tier CSS token system (Zen Minimalist × WSJ Editorial Gold Line × Typora `#write` compatibility), and native WebKit PDF/2x Retina PNG export.

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Incremental Knowledge Base Sync (`US1`)
- **As a** knowledge worker using TTZip,
- **I want** to incrementally sync my entire Feishu Wiki knowledge base to my local file system with sub-second latency,
- **So that** I have offline access to all my documents without triggering HTTP 429 rate limits or losing block-level formatting.
- **Acceptance Criteria**:
  - `AdaptiveRateLimiter` ensures zero 429 lockouts via AIMD backoff.
  - Myers AST Diff + 3-Tree engine handles L0 idempotent, L1 block merge, L2 diff3, and L3 conflict fork (`.conflict.md`).
  - SQLite WAL maintains full revision history and content hash indexing.

### User Story 2: Typora-like Live Preview WYSIWYG Editing (`US2`)
- **As a** writer and developer,
- **I want** a seamless Markdown editing experience where formatting marks are folded on inactive lines and expanded on the active line,
- **So that** I can write with typographic elegance while retaining 100% byte-level plain text fidelity.
- **Acceptance Criteria**:
  - IME composition locks prevent cursor drift during Chinese pinyin input.
  - Typora theme compatibility shim allows loading community CSS themes.
  - Native WebKit CoreText vector PDF export and 2x Retina long-screenshot capture.

### User Story 3: Streaming Archive Backup (`US3`)
- **As an** archivist,
- **I want** to export any cloud knowledge base space directly to a `.ttzip` (zstd compressed TAR) archive with zero disk landing,
- **So that** memory consumption remains constant ($O(1) \le 50\text{MB}$) regardless of knowledge base size.

---

## 3. System Invariants

1. **Safety**: Zero raw pointer leaks; memory managed by Rust `Arc<T>` and Swift 6 Sendable Actor isolation.
2. **Lossless Fidelity**: Markdown text is 100% preserved; no arbitrary AST normalization or whitespace stripping.
3. **Capability Security**: Plugins operate with least privilege; all capabilities injected via `TTZipHostContext`.
