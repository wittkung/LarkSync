# Tasks: 002 TTZip Plugin Engine & LarkSync Deepening

- **Feature Directory**: `specs/002-ttzip-plugin-engine-and-larksync-deepening`
- **Classification**: `[Full SDD]`
- **Status**: `All 18 Tasks Completed`
- **Author**: Witt Kung & Antigravity AI Team

---

## Phase 1: Setup & Scaffolding

- [x] T001 Define Manifest V1 JSON schema in `specs/002-ttzip-plugin-engine-and-larksync-deepening/contracts/manifest-v1.json`

---

## Phase 2: Foundational Infrastructure

- [x] T002 [P] Upgrade `TTZipPluginManifest` with SemVer ranges and scoped permissions in `apple/Sources/TTZipPluginKit/TTZipPluginManifest.swift`
- [x] T003 [P] Implement `SubscriptionToken` and leak-free generic `subscribeEvent` in `apple/Sources/TTZipPluginKit/TTZipHostContext.swift`
- [x] T004 Implement `shadow_blocks` SQLite repository in `crates/larksync-core/src/storage/sqlite_store.rs`

---

## Phase 3: User Story 1 - Dynamic Plugin Engine & Scoped OCap Security (`US1`)

> **Goal**: 补齐 8 大扩展点收集、落地 Scoped Host Context 租户隔离与 Ed25519 签名校验。  
> **Test Criteria**: Keychain 按 `com.ttzip.plugin.<id>` 隔离，宿主动态渲染已注册插件。

- [x] T005 [US1] Fix missing `archiveSourceProviders` and `contextMenuActions` collection in `apple/Sources/TTZipPluginKit/TTZipPluginRegistry.swift`
- [x] T006 [US1] Implement per-plugin `PluginScopedHostContext` and isolated Keychain namespaces in `apple/Sources/TTZipPluginKit/TTZipHostContext.swift`
- [x] T007 [P] [US1] Implement Ed25519 digital signature and SHA-256 integrity verifier in `apple/Sources/TTZipPluginKit/TTZipPluginVerifier.swift`
- [x] T008 [US1] Refactor TTZip host `MacEditorialSidebar` and `MainView` to dynamically consume registered plugin tabs from `TTZipPluginRegistry`

---

## Phase 4: User Story 2 - Feishu Wiki BFS Tree Walker & Bidirectional Push (`US2`)

> **Goal**: 修复多层目录漏抓 Bug，打通 DocX 批量更新与图片上传 API，建立完整的反向 Push 链路。  
> **Test Criteria**: `fetch_all_nodes` 完整遍历多层子文件夹，单测覆盖递归与逆向 AST 转换。

- [x] T009 [US2] Implement BFS recursive tree queue walker in `LarkApiClient::fetch_all_nodes` in `crates/larksync-core/src/client/mod.rs`
- [x] T010 [P] [US2] Implement `batch_update_docx_blocks` (insert/update/delete) in `crates/larksync-core/src/client/mod.rs`
- [x] T011 [P] [US2] Implement `upload_drive_media` image attachment uploader in `crates/larksync-core/src/client/mod.rs`
- [x] T012 [US2] Enhance `MarkdownToDocxConverter` to support full GFM tables, code fences, and text styling in `crates/larksync-core/src/converter/md_to_docx.rs`
- [x] T013 [US2] Add unit tests for recursive BFS traversal and DocX block AST roundtrip in `crates/larksync-core/tests/integration_test.rs`

---

## Phase 5: User Story 3 - Industrial-Grade CodeMirror 6 WYSIWYG Editor (`US3`)

> **Goal**: 真正的 Live Preview 动态语法折叠、BaseURL 相对路径图片加载与 UI 数据响应闭环。  
> **Test Criteria**: 活动行源码展开/非活动行富文本折叠，本地图片直接在 WebKit 中渲染，选中节点加载文档。

- [x] T014 [US3] Implement dynamic active-unfold / inactive-fold Live Preview runtime in `apple/Sources/TTMarkdownKit/Resources/editor.bundle.js`
- [x] T015 [P] [US3] Set WebKit `baseURL` to local document directory in `apple/Sources/TTMarkdownKit/TTZipEditorView.swift`
- [x] T016 [US3] Connect selected wiki node change event to load local `.md` file in `apple/Sources/LarkSyncUI/LarkWorkspaceView.swift`

---

## Phase 6: Polish & Verification

- [x] T017 Regenerate Mozilla UniFFI Swift bindings and run full Rust test suite
- [x] T018 Verify TTZip host package and plugin dependencies with `swift package dump-package`

---

## Final Completion Summary

- **Total Tasks**: 18 / 18 (100% Completed)
- **Rust Integration Tests**: 5 / 5 Suites Passing (0 errors, 0 warnings)
- **UniFFI Swift CodeGen**: Fully Synchronized
- **TTZip Host Swift Package**: 100% Validated
