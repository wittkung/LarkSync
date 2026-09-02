// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

use anyhow::Result;
use rusqlite::{params, Connection};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use crate::model::{WikiNode, NodeType, DocxBlock};

/// SQLite WAL local state and shadow AST block mapping repository.
pub struct LocalMetadataStore {
    conn: Arc<Mutex<Connection>>,
}

impl LocalMetadataStore {
    pub fn open(db_path: String) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        Self::init_tables(&conn)?;
        Ok(Self { conn: Arc::new(Mutex::new(conn)) })
    }

    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        Self::init_tables(&conn)?;
        Ok(Self { conn: Arc::new(Mutex::new(conn)) })
    }

    fn init_tables(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             
             CREATE TABLE IF NOT EXISTS wiki_nodes (
                 node_token TEXT PRIMARY KEY,
                 space_id TEXT NOT NULL,
                 obj_token TEXT NOT NULL,
                 obj_type TEXT NOT NULL,
                 parent_node_token TEXT,
                 title TEXT NOT NULL,
                 has_child INTEGER NOT NULL,
                 node_type INTEGER NOT NULL,
                 obj_edit_time TEXT,
                 revision INTEGER NOT NULL,
                 content_hash BLOB NOT NULL,
                 local_relative_path TEXT
             );
             
             CREATE INDEX IF NOT EXISTS idx_wiki_space ON wiki_nodes(space_id);
             
             CREATE TABLE IF NOT EXISTS shadow_blocks (
                 node_token TEXT NOT NULL,
                 block_id TEXT NOT NULL,
                 parent_block_id TEXT,
                 block_type INTEGER NOT NULL,
                 content_hash BLOB NOT NULL,
                 block_order INTEGER NOT NULL,
                 PRIMARY KEY (node_token, block_id)
             );
             
             CREATE INDEX IF NOT EXISTS idx_shadow_node ON shadow_blocks(node_token);
             
             CREATE TABLE IF NOT EXISTS sync_conflicts (
                 conflict_id TEXT PRIMARY KEY,
                 node_token TEXT NOT NULL,
                 base_hash BLOB NOT NULL,
                 local_hash BLOB NOT NULL,
                 remote_hash BLOB NOT NULL,
                 created_at TEXT NOT NULL
             );"
        )?;
        Ok(())
    }

    /// Inserts or updates node metadata.
    pub fn upsert_node(&self, node: &WikiNode, local_path: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let node_type_int = match node.node_type {
            NodeType::Document => 1,
            NodeType::Folder => 2,
            NodeType::ExternalLink => 3,
        };

        conn.execute(
            "INSERT INTO wiki_nodes (
                node_token, space_id, obj_token, obj_type, parent_node_token,
                title, has_child, node_type, obj_edit_time, revision,
                content_hash, local_relative_path
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ON CONFLICT(node_token) DO UPDATE SET
                title = excluded.title,
                has_child = excluded.has_child,
                obj_edit_time = excluded.obj_edit_time,
                revision = excluded.revision,
                content_hash = excluded.content_hash,
                local_relative_path = excluded.local_relative_path",
            params![
                node.node_token,
                node.space_id,
                node.obj_token,
                node.obj_type,
                node.parent_node_token,
                node.title,
                if node.has_child { 1 } else { 0 },
                node_type_int,
                node.obj_edit_time,
                node.revision,
                &node.content_hash[..],
                local_path
            ],
        )?;

        Ok(())
    }

    /// Fetches all synchronized nodes for a given space.
    pub fn get_synced_tree(&self, space_id: &str) -> Result<HashMap<String, WikiNode>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT node_token, space_id, obj_token, obj_type, parent_node_token,
                    title, has_child, node_type, obj_edit_time, revision, content_hash
             FROM wiki_nodes WHERE space_id = ?1"
        )?;

        let mut map = HashMap::new();
        let rows = stmt.query_map(params![space_id], |row| {
            let node_type_int: i32 = row.get(7)?;
            let node_type = match node_type_int {
                2 => NodeType::Folder,
                3 => NodeType::ExternalLink,
                _ => NodeType::Document,
            };
            let hash_blob: Vec<u8> = row.get(10)?;
            let mut content_hash = [0u8; 32];
            if hash_blob.len() == 32 {
                content_hash.copy_from_slice(&hash_blob);
            }

            Ok(WikiNode {
                node_token: row.get(0)?,
                space_id: row.get(1)?,
                obj_token: row.get(2)?,
                obj_type: row.get(3)?,
                parent_node_token: row.get(4)?,
                title: row.get(5)?,
                has_child: row.get::<_, i32>(6)? == 1,
                node_type,
                obj_edit_time: row.get(8)?,
                revision: row.get(9)?,
                content_hash,
            })
        })?;

        for r in rows {
            let node = r?;
            map.insert(node.node_token.clone(), node);
        }

        Ok(map)
    }

    /// Persists shadow blocks snapshot for mapping cloud block IDs.
    pub fn save_shadow_blocks(&self, node_token: &str, blocks: &[DocxBlock]) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        tx.execute("DELETE FROM shadow_blocks WHERE node_token = ?1", params![node_token])?;

        for (order, block) in blocks.iter().enumerate() {
            let serialized = serde_json::to_string(&block).unwrap_or_default();
            let hash = blake3::hash(serialized.as_bytes());
            
            tx.execute(
                "INSERT INTO shadow_blocks (
                    node_token, block_id, parent_block_id, block_type, content_hash, block_order
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    node_token,
                    block.block_id,
                    block.parent_id,
                    block.block_type as i32,
                    hash.as_bytes(),
                    order as i32
                ],
            )?;
        }

        tx.commit()?;
        Ok(())
    }
}

