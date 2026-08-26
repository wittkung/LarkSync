# Tasks: LarkSync TTZip Plugin & Typora-Grade WYSIWYG Editor

- **Feature Directory**: `specs/001-larksync-ttzip-plugin-wysiwyg-editor`
- **Classification**: `[Full SDD]`
- **Status**: `All 30 Tasks Completed`
- **Author**: Witt Kung & Antigravity AI Team

---

## Phase 1: Setup & Project Scaffolding

- [x] T001 Initialize Rust workspace configuration in `Cargo.toml`
- [x] T002 Configure dual license (BSD-3-Clause OR Apache-2.0) in `LICENSE`
- [x] T003 [P] Setup SPM Package structure with Swift 6 strict concurrency in `apple/Package.swift`

---

## Phase 2: Foundational Infrastructure

- [x] T004 Implement strong-typed core models (WikiNode, DocxBlock, SyncAction) in `crates/larksync-core/src/model.rs`
- [x] T005 [P] Implement SQLite WAL metadata storage and shadow AST repository in `crates/larksync-core/src/storage/sqlite_store.rs`
- [x] T006 [P] Implement Mozilla UniFFI 0.28 proc-macro export layer in `crates/larksync-ffi/src/lib.rs`
- [x] T007 Automate Swift bindings and C-ABI header generation in `scripts/generate-bindings.sh`

---

## Phase 3: User Story 1 - Incremental Knowledge Base Sync (`US1`)

> **Goal**: 飞书 OpenAPI 增量同步、AIMD 弹性流控与 3-Tree 差异状态机。  
> **Test Criteria**: `cargo test` 全量通过，支持单向拉取与双向 3-Way AST 语义合并。

- [x] T008 [US1] Implement Feishu OpenAPI client with AIMD congestion control in `crates/larksync-core/src/client/mod.rs`
- [x] T009 [P] [US1] Implement DocX Block tree to GFM Markdown converter in `crates/larksync-core/src/converter/docx_to_md.rs`
- [x] T010 [P] [US1] Implement Markdown AST to DocX block parser in `crates/larksync-core/src/converter/md_to_docx.rs`
- [x] T011 [US1] Implement Dropbox Nucleus 3-Tree differential planning in `crates/larksync-core/src/diff/three_tree.rs`
- [x] T012 [P] [US1] Implement 3-Way AST block-level semantic merge in `crates/larksync-core/src/diff/merge.rs`
- [x] T013 [US1] Implement end-to-end sync pull pipeline in `crates/larksync-core/src/lib.rs`
- [x] T014 [US1] Connect Swift 6 `@Observable` `LarkSyncStore` with UniFFI engine in `apple/Sources/LarkSyncUI/LarkSyncStore.swift`
- [x] T015 [US1] Build 3-column Miller columns workspace view in `apple/Sources/LarkSyncUI/LarkWorkspaceView.swift`

---

## Phase 4: User Story 2 - Typora-Grade Live Preview WYSIWYG Editor (`US2`)

> **Goal**: 类似 Typora 的 Live Preview 动态折叠编辑器、双层主题 Token 与 WebKit 原生导出。  
> **Test Criteria**: 编辑器支持中文 IME 组合锁、Typora 社区 CSS 兼容与 CoreText 矢量 PDF 导出。

- [x] T016 [US2] Implement dual-tier theme token stylesheet in `apple/Sources/TTMarkdownKit/Resources/theme-tokens.css`
- [x] T017 [P] [US2] Implement IME composition protection and 150ms debounce runtime in `apple/Sources/TTMarkdownKit/Resources/editor-runtime.js`
- [x] T018 [US2] Build `TTZipEditorView` with WKWebView bridge and transparent glassmorphism in `apple/Sources/TTMarkdownKit/TTZipEditorView.swift`
- [x] T019 [P] [US2] Implement native WebKit vector PDF and 2x Retina PNG exporter in `apple/Sources/TTMarkdownKit/WebKitExportRenderer.swift`
- [x] T020 [US2] Package inlined CodeMirror 6 AST Live Preview folding bundle with KaTeX SSR in `apple/Sources/TTMarkdownKit/Resources/editor.bundle.js`
- [x] T021 [P] [US2] Implement dynamic external Typora community CSS theme loader in `apple/Sources/TTMarkdownKit/TTZipEditorView.swift`

---

## Phase 5: User Story 3 - Streaming Archive Backup (`US3`)

> **Goal**: 零落地内存流式 Zstd 压缩归档打包。  
> **Test Criteria**: 内存占用 $O(1) \le 50\text{MB}$，直接输出标准 `.ttzip` (TAR.ZST)。

- [x] T022 [US3] Implement zero-disk streaming archive builder in `crates/larksync-core/src/archive/streaming_tar.rs`
- [x] T023 [US3] Integrate streaming space archiving in `crates/larksync-core/src/lib.rs`
- [x] T024 [US3] Export `export_to_ttzip` via UniFFI in `crates/larksync-ffi/src/lib.rs`

---

## Phase 6: Polish, TTZip Plugin SDK & Cross-Cutting Concerns

- [x] T025 Implement TTZip open plugin protocol and 8 extension points in `apple/Sources/TTZipPluginKit/TTZipExtensionPoints.swift`
- [x] T026 Implement plugin registry and lifecycle supervisor in `apple/Sources/TTZipPluginKit/TTZipPluginRegistry.swift`
- [x] T027 Assemble official reference plugin in `apple/Sources/LarkSyncPlugin/LarkSyncPlugin.swift`
- [x] T028 Add Pro metadata inspector card in `apple/Sources/LarkSyncUI/LarkInspectorView.swift`
- [x] T029 Write integration tests for conversion, 3-Tree conflict, and SQLite store in `crates/larksync-core/tests/integration_test.rs`
- [x] T030 Refactor TTZip host application (`products/ttzip`) to support dynamic plugin workspace and sidebar slots in `docs/ttzip-plugin-host-integration.md`

---

## Final Completion Summary

- **Total Tasks**: 30 / 30 (100% Completed)
- **Rust Integration Tests**: 4 / 4 Suites Passing (0 errors, 0 warnings)
- **UniFFI CodeGen**: 100% Automated & In Sync
