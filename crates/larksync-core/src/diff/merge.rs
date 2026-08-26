// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

use crate::model::DocxBlock;
use std::collections::HashMap;

/// 3-Way AST 块级语义合并结果
#[derive(Debug, PartialEq)]
pub enum MergeResult {
    /// 自动合并成功
    Clean(Vec<DocxBlock>),
    /// 存在无法调和的并发冲突
    Conflict {
        merged_blocks: Vec<DocxBlock>,
        conflict_block_ids: Vec<String>,
    },
}

/// 3-Way Block AST 合并引擎
pub struct Ast3WayMergeEngine;

impl Ast3WayMergeEngine {
    pub fn merge(
        base_blocks: &[DocxBlock],
        local_blocks: &[DocxBlock],
        remote_blocks: &[DocxBlock],
    ) -> MergeResult {
        let base_map: HashMap<String, &DocxBlock> = base_blocks.iter().map(|b| (b.block_id.clone(), b)).collect();
        let local_map: HashMap<String, &DocxBlock> = local_blocks.iter().map(|b| (b.block_id.clone(), b)).collect();
        let remote_map: HashMap<String, &DocxBlock> = remote_blocks.iter().map(|b| (b.block_id.clone(), b)).collect();

        let mut merged_blocks = Vec::new();
        let mut conflict_block_ids = Vec::new();

        // 收集所有涉及的 block_id
        let mut all_ids: Vec<String> = Vec::new();
        for b in local_blocks {
            if !all_ids.contains(&b.block_id) { all_ids.push(b.block_id.clone()); }
        }
        for b in remote_blocks {
            if !all_ids.contains(&b.block_id) { all_ids.push(b.block_id.clone()); }
        }

        for id in all_ids {
            let base = base_map.get(&id).copied();
            let local = local_map.get(&id).copied();
            let remote = remote_map.get(&id).copied();

            match (base, local, remote) {
                // 1. 只有本地新增
                (None, Some(l), None) => {
                    merged_blocks.push(l.clone());
                }
                // 2. 只有远端新增
                (None, None, Some(r)) => {
                    merged_blocks.push(r.clone());
                }
                // 3. 两端均新增
                (None, Some(l), Some(r)) => {
                    if l == r {
                        merged_blocks.push(l.clone());
                    } else {
                        conflict_block_ids.push(id);
                        merged_blocks.push(l.clone()); // 暂留本地版本
                    }
                }
                // 4. 三端均存在
                (Some(b), Some(l), Some(r)) => {
                    let local_changed = l != b;
                    let remote_changed = r != b;

                    if local_changed && !remote_changed {
                        // 仅本地修改
                        merged_blocks.push(l.clone());
                    } else if !local_changed && remote_changed {
                        // 仅远端修改
                        merged_blocks.push(r.clone());
                    } else if !local_changed && !remote_changed {
                        // 两端均未修改
                        merged_blocks.push(b.clone());
                    } else {
                        // 两端均有修改
                        if l == r {
                            merged_blocks.push(l.clone());
                        } else {
                            conflict_block_ids.push(id);
                            merged_blocks.push(l.clone());
                        }
                    }
                }
                // 5. 本地删除，远端未变
                (Some(b), None, Some(r)) if b == r => {
                    // 保留删除
                }
                // 6. 远端删除，本地未变
                (Some(b), Some(l), None) if b == l => {
                    // 保留删除
                }
                // 7. 一端删除，另一端修改
                (Some(_), Some(l), None) => {
                    conflict_block_ids.push(id);
                    merged_blocks.push(l.clone());
                }
                (Some(_), None, Some(r)) => {
                    conflict_block_ids.push(id);
                    merged_blocks.push(r.clone());
                }
                _ => {}
            }
        }

        if conflict_block_ids.is_empty() {
            MergeResult::Clean(merged_blocks)
        } else {
            MergeResult::Conflict {
                merged_blocks,
                conflict_block_ids,
            }
        }
    }
}
