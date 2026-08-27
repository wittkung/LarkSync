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
    @State private var showConfigSheet: Bool = false
    @State private var showGuideSheet: Bool = false
    @State private var inputAppId: String = ""
    @State private var inputAppSecret: String = ""
    
    public init(store: LarkSyncStore? = nil) {
        self._store = State(initialValue: store ?? LarkSyncStore())
    }
    
    public var body: some View {
        Group {
            if !store.isConfigured {
                onboardingHeroView
            } else {
                mainWorkspaceContent
            }
        }
        .task {
            await store.loadCredentialsAndInitialize()
        }
        .onChange(of: store.selectedNodeToken) { _, newToken in
            if let token = newToken {
                loadLocalDocument(nodeToken: token)
            }
        }
        .sheet(isPresented: $showConfigSheet) {
            configModalSheet
        }
        .sheet(isPresented: $showGuideSheet) {
            LarkSetupGuideSheetView(isPresented: $showGuideSheet)
        }
    }
    
    private var mainWorkspaceContent: some View {
        VStack(spacing: 0) {
            // 1. WSJ 52pt header bar with Kintsugi gold accent line
            headerView
            
            // 2. Selective subtree sync scope banner
            subtreeScopeBanner
            
            // 3. Three-column Miller Columns workspace
            HSplitView {
                // Column 1: Wiki spaces list
                spacesColumn
                    .frame(minWidth: 200, idealWidth: 220, maxWidth: 280)
                
                // Column 2: Wiki topological directory tree
                wikiTreeColumn
                    .frame(minWidth: 240, idealWidth: 280, maxWidth: 380)
                
                // Column 3: Typora-like WYSIWYG editor or welcome state
                editorColumn
                    .frame(minWidth: 420, maxWidth: .infinity)
            }
            
            // 4. Bottom sync status bar with progress indicator
            bottomStatusBar
        }
    }
    
    // MARK: - Onboarding Hero Guide
    private var onboardingHeroView: some View {
        VStack(spacing: 24) {
            Spacer()
            
            VStack(spacing: 12) {
                Image(systemName: "doc.text.below.ecg.fill")
                    .font(.system(size: 48, weight: .light))
                    .foregroundStyle(Color(red: 0.83, green: 0.68, blue: 0.21))
                
                Text("LarkSync 飞书知识库连接向导")
                    .font(.system(size: 22, weight: .bold, design: .serif))
                
                Text("连接飞书开放平台自建应用，开启飞书 DocX 块级双向增量同步与 Markdown 沉浸式编辑。")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
            }
            
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("App ID:")
                        .font(.system(size: 12, weight: .semibold))
                    TextField("例如: cli_a1b2c3d4e5", text: $inputAppId)
                        .textFieldStyle(.roundedBorder)
                }
                
                VStack(alignment: .leading, spacing: 6) {
                    Text("App Secret:")
                        .font(.system(size: 12, weight: .semibold))
                    SecureField("••••••••••••••••••••••••", text: $inputAppSecret)
                        .textFieldStyle(.roundedBorder)
                }
                
                HStack(spacing: 10) {
                    Button(action: {
                        showGuideSheet = true
                    }) {
                        HStack(spacing: 5) {
                            Image(systemName: "book.pages.fill")
                                .font(.system(size: 11))
                            Text("📖 飞书配置指南")
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(TTZipTheme.kintsugiGold)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(TTZipTheme.kintsugiGold.opacity(0.08))
                        .clipShape(Capsule())
                        .overlay(
                            Capsule()
                                .stroke(TTZipTheme.kintsugiGold, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .help("查看飞书开放平台自建应用与 4 大权限配置教学指南")
                    
                    Spacer()
                    
                    Button("测试并连接飞书") {
                        Task {
                            try? await store.saveCredentials(appId: inputAppId, appSecret: inputAppSecret)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TTZipTheme.kintsugiGold)
                    .disabled(inputAppId.isEmpty || inputAppSecret.isEmpty)
                }
            }
            .padding(24)
            .frame(width: 440)
            .background(Color.primary.opacity(0.03))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 0.8)
            )
            
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.primary.opacity(0.01))
    }

    
    // MARK: - Document Loading & Persistence
    private func loadLocalDocument(nodeToken: String) {
        guard let node = store.wikiNodes.first(where: { $0.nodeToken == nodeToken }) else { return }
        let spaceId = store.selectedSpaceId ?? ""
        let targetFile = NSString(string: "~/.larksync/spaces/\(spaceId)/\(node.title).md").expandingTildeInPath
        if FileManager.default.fileExists(atPath: targetFile),
           let content = try? String(contentsOfFile: targetFile, encoding: .utf8) {
            store.currentMarkdown = content
        } else {
            store.currentMarkdown = "# \(node.title)\n\n*(文档尚未同步至本地，点击右上角「增量同步」进行拉取)*"
        }
    }
    
    private func saveCurrentDocument(content: String) {
        guard let token = store.selectedNodeToken,
              let node = store.wikiNodes.first(where: { $0.nodeToken == token }) else { return }
        let spaceId = store.selectedSpaceId ?? ""
        let targetFile = NSString(string: "~/.larksync/spaces/\(spaceId)/\(node.title).md").expandingTildeInPath
        try? content.write(toFile: targetFile, atomically: true, encoding: .utf8)
    }
    
    // MARK: - Header Bar
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
                
                // Refresh spaces button
                Button(action: {
                    Task { await store.refreshSpaces() }
                }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .semibold))
                }
                .buttonStyle(.plain)
                .help("刷新知识库空间列表")
                .disabled(store.isSyncing || !store.isConfigured)
                
                // Credentials settings button
                Button(action: {
                    showConfigSheet = true
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "gearshape.fill")
                        Text("凭证设置")
                            .font(.system(size: 11, weight: .medium))
                    }
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.primary.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                
                // Full space / selective subtree incremental sync button
                Button(action: {
                    if !store.isConfigured {
                        showConfigSheet = true
                    } else {
                        Task { await store.triggerIncrementalSync() }
                    }
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
    
    // MARK: - Subtree Scope Banner
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
    
    // MARK: - Column 1: Spaces List
    private var spacesColumn: some View {
        VStack(spacing: 0) {
            HStack {
                Text("知识库空间")
                    .font(.system(size: 10, weight: .bold, design: .serif))
                    .tracking(1.5)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 6)
            
            if !store.isConfigured {
                VStack(spacing: 12) {
                    Image(systemName: "key.fill")
                        .font(.system(size: 26))
                        .foregroundStyle(Color(red: 0.83, green: 0.68, blue: 0.21))
                    Text("未配置飞书凭证")
                        .font(.system(size: 13, weight: .semibold))
                    Text("请配置 App ID 与 Secret 以连接飞书开放平台")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    
                    Button("立即配置凭证") {
                        showConfigSheet = true
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.83, green: 0.68, blue: 0.21))
                    .font(.system(size: 11, weight: .medium))
                }
                .padding(16)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.spaces.isEmpty {
                VStack(spacing: 10) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("正在拉取知识库空间...")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
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
            }
        }
        .background(Color.primary.opacity(0.02))
    }
    
    // MARK: - Column 2: Document Topology Tree
    private var wikiTreeColumn: some View {
        VStack(spacing: 0) {
            HStack {
                Text("文档拓扑树")
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
                    Text("请在左侧选择知识库空间")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.wikiNodes.isEmpty {
                VStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.7)
                    Text("正在拉取文档目录树...")
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
                                        .foregroundStyle(isSyncRoot ? Color(red: 0.83, green: 0.68, blue: 0.21) : Color(red: 0.16, green: 0.50, blue: 0.36))
                                    
                                    Text(node.title)
                                        .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                                        .foregroundStyle(isSelected ? Color(red: 0.83, green: 0.68, blue: 0.21) : .primary)
                                        .lineLimit(1)
                                    
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
        }
        .background(Color.primary.opacity(0.01))
    }
    
    // MARK: - Column 3: WYSIWYG Editor & Welcome Screen
    private var editorColumn: some View {
        Group {
            if store.selectedNodeToken == nil {
                // Typora-like Zen onboarding state
                VStack(spacing: 20) {
                    Image(systemName: "doc.richtext.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(Color(red: 0.83, green: 0.68, blue: 0.21).opacity(0.8))
                    
                    VStack(spacing: 6) {
                        Text("飞书知识库 Markdown 沉浸式编辑器")
                            .font(.system(size: 16, weight: .bold, design: .serif))
                        Text("从左侧选择一篇文档，即可开启类 Typora 所见即所得编辑与实时双向同步")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 420)
                    }
                    
                    VStack(alignment: .leading, spacing: 10) {
                        featureRow(icon: "bolt.fill", title: "秒级增量同步", desc: "基于 3-Tree 差异状态机，仅拉取修改块")
                        featureRow(icon: "eye.fill", title: "Live Preview 语法折叠", desc: "光标聚焦展开 Markdown 标记，离焦无缝隐藏")
                        featureRow(icon: "lock.shield.fill", title: "密码学安全保障", desc: "App ID / Secret 严格存储于 macOS Keychain")
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
                            saveCurrentDocument(content: updatedContent)
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
                .foregroundStyle(Color(red: 0.83, green: 0.68, blue: 0.21))
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
    
    // MARK: - Status Bar
    private var bottomStatusBar: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(store.isSyncing ? Color.orange : (store.isConfigured ? Color(red: 0.16, green: 0.50, blue: 0.36) : Color.gray))
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
    
    // MARK: - Credentials Configuration Sheet
    private var configModalSheet: some View {
        VStack(spacing: 16) {
            HStack {
                Text("配置飞书开放平台凭证")
                    .font(.system(size: 16, weight: .bold, design: .serif))
                Spacer()
                Button(action: {
                    showGuideSheet = true
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "book.pages.fill")
                            .font(.system(size: 10))
                        Text("📖 飞书配置指南")
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundStyle(TTZipTheme.kintsugiGold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(TTZipTheme.kintsugiGold.opacity(0.08))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(TTZipTheme.kintsugiGold, lineWidth: 0.8)
                    )
                }
                .buttonStyle(.plain)
                .help("查看飞书开放平台配置教学指南")
            }
            
            Text("凭证将经过 macOS Keychain 加密保存，插件通过安全 OCap 机制访问。")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            
            VStack(alignment: .leading, spacing: 6) {
                Text("App ID:")
                    .font(.system(size: 11, weight: .semibold))
                TextField("cli_xxxxxxxxxxxx", text: $inputAppId)
                    .textFieldStyle(.roundedBorder)
            }
            
            VStack(alignment: .leading, spacing: 6) {
                Text("App Secret:")
                    .font(.system(size: 11, weight: .semibold))
                SecureField("••••••••••••••••", text: $inputAppSecret)
                    .textFieldStyle(.roundedBorder)
            }
            
            HStack(spacing: 12) {
                Button("取消") {
                    showConfigSheet = false
                }
                .buttonStyle(.plain)
                
                Spacer()
                
                Button("保存并初始化") {
                    Task {
                        try? await store.saveCredentials(appId: inputAppId, appSecret: inputAppSecret)
                        showConfigSheet = false
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.83, green: 0.68, blue: 0.21))
                .disabled(inputAppId.isEmpty || inputAppSecret.isEmpty)
            }
            .padding(.top, 8)
        }
        .padding(24)
        .frame(width: 380)
        .onAppear {
            Task {
                let keychain = SystemKeychainStore.shared
                inputAppId = (try? await keychain.get(key: "lark_app_id")) ?? ""
                inputAppSecret = (try? await keychain.get(key: "lark_app_secret")) ?? ""
            }
        }
    }
}
