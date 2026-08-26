// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

use crate::model::{DocxBlock, BlockType, TextRun};
use std::collections::HashMap;

/// 将 DocX Block 树转换为符合 CommonMark/GFM 规范的高保真 Markdown 文本
pub struct DocxToMarkdownConverter {
    block_map: HashMap<String, DocxBlock>,
}

impl DocxToMarkdownConverter {
    pub fn new(blocks: Vec<DocxBlock>) -> Self {
        let mut block_map = HashMap::new();
        for b in blocks {
            block_map.insert(b.block_id.clone(), b);
        }
        Self { block_map }
    }

    pub fn convert(&self, title: &str) -> String {
        let mut out = format!("# {title}\n\n");
        
        // 查找 PAGE 根节点
        let root = self.block_map.values().find(|b| b.block_type == BlockType::Page);
        if let Some(r) = root {
            for child_id in &r.children {
                self.render_block(child_id, &mut out, 0);
            }
        } else {
            // 降级：遍历所有非 Page 块
            for block in self.block_map.values() {
                if block.block_type != BlockType::Page {
                    self.render_block_content(block, &mut out, 0);
                }
            }
        }
        out
    }

    fn render_block(&self, block_id: &str, out: &mut String, depth: usize) {
        if let Some(block) = self.block_map.get(block_id) {
            self.render_block_content(block, out, depth);
        }
    }

    fn render_block_content(&self, block: &DocxBlock, out: &mut String, depth: usize) {
        let indent = "  ".repeat(depth);
        let text = self.render_text_runs(&block.text_runs);

        match block.block_type {
            BlockType::Text => {
                out.push_str(&format!("{indent}{text}\n\n"));
            }
            BlockType::Heading1 => {
                out.push_str(&format!("# {text}\n\n"));
            }
            BlockType::Heading2 => {
                out.push_str(&format!("## {text}\n\n"));
            }
            BlockType::Heading3 => {
                out.push_str(&format!("### {text}\n\n"));
            }
            BlockType::Heading4 => {
                out.push_str(&format!("#### {text}\n\n"));
            }
            BlockType::Heading5 => {
                out.push_str(&format!("##### {text}\n\n"));
            }
            BlockType::Heading6 => {
                out.push_str(&format!("###### {text}\n\n"));
            }
            BlockType::Bullet => {
                out.push_str(&format!("{indent}- {text}\n"));
            }
            BlockType::Ordered => {
                out.push_str(&format!("{indent}1. {text}\n"));
            }
            BlockType::Todo => {
                let checked = block.properties.get("done").and_then(|v| v.as_bool()).unwrap_or(false);
                let mark = if checked { "[x]" } else { "[ ]" };
                out.push_str(&format!("{indent}- {mark} {text}\n"));
            }
            BlockType::Quote => {
                out.push_str(&format!("{indent}> {text}\n\n"));
            }
            BlockType::Callout => {
                out.push_str(&format!("{indent}> [!NOTE]\n{indent}> {text}\n\n"));
            }
            BlockType::Code => {
                let lang = block.properties.get("language").and_then(|v| v.as_str()).unwrap_or("text");
                out.push_str(&format!("```{lang}\n{text}\n```\n\n"));
            }
            BlockType::Divider => {
                out.push_str("---\n\n");
            }
            BlockType::Image => {
                let token = block.properties.get("token").and_then(|v| v.as_str()).unwrap_or("image");
                out.push_str(&format!("{indent}![image](assets/{token}.png)\n\n"));
            }
            BlockType::Equation => {
                out.push_str(&format!("$$\n{text}\n$$\n\n"));
            }
            BlockType::Table => {
                self.render_table(block, out, depth);
            }
            BlockType::Grid => {
                out.push_str(&format!("{indent}::: grid\n"));
                for col_id in &block.children {
                    self.render_block(col_id, out, depth + 1);
                }
                out.push_str(&format!("{indent}:::\n\n"));
            }
            BlockType::GridColumn => {
                out.push_str(&format!("{indent}::: column\n"));
                for child_id in &block.children {
                    self.render_block(child_id, out, depth + 1);
                }
                out.push_str(&format!("{indent}:::\n"));
            }
            _ => {
                // 渲染未知块的子节点以防数据丢失
                for child_id in &block.children {
                    self.render_block(child_id, out, depth + 1);
                }
            }
        }
    }

    /// 渲染 GFM 兼容表格
    fn render_table(&self, table_block: &DocxBlock, out: &mut String, _depth: usize) {
        let row_size = table_block.properties.get("row_size").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
        let col_size = table_block.properties.get("column_size").and_then(|v| v.as_u64()).unwrap_or(0) as usize;

        if row_size == 0 || col_size == 0 || table_block.children.is_empty() {
            return;
        }

        // 收集所有单元格的文本内容
        let mut cell_matrix: Vec<Vec<String>> = vec![vec![String::new(); col_size]; row_size];
        for (i, cell_id) in table_block.children.iter().enumerate() {
            let r = i / col_size;
            let c = i % col_size;
            if r < row_size && c < col_size {
                if let Some(cell) = self.block_map.get(cell_id) {
                    let mut cell_text = self.render_text_runs(&cell.text_runs);
                    // 递归渲染单元格内的子块
                    for child_id in &cell.children {
                        let mut sub = String::new();
                        self.render_block(child_id, &mut sub, 0);
                        cell_text.push_str(&sub.replace('\n', " "));
                    }
                    cell_matrix[r][c] = cell_text.trim().replace('|', "\\|");
                }
            }
        }

        // 输出 GFM 表格
        for (r_idx, row) in cell_matrix.iter().enumerate() {
            out.push('|');
            for cell in row {
                out.push_str(&format!(" {cell} |"));
            }
            out.push('\n');

            if r_idx == 0 {
                out.push('|');
                for _ in 0..col_size {
                    out.push_str(" --- |");
                }
                out.push('\n');
            }
        }
        out.push('\n');
    }

    fn render_text_runs(&self, runs: &[TextRun]) -> String {
        let mut res = String::new();
        for r in runs {
            let mut content = r.content.clone();
            if r.style.inline_code {
                content = format!("`{content}`");
            }
            if r.style.bold {
                content = format!("**{content}**");
            }
            if r.style.italic {
                content = format!("*{content}*");
            }
            if r.style.strikethrough {
                content = format!("~~{content}~~");
            }
            if r.style.underline {
                content = format!("<u>{content}</u>");
            }
            if let Some(url) = &r.link_url {
                content = format!("[{content}]({url})");
            }
            res.push_str(&content);
        }
        res
    }
}
