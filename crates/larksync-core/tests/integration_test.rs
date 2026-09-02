// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

use larksync_core::converter::{DocxToMarkdownConverter, MarkdownToDocxConverter};
use larksync_core::diff::{ThreeTreeDiffEngine, Ast3WayMergeEngine, MergeResult};
use larksync_core::model::{WikiNode, NodeType, SyncAction, DocxBlock, BlockType, TextRun, TextStyleMask};
use larksync_core::storage::LocalMetadataStore;
use larksync_core::LarkCoreEngine;
use std::collections::HashMap;

#[test]
fn test_filter_subtree_recursive() {
    let nodes = vec![
        WikiNode {
            node_token: "root_1".to_string(),
            space_id: "s1".to_string(),
            obj_token: "o1".to_string(),
            obj_type: "folder".to_string(),
            parent_node_token: None,
            title: "开发架构".to_string(),
            has_child: true,
            node_type: NodeType::Folder,
            obj_edit_time: None,
            revision: 1,
            content_hash: [0u8; 32],
        },
        WikiNode {
            node_token: "child_1".to_string(),
            space_id: "s1".to_string(),
            obj_token: "o2".to_string(),
            obj_type: "docx".to_string(),
            parent_node_token: Some("root_1".to_string()),
            title: "微内核规范".to_string(),
            has_child: false,
            node_type: NodeType::Document,
            obj_edit_time: None,
            revision: 1,
            content_hash: [0u8; 32],
        },
        WikiNode {
            node_token: "root_2".to_string(),
            space_id: "s1".to_string(),
            obj_token: "o3".to_string(),
            obj_type: "docx".to_string(),
            parent_node_token: None,
            title: "产品市场分析".to_string(),
            has_child: false,
            node_type: NodeType::Document,
            obj_edit_time: None,
            revision: 1,
            content_hash: [0u8; 32],
        },
    ];

    // 1. Specified root_1 should only return root_1 and child_1
    let subtree = LarkCoreEngine::filter_subtree(&nodes, Some("root_1"));
    assert_eq!(subtree.len(), 2);
    assert!(subtree.iter().any(|n| n.node_token == "root_1"));
    assert!(subtree.iter().any(|n| n.node_token == "child_1"));
    assert!(!subtree.iter().any(|n| n.node_token == "root_2"));

    // 2. Without root_node_token, all nodes should be returned
    let all = LarkCoreEngine::filter_subtree(&nodes, None);
    assert_eq!(all.len(), 3);

}

#[test]
fn test_roundtrip_markdown_conversion() {
    let source_md = "# 架构设计\n\n这是第一段正文。\n\n## 子标题\n\n- [ ] 待办事项 1\n";
    let blocks = MarkdownToDocxConverter::convert(source_md);
    assert!(!blocks.is_empty());

    let converter = DocxToMarkdownConverter::new(blocks);
    let output_md = converter.convert("架构设计");
    assert!(output_md.contains("架构设计"));
    assert!(output_md.contains("这是第一段正文。"));
}

#[test]
fn test_three_tree_conflict_detection() {
    let mut local = HashMap::new();
    let mut remote = HashMap::new();
    let mut synced = HashMap::new();

    let base_node = WikiNode {
        node_token: "node_1".to_string(),
        space_id: "space_1".to_string(),
        obj_token: "obj_1".to_string(),
        obj_type: "docx".to_string(),
        parent_node_token: None,
        title: "测试文档".to_string(),
        has_child: false,
        node_type: NodeType::Document,
        obj_edit_time: None,
        revision: 1,
        content_hash: [1u8; 32],
    };

    synced.insert("node_1".to_string(), base_node.clone());

    let mut local_node = base_node.clone();
    local_node.content_hash = [2u8; 32];
    local.insert("node_1".to_string(), local_node);

    let mut remote_node = base_node.clone();
    remote_node.content_hash = [3u8; 32];
    remote.insert("node_1".to_string(), remote_node);

    let engine = ThreeTreeDiffEngine::new(local, remote, synced);
    let plan = engine.plan_sync();

    assert_eq!(plan.len(), 1);
    match &plan[0] {
        SyncAction::ConflictFork { node_token, .. } => {
            assert_eq!(node_token, "node_1");
        }
        _ => panic!("Expected ConflictFork action"),
    }
}

#[test]
fn test_sqlite_metadata_storage() {
    let store = LocalMetadataStore::in_memory().unwrap();
    let node = WikiNode {
        node_token: "token_100".to_string(),
        space_id: "space_main".to_string(),
        obj_token: "obj_100".to_string(),
        obj_type: "docx".to_string(),
        parent_node_token: None,
        title: "微内核规范".to_string(),
        has_child: false,
        node_type: NodeType::Document,
        obj_edit_time: Some("2026-08-26".to_string()),
        revision: 10,
        content_hash: [42u8; 32],
    };

    store.upsert_node(&node, Some("wiki/微内核规范.md")).unwrap();
    let tree = store.get_synced_tree("space_main").unwrap();

    assert_eq!(tree.len(), 1);
    assert_eq!(tree.get("token_100").unwrap().title, "微内核规范");
}

#[test]
fn test_3way_ast_merge_clean() {
    let base = vec![
        DocxBlock {
            block_id: "b1".to_string(),
            parent_id: None,
            children: vec![],
            block_type: BlockType::Text,
            text_runs: vec![TextRun { content: "Original".to_string(), style: TextStyleMask::default(), link_url: None }],
            properties: HashMap::new(),
            revision: 1,
        }
    ];

    let local = vec![
        DocxBlock {
            block_id: "b1".to_string(),
            parent_id: None,
            children: vec![],
            block_type: BlockType::Text,
            text_runs: vec![TextRun { content: "Original".to_string(), style: TextStyleMask::default(), link_url: None }],
            properties: HashMap::new(),
            revision: 1,
        },
        DocxBlock {
            block_id: "b2".to_string(),
            parent_id: None,
            children: vec![],
            block_type: BlockType::Text,
            text_runs: vec![TextRun { content: "Local Added".to_string(), style: TextStyleMask::default(), link_url: None }],
            properties: HashMap::new(),
            revision: 1,
        }
    ];

    let remote = vec![
        DocxBlock {
            block_id: "b1".to_string(),
            parent_id: None,
            children: vec![],
            block_type: BlockType::Text,
            text_runs: vec![TextRun { content: "Remote Modified".to_string(), style: TextStyleMask::default(), link_url: None }],
            properties: HashMap::new(),
            revision: 2,
        }
    ];

    let res = Ast3WayMergeEngine::merge(&base, &local, &remote);
    match res {
        MergeResult::Clean(blocks) => {
            assert_eq!(blocks.len(), 2);
            assert_eq!(blocks[0].text_runs[0].content, "Remote Modified");
            assert_eq!(blocks[1].text_runs[0].content, "Local Added");
        }
        MergeResult::Conflict { .. } => panic!("Expected clean merge"),
    }
}
