// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

use crate::model::{SyncAction, WikiNode};
use crate::path_sanitizer::sanitize_document_filename;
use std::collections::{HashMap, HashSet};

/// Dropbox Nucleus style 3-Tree sync differential planning engine.
pub struct ThreeTreeDiffEngine {
    local_tree: HashMap<String, WikiNode>,
    remote_tree: HashMap<String, WikiNode>,
    synced_tree: HashMap<String, WikiNode>,
}

impl ThreeTreeDiffEngine {
    pub fn new(
        local_tree: HashMap<String, WikiNode>,
        remote_tree: HashMap<String, WikiNode>,
        synced_tree: HashMap<String, WikiNode>,
    ) -> Self {
        Self {
            local_tree,
            remote_tree,
            synced_tree,
        }
    }

    /// Computes 3-Tree differential plan and outputs structured synchronization actions.
    pub fn plan_sync(&self) -> Vec<SyncAction> {
        let mut actions = Vec::new();
        let mut all_tokens: HashSet<String> = HashSet::new();

        all_tokens.extend(self.local_tree.keys().cloned());
        all_tokens.extend(self.remote_tree.keys().cloned());
        all_tokens.extend(self.synced_tree.keys().cloned());

        for token in all_tokens {
            let local = self.local_tree.get(&token);
            let remote = self.remote_tree.get(&token);
            let synced = self.synced_tree.get(&token);

            match (local, remote, synced) {
                // 1. Added locally, absent on remote and base -> Upload new
                (Some(l), None, None) => {
                    let safe_title = sanitize_document_filename(&l.title, &l.node_token);
                    actions.push(SyncAction::UploadNew {
                        node_token: l.node_token.clone(),
                        local_path: format!("wiki/{safe_title}.md"),
                    });
                }
                // 2. Added on remote, absent locally and on base -> Download new
                (None, Some(r), None) => {
                    let safe_title = sanitize_document_filename(&r.title, &r.node_token);
                    actions.push(SyncAction::DownloadNew {
                        node: r.clone(),
                        target_path: format!("wiki/{safe_title}.md"),
                    });
                }
                // 3. Exists on both sides
                (Some(l), Some(r), Some(s)) => {
                    let local_changed = l.content_hash != s.content_hash;
                    let remote_changed = r.content_hash != s.content_hash;

                    let safe_l_title = sanitize_document_filename(&l.title, &l.node_token);
                    let safe_r_title = sanitize_document_filename(&r.title, &r.node_token);

                    if local_changed && !remote_changed {
                        // Modified locally, unchanged on remote -> Upload update
                        actions.push(SyncAction::UploadUpdate {
                            node_token: l.node_token.clone(),
                            local_path: format!("wiki/{safe_l_title}.md"),
                        });
                    } else if !local_changed && remote_changed {
                        // Modified on remote, unchanged locally -> Download update
                        actions.push(SyncAction::DownloadUpdate {
                            node: r.clone(),
                            target_path: format!("wiki/{safe_r_title}.md"),
                        });
                    } else if local_changed && remote_changed {
                        if l.content_hash == r.content_hash {
                            // L0 Idempotence: identical content hash -> No-op
                            actions.push(SyncAction::NoOp);
                        } else {
                            // L3 Conflict: fork companion conflict file
                            let timestamp = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();
                            let conflict_path = format!("wiki/{safe_l_title}.conflict-{timestamp}.md");

                            actions.push(SyncAction::ConflictFork {
                                node_token: l.node_token.clone(),
                                local_path: format!("wiki/{safe_l_title}.md"),
                                conflict_path,
                                remote_node: r.clone(),
                            });
                        }
                    }
                }
                // 4. Deleted locally, unchanged on remote -> Delete remote
                (None, Some(_), Some(_)) => {
                    actions.push(SyncAction::RemoteDelete {
                        node_token: token.clone(),
                    });
                }
                // 5. Deleted on remote, unchanged locally -> Delete local
                (Some(l), None, Some(_)) => {
                    let safe_title = sanitize_document_filename(&l.title, &l.node_token);
                    actions.push(SyncAction::LocalDelete {
                        path: format!("wiki/{safe_title}.md"),
                    });
                }
                _ => {}
            }
        }

        actions
    }
}

