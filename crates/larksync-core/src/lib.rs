// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

pub mod client;
pub mod converter;
pub mod diff;
pub mod model;
pub mod archive;
pub mod storage;

use anyhow::Result;
use archive::StreamingArchivePacker;
use client::LarkApiClient;
use converter::{DocxToMarkdownConverter, MarkdownToDocxConverter};
use diff::{ThreeTreeDiffEngine, Ast3WayMergeEngine, MergeResult};
use model::{WikiNode, WikiSpace, DocxBlock, SyncAction, SyncProgressEvent};
use storage::LocalMetadataStore;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

/// LarkSync 纯 Rust 核心引擎
pub struct LarkCoreEngine {
    client: Arc<LarkApiClient>,
    pub storage: Arc<LocalMetadataStore>,
    pub storage_path: String,
}

impl LarkCoreEngine {
    pub fn init(app_id: String, app_secret: String, storage_path: String) -> Result<Self> {
        let client = Arc::new(LarkApiClient::new(app_id, app_secret));
        let db_file = format!("{storage_path}/larksync.db");
        std::fs::create_dir_all(&storage_path).ok();
        let storage = Arc::new(LocalMetadataStore::open(db_file).unwrap_or_else(|_| LocalMetadataStore::in_memory().unwrap()));
        Ok(Self { client, storage, storage_path })
    }

    /// 获取可见空间列表
    pub async fn fetch_spaces(&self) -> Result<Vec<WikiSpace>> {
        self.client.fetch_spaces().await
    }

    /// 获取知识库树
    pub async fn fetch_wiki_tree(&self, space_id: &str) -> Result<Vec<WikiNode>> {
        self.client.fetch_all_nodes(space_id).await
    }

    /// 拉取单个 DocX 文档的块树
    pub async fn fetch_docx_blocks(&self, document_id: &str) -> Result<Vec<DocxBlock>> {
        self.client.fetch_docx_blocks(document_id).await
    }

    /// 执行 3-Tree 差异规划
    pub fn compute_sync_plan(
        &self,
        local: HashMap<String, WikiNode>,
        remote: HashMap<String, WikiNode>,
        synced: HashMap<String, WikiNode>,
    ) -> Vec<SyncAction> {
        let engine = ThreeTreeDiffEngine::new(local, remote, synced);
        engine.plan_sync()
    }

    /// 执行 3-Way AST 块级合并
    pub fn merge_ast_blocks(
        &self,
        base: &[DocxBlock],
        local: &[DocxBlock],
        remote: &[DocxBlock],
    ) -> MergeResult {
        Ast3WayMergeEngine::merge(base, local, remote)
    }

    /// DocX Blocks -> Markdown
    pub fn convert_blocks_to_markdown(&self, title: &str, blocks: Vec<DocxBlock>) -> String {
        let converter = DocxToMarkdownConverter::new(blocks);
        converter.convert(title)
    }

    /// Markdown -> DocX Blocks
    pub fn convert_markdown_to_blocks(&self, markdown: &str) -> Vec<DocxBlock> {
        MarkdownToDocxConverter::convert(markdown)
    }

    /// 拓扑子树过滤器：仅提取指定根目录及其所有递归后代节点
    pub fn filter_subtree(nodes: &[WikiNode], root_token: Option<&str>) -> Vec<WikiNode> {
        let Some(root) = root_token else {
            return nodes.to_vec();
        };

        let mut children_map: HashMap<String, Vec<String>> = HashMap::new();
        let mut node_map: HashMap<String, WikiNode> = HashMap::new();

        for n in nodes {
            node_map.insert(n.node_token.clone(), n.clone());
            if let Some(parent) = &n.parent_node_token {
                children_map.entry(parent.clone()).or_default().push(n.node_token.clone());
            }
        }

        let mut matched_tokens = HashSet::new();
        let mut queue = vec![root.to_string()];

        while let Some(current) = queue.pop() {
            matched_tokens.insert(current.clone());
            if let Some(children) = children_map.get(&current) {
                for child in children {
                    if !matched_tokens.contains(child) {
                        queue.push(child.clone());
                    }
                }
            }
        }

        nodes.iter().filter(|n| matched_tokens.contains(&n.node_token)).cloned().collect()
    }

