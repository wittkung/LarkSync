// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

pub mod limiter;

use anyhow::{anyhow, Result};
use limiter::AdaptiveRateLimiter;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use zeroize::Zeroizing;

use crate::model::{DocxBlock, NodeType, WikiNode, WikiSpace};

const MAX_RETRIES: u32 = 3;
const BASE_BACKOFF_MS: u64 = 500;

/// Feishu / Lark OpenAPI client with AIMD adaptive rate limiting, token caching, and HTTP 429 exponential backoff retry.
pub struct LarkApiClient {
    app_id: String,
    app_secret: Zeroizing<String>,
    client: Client,
    limiter: Arc<AdaptiveRateLimiter>,
    token_cache: Arc<RwLock<Option<(Zeroizing<String>, std::time::Instant)>>>,
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
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .connect_timeout(std::time::Duration::from_secs(10))
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            app_id,
            app_secret: Zeroizing::new(app_secret),
            client,
            limiter: Arc::new(AdaptiveRateLimiter::new(10)),
            token_cache: Arc::new(RwLock::new(None)),
        }
    }

    /// Executes an HTTP request with adaptive rate limiting and exponential backoff on HTTP 429.
    async fn execute_with_retry<F>(&self, make_request: F) -> Result<reqwest::Response>
    where
        F: Fn() -> reqwest::RequestBuilder,
    {
        let mut attempt = 0;
        loop {
            self.limiter.acquire().await;
            let resp = make_request().send().await?;

            if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                self.limiter.on_rate_limited();
                attempt += 1;
                if attempt > MAX_RETRIES {
                    return Err(anyhow!("Rate limit (HTTP 429) exceeded after {MAX_RETRIES} retries"));
                }

                let retry_after_sec = resp
                    .headers()
                    .get(reqwest::header::RETRY_AFTER)
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok());

                let backoff_ms = if let Some(secs) = retry_after_sec {
                    secs * 1000
                } else {
                    let exp = BASE_BACKOFF_MS * (1 << (attempt - 1));
                    let nanos = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.subsec_nanos() as u64)
                        .unwrap_or(0);
                    let jitter = nanos % (exp / 2 + 1);
                    exp + jitter
                };

                tokio::time::sleep(tokio::time::Duration::from_millis(backoff_ms)).await;
                continue;
            }

            self.limiter.on_success();
            return Ok(resp);
        }
    }

    /// Fetches or automatically refreshes the Tenant Access Token.
    pub async fn get_tenant_access_token(&self) -> Result<String> {
        {
            let cache = self.token_cache.read().await;
            if let Some((token, expiry)) = &*cache {
                if std::time::Instant::now() < *expiry {
                    return Ok((**token).clone());
                }
            }
        }

        let mut cache = self.token_cache.write().await;
        if let Some((token, expiry)) = &*cache {
            if std::time::Instant::now() < *expiry {
                return Ok((**token).clone());
            }
        }

        let url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
        let body = json!({
            "app_id": self.app_id,
            "app_secret": *self.app_secret
        });

        let resp = self
            .execute_with_retry(|| self.client.post(url).json(&body))
            .await?;

        let res: TenantAccessTokenResponse = resp.json().await?;
        if res.code != 0 {
            return Err(anyhow!("Feishu auth failed: {} (code {})", res.msg, res.code));
        }

        let token = res
            .tenant_access_token
            .ok_or_else(|| anyhow!("Empty token in response"))?;
        let expire_secs = res.expire.unwrap_or(7200).saturating_sub(300);
        let expiry = std::time::Instant::now() + std::time::Duration::from_secs(expire_secs);
        *cache = Some((Zeroizing::new(token.clone()), expiry));

        Ok(token)
    }

    /// Fetches all visible Wiki spaces.
    pub async fn fetch_spaces(&self) -> Result<Vec<WikiSpace>> {
        let token = self.get_tenant_access_token().await?;
        let url = "https://open.feishu.cn/open-apis/wiki/v2/spaces";

        let resp = self
            .execute_with_retry(|| {
                self.client
                    .get(url)
                    .header("Authorization", format!("Bearer {token}"))
            })
            .await?;

        let json_val: Value = resp.json().await?;

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

    /// Fetches a single page of Wiki nodes for a given space and parent.
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

        let resp = self
            .execute_with_retry(|| {
                self.client
                    .get(&url)
                    .header("Authorization", format!("Bearer {token}"))
            })
            .await?;

        let json_val: Value = resp.json().await?;

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

    /// Recursively traverses Wiki hierarchy using BFS queue to retrieve all nodes in a space.
    pub async fn fetch_all_nodes(&self, space_id: &str) -> Result<Vec<WikiNode>> {
        let mut all_nodes = Vec::new();
        let mut queue: VecDeque<Option<String>> = VecDeque::new();
        queue.push_back(None);

        while let Some(parent_token) = queue.pop_front() {
            let mut page_token = String::new();
            let mut has_more = true;

            while has_more {
                let (nodes, next_page, more) = self
                    .fetch_nodes_page(space_id, parent_token.as_deref(), &page_token)
                    .await?;

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

    /// Fetches all DocX blocks for a given document.
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

            let resp = self
                .execute_with_retry(|| {
                    self.client
                        .get(&url)
                        .header("Authorization", format!("Bearer {token}"))
                })
                .await?;

            let json_val: Value = resp.json().await?;

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

    /// Batch updates DocX blocks (insert, update, delete).
    pub async fn batch_update_docx_blocks(
        &self,
        document_id: &str,
        requests: Value,
    ) -> Result<()> {
        let token = self.get_tenant_access_token().await?;
        let url = format!("https://open.feishu.cn/open-apis/docx/v1/documents/{document_id}/blocks/batch_update");

        let resp = self
            .execute_with_retry(|| {
                self.client
                    .post(&url)
                    .header("Authorization", format!("Bearer {token}"))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .json(&requests)
            })
            .await?;

        let json_val: Value = resp.json().await?;

        let code = json_val["code"].as_i64().unwrap_or(-1);
        if code != 0 {
            let msg = json_val["msg"].as_str().unwrap_or("Unknown error");
            return Err(anyhow!("DocX BatchUpdate failed: {msg} (code {code})"));
        }

        Ok(())
    }

    /// Uploads local image to Feishu Drive to obtain a file_token.
    pub async fn upload_drive_media(
        &self,
        parent_token: &str,
        file_name: &str,
        file_bytes: Vec<u8>,
    ) -> Result<String> {
        let token = self.get_tenant_access_token().await?;
        let url = "https://open.feishu.cn/open-apis/drive/v1/medias/upload_all";

        let mut attempt = 0;
        loop {
            self.limiter.acquire().await;
            let form = reqwest::multipart::Form::new()
                .text("file_name", file_name.to_string())
                .text("parent_type", "docx_image")
                .text("parent_node", parent_token.to_string())
                .text("size", file_bytes.len().to_string())
                .part("file", reqwest::multipart::Part::bytes(file_bytes.clone()).file_name(file_name.to_string()));

            let resp = self
                .client
                .post(url)
                .header("Authorization", format!("Bearer {token}"))
                .multipart(form)
                .send()
                .await?;

            if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                self.limiter.on_rate_limited();
                attempt += 1;
                if attempt > MAX_RETRIES {
                    return Err(anyhow!("Rate limit (HTTP 429) exceeded during media upload after {MAX_RETRIES} retries"));
                }
                let exp = BASE_BACKOFF_MS * (1 << (attempt - 1));
                let nanos = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.subsec_nanos() as u64)
                    .unwrap_or(0);
                let jitter = nanos % (exp / 2 + 1);
                tokio::time::sleep(tokio::time::Duration::from_millis(exp + jitter)).await;
                continue;
            }

            self.limiter.on_success();

            let json_val: Value = resp.json().await?;
            let code = json_val["code"].as_i64().unwrap_or(-1);
            if code != 0 {
                let msg = json_val["msg"].as_str().unwrap_or("Upload failed");
                return Err(anyhow!("Drive media upload failed: {msg} (code {code})"));
            }

            let file_token = json_val["data"]["file_token"].as_str().unwrap_or_default().to_string();
            return Ok(file_token);
        }
    }
}
