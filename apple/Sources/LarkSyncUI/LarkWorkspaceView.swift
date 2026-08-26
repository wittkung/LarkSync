// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

import SwiftUI
import TTMarkdownKit
import LarkSyncCore
import TTZipPluginKit

public struct LarkWorkspaceView: View {
    @State private var store: LarkSyncStore
    
    public init(store: LarkSyncStore? = nil) {
        self._store = State(initialValue: store ?? LarkSyncStore())
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            // 1. WSJ 52pt 顶栏与金线
            headerView
            
            // 2. 同步范围提示栏 (Selective Subtree Banner)
            subtreeScopeBanner
            
            // 3. 3 栏米勒列工作区
            HSplitView {
                // 第一栏：空间列表
                spacesColumn
                    .frame(minWidth: 180, idealWidth: 200, maxWidth: 260)
                
                // 第二栏：知识库拓扑树
                wikiTreeColumn
                    .frame(minWidth: 220, idealWidth: 260, maxWidth: 360)
                
                // 第三栏：类 Typora 所见即所得编辑器
                editorColumn
                    .frame(minWidth: 400, maxWidth: .infinity)
            }
            
            // 4. 底部同步状态与进度条
            bottomStatusBar
        }
        .onChange(of: store.selectedNodeToken) { _, newToken in
            if let token = newToken {
                loadLocalDocument(nodeToken: token)
            }
        }
    }
    
    // MARK: - 选中节点加载本地文档
    private func loadLocalDocument(nodeToken: String) {
        guard let node = store.wikiNodes.first(where: { $0.nodeToken == nodeToken }) else { return }
        let spaceId = store.selectedSpaceId ?? ""
        let targetFile = NSString(string: "~/.larksync/spaces/\(spaceId)/\(node.title).md").expandingTildeInPath
        if FileManager.default.fileExists(atPath: targetFile),
           let content = try? String(contentsOfFile: targetFile, encoding: .utf8) {
            store.currentMarkdown = content
        } else {
            store.currentMarkdown = "# \(node.title)\n\n*(文档尚未同步至本地，点击右上角同步按钮进行拉取)*"
        }
    }
    
    private func saveCurrentDocument(content: String) {
        guard let token = store.selectedNodeToken,
              let node = store.wikiNodes.first(where: { $0.nodeToken == token }) else { return }
        let spaceId = store.selectedSpaceId ?? ""
        let targetFile = NSString(string: "~/.larksync/spaces/\(spaceId)/\(node.title).md").expandingTildeInPath
        try? content.write(toFile: targetFile, atomically: true, encoding: .utf8)
    }
    
    // MARK: - 顶栏
    private var headerView: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("FEISHU WIKI WORKSPACE")
                        .font(.system(size: 9, weight: .bold, design: .serif))
                        .tracking(2)
                        .foregroundStyle(Color(red: 0.83, green: 0.68, blue: 0.21)) // Kintsugi Gold
                    Text("飞书知识库增量工作区")
                        .font(.system(size: 16, weight: .bold, design: .serif))
                }
                
                Spacer()
                
                Button(action: {
                    Task { await store.triggerIncrementalSync() }
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: store.isSyncing ? "arrow.triangle.2.circlepath" : "arrow.triangle.2.circlepath.circle.fill")
                            .rotationEffect(.degrees(store.isSyncing ? 360 : 0))
                            .animation(store.isSyncing ? .linear(duration: 1).repeatForever(autoreverses: false) : .default, value: store.isSyncing)
                        Text(store.isSyncing ? "正在增量同步..." : (store.syncSubtreeTitle == nil ? "全量增量同步" : "同步选定子目录"))
                            .font(.system(size: 12, weight: .medium))
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.83, green: 0.68, blue: 0.21))
                .disabled(store.isSyncing)
            }
            .padding(.horizontal, 20)
            .frame(height: 52)
            
            Rectangle()
                .fill(Color(red: 0.83, green: 0.68, blue: 0.21))
                .frame(height: 1.5)
        }
    }
    
    // MARK: - 同步范围横幅 (Subtree Banner)
    @ViewBuilder
    private var subtreeScopeBanner: some View {
        if let title = store.syncSubtreeTitle {
            HStack(spacing: 8) {
                Image(systemName: "folder.badge.gearshape")
                    .foregroundStyle(Color(red: 0.16, green: 0.50, blue: 0.36)) // Bamboo Green
                Text("当前同步范围已限定为子目录: ")
                    .font(.system(size: 11, weight: .medium))
                Text(title)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color(red: 0.83, green: 0.68, blue: 0.21))
                
                Spacer()
                
                Button("恢复全量空间同步") {
                    store.resetSyncScopeToFull()
                }
                .font(.system(size: 10, weight: .semibold))
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .background(Color(red: 0.16, green: 0.50, blue: 0.36).opacity(0.08))
            .overlay(
                Rectangle()
                    .frame(height: 0.5)
                    .foregroundStyle(Color(red: 0.16, green: 0.50, blue: 0.36).opacity(0.3)),
                alignment: .bottom
            )
        }
    }
    
    // MARK: - 空间列表
    private var spacesColumn: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 4) {
                ForEach(store.spaces, id: \.spaceId) { (space: WikiSpaceItem) in
                    let isSelected = store.selectedSpaceId == space.spaceId
                    Button(action: {
                        store.selectedSpaceId = space.spaceId
                        store.resetSyncScopeToFull()
                        Task { await store.refreshNodes(spaceId: space.spaceId) }
                    }) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(space.name)
                                .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                                .foregroundStyle(isSelected ? Color(red: 0.83, green: 0.68, blue: 0.21) : .primary)
                            Text(space.description.isEmpty ? "飞书知识库空间" : space.description)
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(isSelected ? Color.primary.opacity(0.08) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(8)
        }
        .background(Color.primary.opacity(0.02))
    }
    
    // MARK: - 拓扑目录树
    private var wikiTreeColumn: some View {
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
                                .foregroundStyle(isSyncRoot ? Color(red: 0.83, green: 0.68, blue: 0.21) : Color(red: 0.16, green: 0.50, blue: 0.36))
                            
                            Text(node.title)
                                .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                                .foregroundStyle(isSelected ? Color(red: 0.83, green: 0.68, blue: 0.21) : .primary)
                            
                            Spacer()
                            
                            if isSyncRoot {
                                Text("同步根")
                                    .font(.system(size: 9, weight: .bold))
                                    .padding(.horizontal, 4)
                                    .padding(.vertical, 1)
                                    .background(Color(red: 0.83, green: 0.68, blue: 0.21).opacity(0.2))
                                    .foregroundStyle(Color(red: 0.83, green: 0.68, blue: 0.21))
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
                            Label("仅同步此目录及子文档", systemImage: "arrow.down.right.and.arrow.up.left")
                        }
                        
                        Button(action: {
                            store.resetSyncScopeToFull()
                        }) {
                            Label("恢复为全量空间同步", systemImage: "globe")
                        }
                        
                        Divider()
                        
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
                            Label("导出为 .ttzip 归档", systemImage: "archivebox")
                        }
                    }
                }
            }
            .padding(8)
        }
    }
    
    // MARK: - 编辑器
    private var editorColumn: some View {
        let spaceId = store.selectedSpaceId ?? ""
        let baseDir = URL(fileURLWithPath: NSString(string: "~/.larksync/spaces/\(spaceId)").expandingTildeInPath, isDirectory: true)
        return TTZipEditorView(
            text: $store.currentMarkdown,
            baseDirectoryURL: baseDir,
            onDocChange: { @Sendable updatedContent in
                Task { @MainActor in
                    saveCurrentDocument(content: updatedContent)
                }
            }
        )
        .padding(12)
    }
    
    // MARK: - 状态栏
    private var bottomStatusBar: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(store.isSyncing ? Color.orange : Color(red: 0.16, green: 0.50, blue: 0.36))
                .frame(width: 8, height: 8)
            
            Text(store.statusMessage)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            
            if store.isSyncing {
                ProgressView(value: store.syncProgress)
                    .frame(width: 120)
            }
            
            Spacer()
            
            if let last = store.lastSyncTime {
                Text("上次同步: \(last.formatted(date: .omitted, time: .standard))")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 28)
        .background(Color.primary.opacity(0.03))
    }
}
