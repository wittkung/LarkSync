# Data Model & State Transitions: LarkSync & TTZip Plugin Kit

- **Feature Directory**: `specs/001-larksync-ttzip-plugin-wysiwyg-editor`
- **Created**: 2026-08-26
- **Status**: Completed

---

## 1. Domain Entities

### 1.1 `WikiNode` (Knowledge Base Node)
```rust
pub struct WikiNode {
    pub node_token: String,          // Primary Key (Unique Token)
    pub space_id: String,            // Parent Space
    pub obj_token: String,           // DocX Document Object Token
    pub obj_type: String,            // "docx" | "doc" | "sheet" | "folder"
    pub parent_node_token: Option<String>,
    pub title: String,
    pub has_child: bool,
    pub node_type: NodeType,         // Document(1) | Folder(2) | Link(3)
    pub obj_edit_time: Option<String>,
    pub revision: i64,
    pub content_hash: [u8; 32],      // Blake3 256-bit Hash
}
```

### 1.2 `DocxBlock` (Feishu Block AST)
```rust
pub struct DocxBlock {
    pub block_id: String,
    pub parent_id: Option<String>,
    pub children: Vec<String>,
    pub block_type: BlockType,       // Heading1~9, Text, Table, Grid, Code, etc.
    pub text_runs: Vec<TextRun>,
    pub properties: HashMap<String, Value>,
    pub revision: i64,
}
```

### 1.3 `SyncAction` (3-Tree Differential Action)
```rust
pub enum SyncAction {
    UploadNew { node_token: String, local_path: String },
    UploadUpdate { node_token: String, local_path: String },
    DownloadNew { node: WikiNode, target_path: String },
    DownloadUpdate { node: WikiNode, target_path: String },
    LocalDelete { path: String },
    RemoteDelete { node_token: String },
    ConflictFork {
        node_token: String,
        local_path: String,
        conflict_path: String,
        remote_node: WikiNode,
    },
    NoOp,
}
```

---

## 2. 3-Tree State Transition Matrix

| Local ($T_L$) | Remote ($T_R$) | Synced Base ($T_S$) | Transition Action | Target State |
| :---: | :---: | :---: | :--- | :--- |
| Present ($H_L$) | Absent | Absent | `UploadNew` | $T_R = H_L, T_S = H_L$ |
| Absent | Present ($H_R$) | Absent | `DownloadNew` | $T_L = H_R, T_S = H_R$ |
| Modified ($H_L \ne H_S$) | Unchanged ($H_R = H_S$) | Base ($H_S$) | `UploadUpdate` | $T_R = H_L, T_S = H_L$ |
| Unchanged ($H_L = H_S$) | Modified ($H_R \ne H_S$) | Base ($H_S$) | `DownloadUpdate` | $T_L = H_R, T_S = H_R$ |
| Modified ($H_L \ne H_S$) | Modified ($H_R \ne H_S$) | Base ($H_S$) | `ConflictFork` (if $H_L \ne H_R$) | Main: $T_L = H_R, T_S = H_R$<br>Fork: `$local.conflict-ts.md` |
| Deleted | Unchanged | Base ($H_S$) | `RemoteDelete` | $T_R = \emptyset, T_S = \emptyset$ |
| Unchanged | Deleted | Base ($H_S$) | `LocalDelete` | $T_L = \emptyset, T_S = \emptyset$ |
