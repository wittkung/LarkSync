# Implementation Plan: LarkSync TTZip Plugin & Typora-Grade WYSIWYG Editor

- **Feature Directory**: `specs/001-larksync-ttzip-plugin-wysiwyg-editor`
- **Classification**: `[Full SDD]`
- **Status**: `Phase 1 Design Complete`
- **Created**: 2026-08-26
- **Author**: Witt Kung & Antigravity AI Team
- **License**: BSD-3-Clause OR Apache-2.0

---

## 1. Technical Context & Scope

LarkSync replaces the previous TypeScript / VS Code extension architecture with a native, zero-debt architecture:
- **Rust Core**: Tokio + Reqwest (AIMD flow control) + Pulldown-cmark + Similar + SQLite (WAL) + Tar/Zstd.
- **FFI Layer**: Mozilla UniFFI 0.28 proc-macro exporting to Swift 6 Strict Concurrency.
- **Plugin SDK**: `TTZipPluginKit` defining 8 standard extension points under Object-Capability security.
- **WYSIWYG Editor**: `TTMarkdownKit` based on CodeMirror 6 Live Preview + dual-tier theme system + WebKit CoreText vector PDF / Retina 2x PNG export.

---

## 2. Design Artifacts Index

| Artifact | Path | Purpose |
| :--- | :--- | :--- |
| **Feature Spec** | `specs/001-larksync-ttzip-plugin-wysiwyg-editor/spec.md` | Requirements & user stories |
| **Research & Decisions** | `specs/001-larksync-ttzip-plugin-wysiwyg-editor/research.md` | SOTA decisions (Wasm/UniFFI, CM6, 3-Tree) |
| **Data Model** | `specs/001-larksync-ttzip-plugin-wysiwyg-editor/data-model.md` | Entities & 3-Tree state transition matrix |
| **Plugin Contract** | `specs/001-larksync-ttzip-plugin-wysiwyg-editor/contracts/plugin-protocol.md` | TTZipPlugin 8 standard extension points |
| **UniFFI Contract** | `specs/001-larksync-ttzip-plugin-wysiwyg-editor/contracts/uniffi-interface.md` | Strong-typed Swift/Rust FFI API |
| **Quickstart** | `specs/001-larksync-ttzip-plugin-wysiwyg-editor/quickstart.md` | Verification & build instructions |

---

## 3. Phased Implementation Roadmap

```mermaid
gantt
    title LarkSync & TTZip Plugin Kit Implementation
    dateFormat  YYYY-MM-DD
    section Phase 1: Core Engine & FFI (Completed)
    Rust Core (DocX AST / AIMD / 3-Tree / SQLite / Zstd) :done, 2026-08-26, 1d
    Mozilla UniFFI 0.28 Swift CodeGen                     :done, 2026-08-26, 1d
    TTZipPluginKit SDK & LarkSyncStore                    :done, 2026-08-26, 1d
    
    section Phase 2: WYSIWYG Editor Deepening (Next)
    CodeMirror 6 Live Preview Bundle Packaging            :2026-08-27, 2d
    KaTeX / Shiki / Mermaid Inlined Runtime               :2026-08-29, 2d
    Dynamic Typora Community CSS Loader                   :2026-08-31, 1d
    
    section Phase 3: Host Slots & Bidirectional Sync
    TTZip Host Dynamic Slots Refactoring (`ttzip`)        :2026-09-01, 3d
    Bidirectional Push Pipeline & Conflict UI             :2026-09-04, 2d
```
