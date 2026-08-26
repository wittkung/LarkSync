# Data Model & Schema: 002 TTZip Plugin & LarkSync Deepening

- **Feature Directory**: `specs/002-ttzip-plugin-engine-and-larksync-deepening`
- **Created**: 2026-08-26
- **Status**: Completed

---

## 1. Domain Entities

### 1.1 `PluginManifestV1`
```json
{
  "id": "com.ttzip.plugin.larksync",
  "name": "LarkSync for TTZip",
  "version": "1.2.0",
  "minHostVersion": "1.0.0",
  "author": "Witt Kung",
  "permissions": [
    "permission.network",
    "permission.keychain",
    "permission.fs.write",
    "permission.archive"
  ],
  "contributions": {
    "sidebar": [
      {
        "id": "larksync.sidebar",
        "title": "飞书知识库",
        "icon": "cloud.fill",
        "badgeText": "Sync",
        "targetTabIdentifier": "larksync.workspace",
        "priority": 20
      }
    ]
  }
}
```

### 1.2 `ShadowBlockRecord` (SQLite Table `shadow_blocks`)
```sql
CREATE TABLE IF NOT EXISTS shadow_blocks (
    node_token TEXT NOT NULL,
    block_id TEXT NOT NULL,
    parent_block_id TEXT,
    block_type INTEGER NOT NULL,
    content_hash BLOB NOT NULL,
    block_order INTEGER NOT NULL,
    PRIMARY KEY (node_token, block_id)
);
```

### 1.3 `BatchUpdateDocxRequest`
```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum DocxBlockOperation {
    InsertBlocks {
        parent_id: String,
        index: usize,
        blocks: Vec<DocxBlock>,
    },
    UpdateBlock {
        block_id: String,
        update_text_elements: Vec<TextRun>,
    },
    DeleteBlocks {
        block_ids: Vec<String>,
    },
}
```

---

## 2. Dynamic Plugin Lifecycle State Machine

```
[Installed] ──► [Verifying Signature & Hash] ──► [Loading NSBundle] ──► [Instantiating Plugin]
                                                                                │
                                                                                ▼
[Unloaded] ◄── [onTerminate()] ◄── [Deactivating] ◄── [Active Workspace] ◄── [onInitialize(ScopedContext)]
```
