# Interface Contract: Feishu DocX Batch Update & Drive Media Upload

- **Feature Directory**: `specs/002-ttzip-plugin-engine-and-larksync-deepening`
- **Module**: `crates/larksync-core`

---

## 1. Rust API Signature

```rust
impl LarkApiClient {
    /// 递归遍历拉取指定空间下的所有层级知识库节点 (BFS Queue Walker)
    pub async fn fetch_all_nodes_recursive(&self, space_id: &str) -> Result<Vec<WikiNode>>;

    /// 批量更新 DocX 文档块 (Insert / Update / Delete)
    pub async fn batch_update_docx_blocks(
        &self,
        document_id: &str,
        requests: Vec<DocxBlockOperation>,
    ) -> Result<()>;

    /// 上传本地图片到飞书 Drive 换取 file_token
    pub async fn upload_drive_media(
        &self,
        parent_token: &str,
        file_name: &str,
        file_bytes: Vec<u8>,
    ) -> Result<String>;
}
```
