# Research & Architectural Decisions: 002 TTZip Plugin & LarkSync Deepening

- **Feature Directory**: `specs/002-ttzip-plugin-engine-and-larksync-deepening`
- **Created**: 2026-08-26
- **Status**: Completed

---

## 1. Plugin Packaging, Verification & Dynamic Loading

### Decision
- **Container Format**: `.ttplugin` based on standard ZIP/ZSTD container with `manifest.json`, `signature.sig`, and Mach-O framework.
- **Verification Engine**: Apple CryptoKit `Curve25519.Signing.PublicKey` (Ed25519) + SHA-256 digest validation.
- **Dynamic Loading**: `NSBundle` dynamic loading + protocol conforming factory symbol lookup.

---

## 2. Scoped Object-Capability (OCap) Security & EventBus

### Decision
- **Scoped Context**: Per-plugin instantiated `PluginScopedHostContext` enforcing Manifest permissions (`.keychainAccess`, `.fileSystemRead`, `.fileSystemWrite`, `.networkAccess`).
- **Keychain Namespace**: All keychain keys prefixed with `com.ttzip.plugin.<id>.` with zero cross-tenant access.
- **Strong-Typed EventBus**: `SubscriptionToken` based typed listener registry with explicit `unsubscribe` to guarantee zero memory leaks in Swift 6.

---

## 3. Feishu OpenAPI Tree Traversal & DocX Reverse Push

### Decision
- **BFS Queue Traversal**: Replace shallow single-page fetch with asynchronous queue walker (`VecDeque<Option<String>>`) pulling all descendant pages.
- **DocX Batch Update API**: Map `POST /open-apis/docx/v1/documents/{doc_id}/blocks/batch_update` for block-level delta application (`InsertBlocks`, `UpdateBlock`, `DeleteBlocks`).
- **Shadow Block SQLite Cache**: Track `(node_token, block_id, content_hash)` triples in SQLite WAL to preserve cloud IDs across offline edits.

---

## 4. CodeMirror 6 Live Preview & Local Asset Resolution

### Decision
- **CodeMirror 6 AST Live Preview**: Bundle `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, `@lezer/markdown` into standalone `editor.bundle.js`.
- **ViewPlugin / Decoration**: Active line retains raw text; inactive lines apply `Decoration.replace` with styled HTML elements.
- **WebKit BaseURL**: Pass `URL(fileURLWithPath: documentDirectory, isDirectory: true)` to `loadHTMLString` to enable native `./assets/` image rendering.
