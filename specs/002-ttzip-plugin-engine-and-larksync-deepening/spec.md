# Feature Specification: 002 TTZip Plugin Engine & LarkSync Deepening

- **Feature Directory**: `specs/002-ttzip-plugin-engine-and-larksync-deepening`
- **Classification**: `[Full SDD]`
- **Status**: `Specified`
- **Created**: 2026-08-26
- **Author**: Witt Kung & Antigravity Architectural Team
- **License**: BSD-3-Clause OR Apache-2.0

---

## 1. Executive Summary & Problem Statement

Following our deep architectural audit, this milestone comprehensively overhauls the TTZip plugin architecture and LarkSync ecosystem across 4 foundational pillars:

1. **Dynamic Plugin Loading & Scoped OCap Security**:
   - Introduce `.ttplugin` bundle container format with Ed25519 digital signature and SHA-256 integrity verification.
   - Enforce Principle of Least Privilege via `PluginScopedHostContext` and tenant-isolated Keychain namespaces (`com.ttzip.plugin.<id>.*`).
   - Fix plugin registry omissions and refactor `MacEditorialSidebar` and `MainView` to dynamically consume registered contributions instead of hardcoded enums.

2. **Feishu Wiki Recursive Sync & Bidirectional Push**:
   - Fix critical bug in `LarkApiClient::fetch_all_nodes` by implementing full BFS recursive tree traversal for all multi-level directory branches (`has_child == true`).
   - Implement `batch_update_docx_blocks` and `upload_drive_media` to establish the reverse sync pipeline (Local Markdown ➔ Cloud DocX AST).
   - Implement `shadow_blocks` SQLite repository to preserve cloud `block_id` mappings for precise 3-Way AST merging.

3. **True CodeMirror 6 Live Preview WYSIWYG Editor (`TTMarkdownKit`)**:
   - Replace bare `contenteditable` with an inlined, self-contained CodeMirror 6 + Lezer Markdown AST bundle.
   - Implement active-line unfolding / inactive-line folding for headers, bold, italics, links, and math.
   - Integrate KaTeX SSR math equations, syntax-highlighted code blocks, and interactive GFM table controllers.
   - Configure WKWebView `baseURL` to local document directories to enable native offline image loading and drag-and-drop attachment handling.

---

## 2. User Stories & Acceptance Criteria

### User Story 1: True Dynamic Plugin System & Scoped Security (`US1`)
- **As a** third-party plugin developer,
- **I want** to distribute `.ttplugin` packages that users can install without recompiling TTZip,
- **So that** my plugin runs with verified permissions and cannot access other plugins' credentials or crash the host ungracefully.
- **Acceptance Criteria**:
  - `TTZipPluginRegistry` dynamically consumes and displays sidebar tabs, workspace views, context menus, and archive providers.
  - `PluginScopedHostContext` prevents unauthorized keychain access outside the plugin's namespace.
  - Ed25519 signatures and SHA-256 hashes are verified during package load.

### User Story 2: Recursive Multi-Level Knowledge Base Sync & Push (`US2`)
- **As a** enterprise knowledge worker,
- **I want** to sync deeply nested multi-level Feishu Wiki spaces and push local edits back to cloud documents,
- **So that** no nested documents are omitted and bi-directional collaboration is seamless.
- **Acceptance Criteria**:
  - `fetch_all_nodes` recursively traverses all sub-folders without page limit truncation.
  - `batch_update_docx_blocks` successfully applies insert/update/delete operations to cloud documents.
  - SQLite `shadow_blocks` maintains 1-to-1 cloud block ID alignment.

### User Story 3: Industrial-Grade Typora Live Preview Editing (`US3`)
- **As a** writer and developer,
- **I want** an editor that dynamically folds Markdown punctuation on inactive lines and reveals raw source when cursor enters,
- **So that** I enjoy a Typora-like writing flow with zero plain text corruption.
- **Acceptance Criteria**:
  - CodeMirror 6 Live Preview folds `#`, `**`, `*`, `~~`, `$$`, `[]()` on blur and unfolds on focus.
  - Local relative images (`./assets/...`) resolve immediately via correct WebKit `baseURL`.
  - IME composition locks prevent Chinese pinyin input drift.
