// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

use crate::model::{WikiNode, SyncAction};
use std::collections::{HashMap, HashSet};

/// Dropbox Nucleus 3-Tree 同步差异计算器
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

    /// 执行 3-Tree 差异规划，产出结构化动作序列
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
                // 1. 本地新增，远端无，基准无 -> 上传新增
                (Some(l), None, None) => {
                    actions.push(SyncAction::UploadNew {
                        node_token: l.node_token.clone(),
                        local_path: format!("wiki/{}.md", l.title),
                    });
                }
                // 2. 远端新增，本地无，基准无 -> 下载新增
                (None, Some(r), None) => {
                    actions.push(SyncAction::DownloadNew {
                        node: r.clone(),
                        target_path: format!("wiki/{}.md", r.title),
                    });
                }
                // 3. 两端均存在
                (Some(l), Some(r), Some(s)) => {
                    let local_changed = l.content_hash != s.content_hash;
                    let remote_changed = r.content_hash != s.content_hash;

                    if local_changed && !remote_changed {
                        // 本地修改，远端未变 -> 上传修改
                        actions.push(SyncAction::UploadUpdate {
                            node_token: l.node_token.clone(),
                            local_path: format!("wiki/{}.md", l.title),
                        });
                    } else if !local_changed && remote_changed {
                        // 远端修改，本地未变 -> 下载更新
                        actions.push(SyncAction::DownloadUpdate {
                            node: r.clone(),
                            target_path: format!("wiki/{}.md", r.title),
                        });
                    } else if local_changed && remote_changed {
                        if l.content_hash == r.content_hash {
                            // L0 级内容幂等：内容相同，无需动作
                            actions.push(SyncAction::NoOp);
                        } else {
                            // L3 级冲突：生成伴生冲突文件
                            let timestamp = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();
                            let conflict_path = format!("wiki/{}.conflict-{}.md", l.title, timestamp);

                            actions.push(SyncAction::ConflictFork {
                                node_token: l.node_token.clone(),
                                local_path: format!("wiki/{}.md", l.title),
                                conflict_path,
                                remote_node: r.clone(),
                            });
                        }
                    }
                }
                // 4. 本地已删，远端未变 -> 远端删除
                (None, Some(_), Some(_)) => {
                    actions.push(SyncAction::RemoteDelete {
                        node_token: token.clone(),
                    });
                }
                // 5. 远端已删，本地未变 -> 本地删除
                (Some(l), None, Some(_)) => {
                    actions.push(SyncAction::LocalDelete {
                        path: format!("wiki/{}.md", l.title),
                    });
                }
                _ => {}
            }
        }

        actions
    }
}
