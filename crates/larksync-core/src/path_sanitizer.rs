// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

const WINDOWS_RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    "CLOCK$",
];

/// Sanitizes remote document titles into safe, cross-platform relative filenames.
///
/// Replaces illegal path separators ('/', '\\'), NTFS streams (':'), wildcards ('*', '?'),
/// and quotes/brackets ('"', '<', '>', '|') with underscores ('_').
/// Trims surrounding whitespace and dots, and avoids directory traversal and Windows device names.
pub fn sanitize_document_filename(title: &str, fallback_token: &str) -> String {
    let mut normalized = title.replace("..", "__");
    while normalized.contains("..") {
        normalized = normalized.replace("..", "__");
    }

    let cleaned: String = normalized
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();

    let trimmed = cleaned.trim().trim_matches(['.', ' ']);

    if trimmed.is_empty() || trimmed == "." || trimmed == ".." || trimmed.chars().all(|c| c == '_') {
        return format!("untitled_{fallback_token}");
    }

    let upper = trimmed.to_ascii_uppercase();
    if WINDOWS_RESERVED.contains(&upper.as_str()) {
        return format!("_{trimmed}");
    }

    // Limit filename length to 200 bytes for UTF-8 boundary safety
    if trimmed.len() > 200 {
        let mut truncated = String::new();
        for ch in trimmed.chars() {
            if truncated.len() + ch.len_utf8() > 200 {
                break;
            }
            truncated.push(ch);
        }
        truncated
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_traversal_and_separators() {
        assert_eq!(sanitize_document_filename("../../../etc/passwd", "token1"), "_________etc_passwd");
        assert_eq!(sanitize_document_filename(r"C:\Windows\System32", "token2"), "C__Windows_System32");
        assert_eq!(sanitize_document_filename("Project: Phase 1 *Final*?", "token3"), "Project_ Phase 1 _Final__");
    }

    #[test]
    fn test_sanitize_empty_and_reserved() {
        assert_eq!(sanitize_document_filename("", "node123"), "untitled_node123");
        assert_eq!(sanitize_document_filename("   ...  ", "node123"), "untitled_node123");
        assert_eq!(sanitize_document_filename("CON", "node123"), "_CON");
        assert_eq!(sanitize_document_filename("nul", "node123"), "_nul");
    }
}

