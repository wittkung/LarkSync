# Quickstart & Verification Guide: LarkSync & TTZip Plugin Kit

- **Feature Directory**: `specs/001-larksync-ttzip-plugin-wysiwyg-editor`
- **Created**: 2026-08-26
- **Status**: Ready for Verification

---

## 1. Prerequisites

- macOS 14.0+
- Rust 1.80+ (`cargo`)
- Xcode 16.0+ (`swift`)

---

## 2. Step-by-Step Verification

### Step 1: Run Rust Core & Diff Engine Test Suites
```bash
cargo test
```
**Expected Outcome**: 4 passed, 0 failed (3-Tree conflict detection, 3-Way AST clean merge, roundtrip Markdown conversion, SQLite metadata store).

### Step 2: Regenerate Mozilla UniFFI Swift Bindings
```bash
./scripts/generate-bindings.sh
```
**Expected Outcome**: Compiles `liblarksync_ffi.dylib`, generates `apple/Sources/LarkSyncCore/larksync_ffi.swift`, and synchronizes C-ABI headers to `apple/Sources/larksync_ffiFFI/include/`.

### Step 3: Run Swift SPM Test Suite
```bash
swift test --package-path apple
```
**Expected Outcome**: Tests for `TTZipPluginManifest` and `TTZipTheme` design tokens pass with 0 errors.