    /// 全自动端到端增量同步拉取 (Pull)，支持选择性同步指定子树目录
    pub async fn sync_pull_space<F>(
        &self,
        space_id: &str,
        root_node_token: Option<&str>,
        target_dir: &str,
        on_progress: F,
    ) -> Result<u32>
    where
        F: Fn(SyncProgressEvent) + Send + Sync,
    {
        let target_dir_owned = target_dir.to_string();
        tokio::task::spawn_blocking(move || std::fs::create_dir_all(&target_dir_owned)).await??;
        let remote_nodes = self.fetch_wiki_tree(space_id).await?;
        let filtered_nodes = Self::filter_subtree(&remote_nodes, root_node_token);
        let total = filtered_nodes.len() as u32;

        let mut processed = 0;
        for node in &filtered_nodes {
            processed += 1;
            on_progress(SyncProgressEvent {
                current_step: "拉取文档".to_string(),
                processed_items: processed,
                total_items: total,
                current_item_name: node.title.clone(),
            });

            if node.obj_type == "docx" {
                let blocks = self.client.fetch_docx_blocks(&node.obj_token).await.unwrap_or_default();
                let markdown = self.convert_blocks_to_markdown(&node.title, blocks);
                
                let file_path = format!("{target_dir}/{}.md", node.title);
                let storage = self.storage.clone();
                let mut updated_node = node.clone();
                let hash = blake3::hash(markdown.as_bytes());
                updated_node.content_hash = *hash.as_bytes();

                tokio::task::spawn_blocking(move || -> Result<()> {
                    std::fs::write(&file_path, markdown.as_bytes())?;
                    storage.upsert_node(&updated_node, Some(&file_path))?;
                    Ok(())
                }).await??;
            }
        }

        Ok(processed)
    }

    /// 零落地内存流式打包：支持选择性导出指定子树目录
    pub async fn export_space_to_ttzip<F>(
        &self,
        space_id: &str,
        root_node_token: Option<&str>,
        output_path: &str,
        on_progress: F,
    ) -> Result<()>
    where
        F: Fn(SyncProgressEvent) + Send + Sync,
    {
        let output_path_owned = output_path.to_string();
        let packer = tokio::task::spawn_blocking(move || {
            StreamingArchivePacker::create(&output_path_owned, 3)
        }).await??;
        let packer = Arc::new(std::sync::Mutex::new(packer));

        let remote_nodes = self.fetch_wiki_tree(space_id).await?;
        let filtered_nodes = Self::filter_subtree(&remote_nodes, root_node_token);
        let total = filtered_nodes.len() as u32;

        let mut processed = 0;
        for node in &filtered_nodes {
            processed += 1;
            on_progress(SyncProgressEvent {
                current_step: "流式打包".to_string(),
                processed_items: processed,
                total_items: total,
                current_item_name: node.title.clone(),
            });

            if node.obj_type == "docx" {
                let blocks = self.client.fetch_docx_blocks(&node.obj_token).await.unwrap_or_default();
                let markdown = self.convert_blocks_to_markdown(&node.title, blocks);
                let virtual_path = format!("{}.md", node.title);
                let packer_clone = packer.clone();
                tokio::task::spawn_blocking(move || -> Result<()> {
                    let mut guard = packer_clone.lock().map_err(|_| anyhow::anyhow!("Packer lock poisoned"))?;
                    guard.append_file_data(&virtual_path, markdown.as_bytes())
                }).await??;
            }
        }

        tokio::task::spawn_blocking(move || -> Result<()> {
            let p = Arc::try_unwrap(packer)
                .map_err(|_| anyhow::anyhow!("Failed to unwrap packer reference"))?
                .into_inner()
                .map_err(|_| anyhow::anyhow!("Packer mutex poisoned"))?;
            p.finish()
        }).await??;

        Ok(())
    }
}
