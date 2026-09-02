// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

use crate::model::DocxBlock;
use std::collections::HashMap;

/// 3-Way AST block-level semantic merge result.
#[derive(Debug, PartialEq)]
pub enum MergeResult {
    /// Automatic clean merge without conflicts.
    Clean(Vec<DocxBlock>),
    /// Concurrent conflicts present.
    Conflict {
        merged_blocks: Vec<DocxBlock>,
        conflict_block_ids: Vec<String>,
    },
}

/// 3-Way Block AST merge engine.
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

        // Collect all involved block IDs
        let mut all_ids: Vec<String> = Vec::new();
        for b in local_blocks {
            if !all_ids.contains(&b.block_id) {
                all_ids.push(b.block_id.clone());
            }
        }
        for b in remote_blocks {
            if !all_ids.contains(&b.block_id) {
                all_ids.push(b.block_id.clone());
            }
        }

        for id in all_ids {
            let base = base_map.get(&id).copied();
            let local = local_map.get(&id).copied();
            let remote = remote_map.get(&id).copied();

            match (base, local, remote) {
                // 1. Added locally only
                (None, Some(l), None) => {
                    merged_blocks.push(l.clone());
                }
                // 2. Added on remote only
                (None, None, Some(r)) => {
                    merged_blocks.push(r.clone());
                }
                // 3. Added on both sides
                (None, Some(l), Some(r)) => {
                    if l == r {
                        merged_blocks.push(l.clone());
                    } else {
                        conflict_block_ids.push(id);
                        merged_blocks.push(l.clone());
                    }
                }
                // 4. Exists across all three states
                (Some(b), Some(l), Some(r)) => {
                    let local_changed = l != b;
                    let remote_changed = r != b;

                    if local_changed && !remote_changed {
                        // Modified locally only
                        merged_blocks.push(l.clone());
                    } else if !local_changed && remote_changed {
                        // Modified on remote only
                        merged_blocks.push(r.clone());
                    } else if !local_changed && !remote_changed {
                        // Unmodified on both sides
                        merged_blocks.push(b.clone());
                    } else {
                        // Modified on both sides
                        if l == r {
                            merged_blocks.push(l.clone());
                        } else {
                            conflict_block_ids.push(id);
                            merged_blocks.push(l.clone());
                        }
                    }
                }
                // 5. Deleted locally, unchanged on remote
                (Some(b), None, Some(r)) if b == r => {
                    // Keep deletion
                }
                // 6. Deleted on remote, unchanged locally
                (Some(b), Some(l), None) if b == l => {
                    // Keep deletion
                }
                // 7. Deleted on one side, modified on another
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

