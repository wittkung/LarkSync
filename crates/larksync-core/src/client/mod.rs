// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

pub mod limiter;

use anyhow::{anyhow, Result};
use limiter::AdaptiveRateLimiter;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::model::{DocxBlock, WikiNode, WikiSpace, NodeType};

/// 飞书 OpenAPI 客户端 (集成 AIMD 自适应流控与 Token 自动续期)
pub struct LarkApiClient {
    app_id: String,
    app_secret: String,
    client: Client,
    limiter: Arc<AdaptiveRateLimiter>,
    token_cache: Arc<RwLock<Option<(String, std::time::Instant)>>>,
}

#[derive(Deserialize)]
struct TenantAccessTokenResponse {
    code: i32,
    msg: String,
    tenant_access_token: Option<String>,
    expire: Option<u64>,
}

impl LarkApiClient {
    pub fn new(app_id: String, app_secret: String) -> Self {
        Self {
            app_id,
            app_secret,
            client: Client::builder().build().unwrap(),
            limiter: Arc::new(AdaptiveRateLimiter::new(10)),
            token_cache: Arc::new(RwLock::new(None)),
        }
    }

    /// 获取或自动刷新 Tenant Access Token
    pub async fn get_tenant_access_token(&self) -> Result<String> {
        {
            let cache = self.token_cache.read().await;
            if let Some((token, expiry)) = &*cache {
                if std::time::Instant::now() < *expiry {
                    return Ok(token.clone());
                }
            }
        }

        let mut cache = self.token_cache.write().await;
        if let Some((token, expiry)) = &*cache {
            if std::time::Instant::now() < *expiry {
                return Ok(token.clone());
            }
        }

        let url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
        let body = json!({
            "app_id": self.app_id,
            "app_secret": self.app_secret
        });

        self.limiter.acquire().await;
        let resp = self.client.post(url).json(&body).send().await?;
        if resp.status() == 429 {
            self.limiter.on_rate_limited();
            return Err(anyhow!("Rate limited (429) while fetching token"));
        }

        let res: TenantAccessTokenResponse = resp.json().await?;
        if res.code != 0 {
            return Err(anyhow!("Feishu auth failed: {} (code {})", res.msg, res.code));
        }

        self.limiter.on_success();
        let token = res.tenant_access_token.ok_or_else(|| anyhow!("Empty token in response"))?;
        let expire_secs = res.expire.unwrap_or(7200).saturating_sub(300); // 提前 5 分钟刷新
        let expiry = std::time::Instant::now() + std::time::Duration::from_secs(expire_secs);
        *cache = Some((token.clone(), expiry));

        Ok(token)
    }

    /// 获取所有可见的知识库空间
    pub async fn fetch_spaces(&self) -> Result<Vec<WikiSpace>> {
        let token = self.get_tenant_access_token().await?;
        let url = "https://open.feishu.cn/open-apis/wiki/v2/spaces";
        
        self.limiter.acquire().await;
        let resp = self.client.get(url)
            .header("Authorization", format!("Bearer {token}"))
            .send().await?;

        if resp.status() == 429 {
            self.limiter.on_rate_limited();
            return Err(anyhow!("Rate limit hit while fetching spaces"));
        }

        let json_val: Value = resp.json().await?;
        self.limiter.on_success();

        let mut spaces = Vec::new();
        if let Some(items) = json_val["data"]["items"].as_array() {
            for item in items {
                spaces.push(WikiSpace {
                    space_id: item["space_id"].as_str().unwrap_or_default().to_string(),
                    name: item["name"].as_str().unwrap_or_default().to_string(),
                    description: item["description"].as_str().unwrap_or_default().to_string(),
                    space_type: item["space_type"].as_str().unwrap_or_default().to_string(),
                });
            }
        }

        Ok(spaces)
    }

    /// 获取指定层级的一页节点列表
    pub async fn fetch_nodes_page(
        &self,
        space_id: &str,
        parent_node_token: Option<&str>,
        page_token: &str,
    ) -> Result<(Vec<WikiNode>, String, bool)> {
        let token = self.get_tenant_access_token().await?;
        let mut url = format!("https://open.feishu.cn/open-apis/wiki/v2/spaces/{space_id}/nodes?page_size=50");
        if !page_token.is_empty() {
            url.push_str(&format!("&page_token={page_token}"));
        }
        if let Some(parent) = parent_node_token {
            url.push_str(&format!("&parent_node_token={parent}"));
        }

        self.limiter.acquire().await;
        let resp = self.client.get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send().await?;

        if resp.status() == 429 {
            self.limiter.on_rate_limited();
            return Err(anyhow!("Rate limit hit while fetching nodes"));
        }

        let json_val: Value = resp.json().await?;
        self.limiter.on_success();

        let mut nodes = Vec::new();
        if let Some(items) = json_val["data"]["items"].as_array() {
            for item in items {
                let node_type_int = item["node_type"].as_i64().unwrap_or(1);
                let node_type = match node_type_int {
                    2 => NodeType::Folder,
                    3 => NodeType::ExternalLink,
                    _ => NodeType::Document,
                };

                nodes.push(WikiNode {
                    node_token: item["node_token"].as_str().unwrap_or_default().to_string(),
                    space_id: space_id.to_string(),
                    obj_token: item["obj_token"].as_str().unwrap_or_default().to_string(),
                    obj_type: item["obj_type"].as_str().unwrap_or_default().to_string(),
                    parent_node_token: item["parent_node_token"].as_str().map(|s| s.to_string()),
                    title: item["title"].as_str().unwrap_or_default().to_string(),
                    has_child: item["has_child"].as_bool().unwrap_or(false),
                    node_type,
                    obj_edit_time: item["obj_edit_time"].as_str().map(|s| s.to_string()),
                    revision: 1,
                    content_hash: [0u8; 32],
                });
            }
        }

        let next_page_token = json_val["data"]["page_token"].as_str().unwrap_or_default().to_string();
        let has_more = json_val["data"]["has_more"].as_bool().unwrap_or(false);

        Ok((nodes, next_page_token, has_more))
    }

