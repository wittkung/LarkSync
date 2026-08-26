# Interface Contract: Mozilla UniFFI Cross-Language Bindings

- **Feature Directory**: `specs/001-larksync-ttzip-plugin-wysiwyg-editor`
- **Module**: `larksync-ffi` ➔ `LarkSyncCore`
- **Specification**: UniFFI 0.28+ Proc-Macro Binding

---

## 1. Rust Export Interface

```rust
#[derive(uniffi::Record, Clone, Debug)]
pub struct LarkAuthConfig {
    pub app_id: String,
    pub app_secret: String,
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct WikiSpaceItem {
    pub space_id: String,
    pub name: String,
    pub description: String,
    pub space_type: String,
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct WikiNodeItem {
    pub node_token: String,
    pub obj_token: String,
    pub obj_type: String,
    pub parent_node_token: Option<String>,
    pub title: String,
    pub has_child: bool,
    pub obj_edit_time: Option<String>,
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct SyncProgressEventDto {
    pub current_step: String,
    pub processed_items: u32,
    pub total_items: u32,
    pub current_item_name: String,
}

#[uniffi::export(callback_interface)]
pub trait SyncProgressCallback: Send + Sync {
    fn on_progress(&self, progress: SyncProgressEventDto);
    fn on_log(&self, level: String, message: String);
}

#[derive(uniffi::Object)]
pub struct LarkSyncEngine;

#[uniffi::export]
impl LarkSyncEngine {
    #[uniffi::constructor]
    pub fn new(config: LarkAuthConfig, storage_path: String) -> Result<Arc<Self>, LarkFfiError>;

    pub async fn fetch_spaces(&self) -> Result<Vec<WikiSpaceItem>, LarkFfiError>;
    pub async fn fetch_wiki_tree(&self, space_id: String) -> Result<Vec<WikiNodeItem>, LarkFfiError>;
    pub async fn sync_pull(&self, space_id: String, target_dir: String, cb: Box<dyn SyncProgressCallback>) -> Result<u32, LarkFfiError>;
    pub async fn export_to_ttzip(&self, space_id: String, output_path: String, cb: Box<dyn SyncProgressCallback>) -> Result<(), LarkFfiError>;
    pub fn markdown_to_blocks_json(&self, markdown: String) -> Result<String, LarkFfiError>;
}
```
