// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

use std::collections::HashMap;
use pulldown_cmark::{Event, Parser, Tag, TagEnd, HeadingLevel, CodeBlockKind};
use crate::model::{DocxBlock, BlockType, TextRun, TextStyleMask};

/// Reverse converter from Markdown AST to Feishu / Lark DocX block tree.
pub struct MarkdownToDocxConverter;


impl MarkdownToDocxConverter {
    pub fn convert(markdown: &str) -> Vec<DocxBlock> {
        let parser = Parser::new(markdown);
        let mut blocks = Vec::new();
        let mut current_text_runs: Vec<TextRun> = Vec::new();
        let mut current_block_type: Option<BlockType> = None;
        let mut active_style = TextStyleMask::default();
        let mut active_link_url: Option<String> = None;
        let mut block_index = 1;

        for event in parser {
            match event {
                Event::Start(tag) => match tag {
                    Tag::Heading { level, .. } => {
                        let bt = match level {
                            HeadingLevel::H1 => BlockType::Heading1,
                            HeadingLevel::H2 => BlockType::Heading2,
                            HeadingLevel::H3 => BlockType::Heading3,
                            HeadingLevel::H4 => BlockType::Heading4,
                            HeadingLevel::H5 => BlockType::Heading5,
                            HeadingLevel::H6 => BlockType::Heading6,
                        };
                        current_block_type = Some(bt);
                    }
                    Tag::Paragraph => {
                        current_block_type = Some(BlockType::Text);
                    }
                    Tag::BlockQuote(_) => {
                        current_block_type = Some(BlockType::Quote);
                    }
                    Tag::CodeBlock(kind) => {
                        current_block_type = Some(BlockType::Code);
                        let mut props = HashMap::new();
                        if let CodeBlockKind::Fenced(lang) = kind {
                            props.insert("language".to_string(), serde_json::Value::String(lang.to_string()));
                        }
                    }
                    Tag::Item => {
                        current_block_type = Some(BlockType::Bullet);
                    }
                    Tag::Emphasis => {
                        active_style.italic = true;
                    }
                    Tag::Strong => {
                        active_style.bold = true;
                    }
                    Tag::Strikethrough => {
                        active_style.strikethrough = true;
                    }
                    Tag::Link { dest_url, .. } => {
                        active_link_url = Some(dest_url.to_string());
                    }
                    _ => {}
                },
                Event::End(tag_end) => match tag_end {
                    TagEnd::Heading(_) | TagEnd::Paragraph | TagEnd::BlockQuote | TagEnd::CodeBlock | TagEnd::Item => {
                        if let Some(bt) = current_block_type.take() {
                            blocks.push(DocxBlock {
                                block_id: format!("block_{block_index}"),
                                parent_id: None,
                                children: vec![],
                                block_type: bt,
                                text_runs: std::mem::take(&mut current_text_runs),
                                properties: HashMap::new(),
                                revision: 1,
                            });
                            block_index += 1;
                        }
                    }
                    TagEnd::Emphasis => {
                        active_style.italic = false;
                    }
                    TagEnd::Strong => {
                        active_style.bold = false;
                    }
                    TagEnd::Strikethrough => {
                        active_style.strikethrough = false;
                    }
                    TagEnd::Link => {
                        active_link_url = None;
                    }
                    _ => {}
                },
                Event::Text(t) => {
                    current_text_runs.push(TextRun {
                        content: t.to_string(),
                        style: active_style,
                        link_url: active_link_url.clone(),
                    });
                }
                Event::Code(c) => {
                    let mut code_style = active_style;
                    code_style.inline_code = true;
                    current_text_runs.push(TextRun {
                        content: c.to_string(),
                        style: code_style,
                        link_url: None,
                    });
                }
                _ => {}
            }
        }

        blocks
    }
}