    /// 全量 BFS 队列递归遍历：拉取指定空间下的所有层级节点（彻底解决多层子目录漏抓缺陷）
    pub async fn fetch_all_nodes(&self, space_id: &str) -> Result<Vec<WikiNode>> {
        let mut all_nodes = Vec::new();
        let mut queue: VecDeque<Option<String>> = VecDeque::new();
        queue.push_back(None); // None 代表空间根层级

        while let Some(parent_token) = queue.pop_front() {
            let mut page_token = String::new();
            let mut has_more = true;

            while has_more {
                let (nodes, next_page, more) = self.fetch_nodes_page(
                    space_id,
                    parent_token.as_deref(),
                    &page_token,
                ).await?;

                for node in &nodes {
                    if node.has_child {
                        queue.push_back(Some(node.node_token.clone()));
                    }
                }

                all_nodes.extend(nodes);
                page_token = next_page;
                has_more = more;
            }
        }

        Ok(all_nodes)
    }

    /// 拉取单个 DocX 文档的全部块 (Blocks)
    pub async fn fetch_docx_blocks(&self, document_id: &str) -> Result<Vec<DocxBlock>> {
        let token = self.get_tenant_access_token().await?;
        let mut blocks = Vec::new();
        let mut page_token = String::new();
        let mut has_more = true;

        while has_more {
            let mut url = format!("https://open.feishu.cn/open-apis/docx/v1/documents/{document_id}/blocks?page_size=100");
            if !page_token.is_empty() {
                url.push_str(&format!("&page_token={page_token}"));
            }

            self.limiter.acquire().await;
            let resp = self.client.get(&url)
                .header("Authorization", format!("Bearer {token}"))
                .send().await?;

            if resp.status() == 429 {
                self.limiter.on_rate_limited();
                return Err(anyhow!("Rate limit hit while fetching docx blocks"));
            }

            let json_val: Value = resp.json().await?;
            self.limiter.on_success();

            if let Some(items) = json_val["data"]["items"].as_array() {
                for item in items {
                    if let Ok(block) = serde_json::from_value::<DocxBlock>(item.clone()) {
                        blocks.push(block);
                    }
                }
            }

            page_token = json_val["data"]["page_token"].as_str().unwrap_or_default().to_string();
            has_more = json_val["data"]["has_more"].as_bool().unwrap_or(false);
        }

        Ok(blocks)
    }

    /// 飞书 DocX 批量更新 API：支持批量插入、更新与删除块 (BatchUpdateDocx)
    pub async fn batch_update_docx_blocks(
        &self,
        document_id: &str,
        requests: Value,
    ) -> Result<()> {
        let token = self.get_tenant_access_token().await?;
        let url = format!("https://open.feishu.cn/open-apis/docx/v1/documents/{document_id}/blocks/batch_update");

        self.limiter.acquire().await;
        let resp = self.client.post(&url)
            .header("Authorization", format!("Bearer {token}"))
            .header("Content-Type", "application/json; charset=utf-8")
            .json(&requests)
            .send().await?;

        if resp.status() == 429 {
            self.limiter.on_rate_limited();
            return Err(anyhow!("Rate limit hit during batch_update_docx_blocks"));
        }

        let json_val: Value = resp.json().await?;
        self.limiter.on_success();

        let code = json_val["code"].as_i64().unwrap_or(-1);
        if code != 0 {
            let msg = json_val["msg"].as_str().unwrap_or("Unknown error");
            return Err(anyhow!("DocX BatchUpdate failed: {msg} (code {code})"));
        }

        Ok(())
    }

    /// 上传本地图片到飞书 Drive 换取 file_token
    pub async fn upload_drive_media(
        &self,
        parent_token: &str,
        file_name: &str,
        file_bytes: Vec<u8>,
    ) -> Result<String> {
        let token = self.get_tenant_access_token().await?;
        let url = "https://open.feishu.cn/open-apis/drive/v1/medias/upload_all";

        let form = reqwest::multipart::Form::new()
            .text("file_name", file_name.to_string())
            .text("parent_type", "docx_image")
            .text("parent_node", parent_token.to_string())
            .text("size", file_bytes.len().to_string())
            .part("file", reqwest::multipart::Part::bytes(file_bytes).file_name(file_name.to_string()));

        self.limiter.acquire().await;
        let resp = self.client.post(url)
            .header("Authorization", format!("Bearer {token}"))
            .multipart(form)
            .send().await?;

        if resp.status() == 429 {
            self.limiter.on_rate_limited();
            return Err(anyhow!("Rate limit hit during media upload"));
        }

        let json_val: Value = resp.json().await?;
        self.limiter.on_success();

        let code = json_val["code"].as_i64().unwrap_or(-1);
        if code != 0 {
            let msg = json_val["msg"].as_str().unwrap_or("Upload failed");
            return Err(anyhow!("Drive media upload failed: {msg} (code {code})"));
        }

        let file_token = json_val["data"]["file_token"].as_str().unwrap_or_default().to_string();
        Ok(file_token)
    }
}
