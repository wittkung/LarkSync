// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import SwiftUI
import LarkSyncCore
import TTMarkdownKit
#if os(macOS)
import AppKit
#endif

/// Document topology tree column view for LarkSync workspace.
public struct LarkWikiTreeColumnView: View {
    @Bindable var store: LarkSyncStore
    
    public init(store: LarkSyncStore) {
        self.store = store
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("DOCUMENT TREE")
                    .font(.system(size: 10, weight: .bold, design: .serif))
                    .tracking(1.5)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 6)
            
            if store.selectedSpaceId == nil {
                VStack(spacing: 8) {
                    Image(systemName: "sidebar.left")
                        .font(.system(size: 24))
                        .foregroundStyle(.secondary.opacity(0.5))
                    Text("Select a Wiki space from the left")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.wikiNodes.isEmpty {
                VStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.7)
                    Text("Loading document tree...")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        ForEach(store.wikiNodes, id: \.nodeToken) { (node: WikiNodeItem) in
                            let isSelected = store.selectedNodeToken == node.nodeToken
                            let isSyncRoot = store.syncSubtreeRootToken == node.nodeToken
                            
                            Button(action: {
                                store.selectedNodeToken = node.nodeToken
                            }) {
                                HStack(spacing: 6) {
                                    Image(systemName: node.hasChild ? "folder.fill" : "doc.text.fill")
                                        .foregroundStyle(isSyncRoot ? TTZipTheme.kintsugiGold : Color(red: 0.16, green: 0.50, blue: 0.36))
                                    
                                    Text(node.title)
                                        .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                                        .foregroundStyle(isSelected ? TTZipTheme.kintsugiGold : .primary)
                                        .lineLimit(1)
                                    
                                    Spacer()
                                    
                                    if isSyncRoot {
                                        Text("Sync Root")
                                            .font(.system(size: 9, weight: .bold))
                                            .padding(.horizontal, 4)
                                            .padding(.vertical, 1)
                                            .background(TTZipTheme.kintsugiGold.opacity(0.2))
                                            .foregroundStyle(TTZipTheme.kintsugiGold)
                                            .clipShape(Capsule())
                                    }
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(isSelected ? Color.primary.opacity(0.08) : Color.clear)
                                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button(action: {
                                    store.setSyncSubtreeScope(nodeToken: node.nodeToken, title: node.title)
                                }) {
                                    Label("Sync Only This Subtree", systemImage: "arrow.down.right.and.arrow.up.left")
                                }
                                
                                Button(action: {
                                    store.resetSyncScopeToFull()
                                }) {
                                    Label("Reset to Full Space Sync", systemImage: "globe")
                                }
                                
                                Divider()
                                
                                #if os(macOS)
                                Button(action: {
                                    Task {
                                        let savePanel = NSSavePanel()
                                        savePanel.allowedContentTypes = [.init(filenameExtension: "ttzip")!]
                                        savePanel.nameFieldStringValue = "\(node.title).ttzip"
                                        if savePanel.runModal() == .OK, let dest = savePanel.url {
                                            try? await store.exportToTtzipArchive(destinationURL: dest)
                                        }
                                    }
                                }) {
                                    Label("Export as .ttzip Archive", systemImage: "archivebox")
                                }
                                #endif
                            }
                        }
                    }
                    .padding(8)
                }
            }
        }
        .background(Color.primary.opacity(0.01))
    }
}
