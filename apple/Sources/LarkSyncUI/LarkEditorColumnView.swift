// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import SwiftUI
import LarkSyncCore
import TTMarkdownKit

/// Editor and empty state welcome column view for LarkSync workspace.
public struct LarkEditorColumnView: View {
    @Bindable var store: LarkSyncStore
    
    public init(store: LarkSyncStore) {
        self.store = store
    }
    
    public var body: some View {
        Group {
            if store.selectedNodeToken == nil {
                VStack(spacing: 20) {
                    Image(systemName: "doc.richtext.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(TTZipTheme.kintsugiGold.opacity(0.8))
                    
                    VStack(spacing: 6) {
                        Text("Feishu Wiki Markdown Editor")
                            .font(.system(size: 16, weight: .bold, design: .serif))
                        Text("Select a document on the left to start WYSIWYG editing and bidirectional synchronization")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 420)
                    }
                    
                    VStack(alignment: .leading, spacing: 10) {
                        featureRow(icon: "bolt.fill", title: "Sub-second Incremental Sync", desc: "3-Tree differential state machine syncing only modified blocks")
                        featureRow(icon: "eye.fill", title: "Live Preview Syntax Folding", desc: "Markdown markup expands on focus, collapses on defocus")
                        featureRow(icon: "lock.shield.fill", title: "Cryptographic Security", desc: "App ID / Secret safely isolated in macOS Keychain")
                    }
                    .padding(16)
                    .background(Color.primary.opacity(0.03))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .padding(32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                let spaceId = store.selectedSpaceId ?? ""
                let baseDir = URL(fileURLWithPath: NSString(string: "~/.larksync/spaces/\(spaceId)").expandingTildeInPath, isDirectory: true)
                TTZipEditorView(
                    text: $store.currentMarkdown,
                    baseDirectoryURL: baseDir,
                    onDocChange: { @Sendable updatedContent in
                        Task { @MainActor in
                            if let token = store.selectedNodeToken {
                                await store.saveDocument(content: updatedContent, for: token)
                            }
                        }
                    }
                )
                .padding(12)
            }
        }
    }
    
    private func featureRow(icon: String, title: String, desc: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(TTZipTheme.kintsugiGold)
                .frame(width: 16)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                Text(desc)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
        }
    }
}
