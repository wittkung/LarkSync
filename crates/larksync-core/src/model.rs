// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 知识库空间元数据 (Wiki Space)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WikiSpace {
    pub space_id: String,
    pub name: String,
    pub description: String,
    pub space_type: String,
}

/// 拓扑节点类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeType {
    Document = 1,
    Folder = 2,
    ExternalLink = 3,
}

/// 知识库节点 (Wiki Node)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WikiNode {
    pub node_token: String,
    pub space_id: String,
    pub obj_token: String,
    pub obj_type: String,
    pub parent_node_token: Option<String>,
    pub title: String,
    pub has_child: bool,
    pub node_type: NodeType,
    pub obj_edit_time: Option<String>,
    pub revision: i64,
    pub content_hash: [u8; 32],
}

/// 飞书 DocX 块类型枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BlockType {
    Page = 1,
    Text = 2,
    Heading1 = 3,
    Heading2 = 4,
    Heading3 = 5,
    Heading4 = 6,
    Heading5 = 7,
    Heading6 = 8,
    Heading7 = 9,
    Heading8 = 10,
    Heading9 = 11,
    Bullet = 12,
    Ordered = 13,
    Code = 14,
    Quote = 15,
    Todo = 17,
    Callout = 19,
    Divider = 22,
    Image = 27,
    Table = 31,
    TableCell = 32,
    Grid = 33,
    GridColumn = 34,
    Equation = 35,
    Unknown = 999,
}

impl From<i32> for BlockType {
    fn from(val: i32) -> Self {
        match val {
            1 => BlockType::Page,
            2 => BlockType::Text,
            3 => BlockType::Heading1,
            4 => BlockType::Heading2,
            5 => BlockType::Heading3,
            6 => BlockType::Heading4,
            7 => BlockType::Heading5,
            8 => BlockType::Heading6,
            9 => BlockType::Heading7,
            10 => BlockType::Heading8,
            11 => BlockType::Heading9,
            12 => BlockType::Bullet,
            13 => BlockType::Ordered,
            14 => BlockType::Code,
            15 => BlockType::Quote,
            17 => BlockType::Todo,
            19 => BlockType::Callout,
            22 => BlockType::Divider,
            27 => BlockType::Image,
            31 => BlockType::Table,
            32 => BlockType::TableCell,
            33 => BlockType::Grid,
            34 => BlockType::GridColumn,
            35 => BlockType::Equation,
            _ => BlockType::Unknown,
        }
    }
}

/// 文本行内样式掩码
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct TextStyleMask {
    pub bold: bool,
    pub italic: bool,
    pub strikethrough: bool,
    pub underline: bool,
    pub inline_code: bool,
    pub text_color: Option<u8>,
    pub background_color: Option<u8>,
}

/// 行内文本 Run
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TextRun {
    pub content: String,
    pub style: TextStyleMask,
    pub link_url: Option<String>,
}

/// 飞书 DocX Block 实体
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DocxBlock {
    pub block_id: String,
    pub parent_id: Option<String>,
    pub children: Vec<String>,
    pub block_type: BlockType,
    pub text_runs: Vec<TextRun>,
    pub properties: HashMap<String, serde_json::Value>,
    pub revision: i64,
}

/// 3-Tree 同步差异动作
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

/// 同步进度事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProgressEvent {
    pub current_step: String,
    pub processed_items: u32,
    pub total_items: u32,
    pub current_item_name: String,
}
