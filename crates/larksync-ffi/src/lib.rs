// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

use std::sync::Arc;
use thiserror::Error;

#[derive(Error, Debug, uniffi::Error)]
pub enum LarkFfiError {
    #[error("API Error: {msg}")]
    ApiError { msg: String },
    #[error("Auth Error: {msg}")]
    AuthError { msg: String },
    #[error("IO Error: {msg}")]
    IoError { msg: String },
}

impl From<anyhow::Error> for LarkFfiError {
    fn from(err: anyhow::Error) -> Self {
        Self::ApiError { msg: err.to_string() }
    }
}

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
pub struct LarkSyncEngine {
    core: Arc<larksync_core::LarkCoreEngine>,
}

#[uniffi::export(async_runtime = "tokio")]
impl LarkSyncEngine {
    #[uniffi::constructor]
    pub fn new(config: LarkAuthConfig, storage_path: String) -> Result<Arc<Self>, LarkFfiError> {
        let core = larksync_core::LarkCoreEngine::init(config.app_id, config.app_secret, storage_path)?;
        Ok(Arc::new(Self { core: Arc::new(core) }))
    }

    /// Asynchronously fetches all Wiki spaces.
    pub async fn fetch_spaces(&self) -> Result<Vec<WikiSpaceItem>, LarkFfiError> {
        let spaces = self.core.fetch_spaces().await?;
        Ok(spaces.into_iter().map(|s| WikiSpaceItem {
            space_id: s.space_id,
            name: s.name,
            description: s.description,
            space_type: s.space_type,
        }).collect())
    }

    /// Asynchronously fetches Wiki tree nodes for a space.
    pub async fn fetch_wiki_tree(&self, space_id: String) -> Result<Vec<WikiNodeItem>, LarkFfiError> {
        let nodes = self.core.fetch_wiki_tree(&space_id).await?;
        Ok(nodes.into_iter().map(|n| WikiNodeItem {
            node_token: n.node_token,
            obj_token: n.obj_token,
            obj_type: n.obj_type,
            parent_node_token: n.parent_node_token,
            title: n.title,
            has_child: n.has_child,
            obj_edit_time: n.obj_edit_time,
        }).collect())
    }

    /// Executes end-to-end incremental sync pull (with optional subtree root node token).
    pub async fn sync_pull(
        &self,
        space_id: String,
        root_node_token: Option<String>,
        target_dir: String,
        cb: Box<dyn SyncProgressCallback>,
    ) -> Result<u32, LarkFfiError> {
        self.core.sync_pull_space(
            &space_id,
            root_node_token.as_deref(),
            &target_dir,
            move |evt| {
                cb.on_progress(SyncProgressEventDto {
                    current_step: evt.current_step,
                    processed_items: evt.processed_items,
                    total_items: evt.total_items,
                    current_item_name: evt.current_item_name,
                });
            }
        ).await.map_err(Into::into)
    }

    /// Zero-copy streaming export to TTZip archive (with optional subtree root node token).
    pub async fn export_to_ttzip(
        &self,
        space_id: String,
        root_node_token: Option<String>,
        output_path: String,
        cb: Box<dyn SyncProgressCallback>,
    ) -> Result<(), LarkFfiError> {
        self.core.export_space_to_ttzip(
            &space_id,
            root_node_token.as_deref(),
            &output_path,
            move |evt| {
                cb.on_progress(SyncProgressEventDto {
                    current_step: evt.current_step,
                    processed_items: evt.processed_items,
                    total_items: evt.total_items,
                    current_item_name: evt.current_item_name,
                });
            }
        ).await.map_err(Into::into)
    }

    /// Converts Markdown text into DocX Block JSON.
    pub fn markdown_to_blocks_json(&self, markdown: String) -> Result<String, LarkFfiError> {
        let blocks = self.core.convert_markdown_to_blocks(&markdown);
        serde_json::to_string(&blocks).map_err(|e| LarkFfiError::ApiError { msg: e.to_string() })
    }

}

uniffi::setup_scaffolding!();

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_initialization_and_markdown_conversion() {
        let tmp = tempfile::tempdir().unwrap();
        let storage_path = tmp.path().to_string_lossy().to_string();
        let config = LarkAuthConfig {
            app_id: "cli_test_app_id".to_string(),
            app_secret: "cli_test_secret".to_string(),
        };
        let engine = LarkSyncEngine::new(config, storage_path).unwrap();
        let md = "# Title\n\nBody content";
        let json_result = engine.markdown_to_blocks_json(md.to_string());
        assert!(json_result.is_ok());
        let json_str = json_result.unwrap();
        assert!(json_str.contains("Title"));
    }
}
