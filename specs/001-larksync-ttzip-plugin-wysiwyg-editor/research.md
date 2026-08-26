# Research & Architectural Decisions: LarkSync & TTZip Plugin Kit

- **Feature Directory**: `specs/001-larksync-ttzip-plugin-wysiwyg-editor`
- **Created**: 2026-08-26
- **Status**: Completed

---

## 1. Desktop Plugin Architecture & Security Sandbox

### Decision
Dual-Tier Hybrid Sandbox:
- **Tier 1 (Native + UniFFI)**: For official/high-performance plugins (like LarkSync), linking Rust core directly to Swift 6 MainActor views via Mozilla UniFFI.
- **Tier 2 (Wasm Component Model)**: For third-party open-source plugins, running in Wasmtime with WASI 0.2 WIT interfaces and zero ambient authority (Dennis & Van Horn OCap).

### Rationale
Pure Webview plugin models (like Figma iframe or VS Code Webview) add 100MB+ overhead per plugin and break native macOS HIG. Pure dylib models crash the host on segmentation faults. Dual-Tier provides extreme speed for native core plugins while ensuring crash-isolation for community extensions.

---

## 2. WYSIWYG Markdown Editor Engine

### Decision
**CodeMirror 6 (CM6) + Hybrid Live Preview + Lightweight Transparent WKWebView**.

### Rationale
- **100% Lossless Plain Text**: Operates directly on immutable Rope data structure; never mutates user indentation, spaces, or raw frontmatter.
- **Dynamic Syntax Folding**: Uses Lezer incremental syntax parser; inactive lines fold markup (`#`, `**`, `*`, `~~`, `[]()`) via `Decoration.replace`; active line instantly unfolds raw Markdown for micro-editing.
- **Chinese IME Stability**: Freezes DOM decoration passes during `compositionstart`/`compositionend`, completely eliminating cursor drift and candidate flicker.

---

## 3. Theming & Typography System

### Decision
**Dual-Tier CSS Token System (`theme-tokens.css`)**:
1. *Tier 1*: `TTZipTheme` semantic design tokens (`kintsugiGold`, `bambooGreen`, `washiPaper`, `deepGraphite`, `inkBlack`).
2. *Tier 2*: Typora community theme standard compatibility shim (`#write` container scope, `--bg-color`, `--text-color`, `--code-bg-color`).
3. *Tier 3*: WSJ Editorial typography (New York serif headings, 1.5pt gold line, italic gold quote boxes).

---

## 4. Offline Knowledge Base Sync & Conflict Resolution

### Decision
**Dropbox Nucleus 3-Tree Model ($T_L, T_R, T_S$) + 3-Way AST Semantic Merge + AIMD Congestion Control**.

### Rationale
- **3-Tree State Machine**: Cleanly tracks Local, Remote, and Synced Base states.
- **L0~L3 Conflict Ladder**: L0 (hash match) → L1 (independent block merge) → L2 (line diff3) → L3 (fork companion `.conflict.md`). Zero silent overwrites.
- **AIMD Limiter**: Additive increase (+1 QPS per 10 successes) and multiplicative decrease (halve QPS on 429) eliminates rate limit bans.
