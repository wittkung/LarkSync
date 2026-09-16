// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

import SwiftUI
import Observation
import LarkSyncCore
import TTZipPluginKit

private final class ProgressBridge: SyncProgressCallback, @unchecked Sendable {
    private let onProgressHandler: @Sendable (SyncProgressEventDto) -> Void
    private let onLogHandler: @Sendable (String, String) -> Void
    
    init(
        onProgress: @escaping @Sendable (SyncProgressEventDto) -> Void,
        onLog: @escaping @Sendable (String, String) -> Void = { _, _ in }
    ) {
        self.onProgressHandler = onProgress
        self.onLogHandler = onLog
    }
    
    func onProgress(progress: SyncProgressEventDto) {
        onProgressHandler(progress)
    }
    
    func onLog(level: String, message: String) {
        onLogHandler(level, message)
    }
}

/// 飞书知识库双向同步主状态机 (Swift 6 @Observable + UniFFI Rust Engine)
@Observable
@MainActor
public final class LarkSyncStore {
    public var spaces: [WikiSpaceItem] = []
    public var selectedSpaceId: String? = nil
    public var wikiNodes: [WikiNodeItem] = []
    public var selectedNodeToken: String? = nil
    public var currentMarkdown: String = ""
    
    // 子树选择性同步范围
    public var syncSubtreeRootToken: String? = nil
    public var syncSubtreeTitle: String? = nil
    
    public var isConfigured: Bool = false
    public var isSyncing: Bool = false
    public var syncProgress: Double = 0.0
    public var lastSyncTime: Date?
    public var statusMessage: String = "就绪"
    
    private var engine: LarkSyncEngine?
    private let hostContext: TTZipHostContext?
    
    public init(hostContext: TTZipHostContext? = nil) {
        self.hostContext = hostContext
    }
    
    /// 从 Keychain 自动加载凭证并初始化引擎
    public func loadCredentialsAndInitialize() async {
        let keychain = hostContext?.keychain ?? SystemKeychainStore.shared
        let appId = (try? await keychain.get(key: "lark_app_id")) ?? ""
        let appSecret = (try? await keychain.get(key: "lark_app_secret")) ?? ""
        
        if !appId.isEmpty && !appSecret.isEmpty {
            self.isConfigured = true
            do {
                try await initializeEngine(appId: appId, appSecret: appSecret, storagePath: "~/.larksync")
            } catch {
                self.statusMessage = "引擎初始化失败: \(error.localizedDescription)"
            }
        } else {
            self.isConfigured = false
            self.statusMessage = "未配置飞书 App ID 与 App Secret"
        }
    }
    
    /// 保存凭证到 Keychain 并重新初始化
    public func saveCredentials(appId: String, appSecret: String) async throws {
        let keychain = hostContext?.keychain ?? SystemKeychainStore.shared
        try await keychain.set(key: "lark_app_id", value: appId.trimmingCharacters(in: .whitespacesAndNewlines))
        try await keychain.set(key: "lark_app_secret", value: appSecret.trimmingCharacters(in: .whitespacesAndNewlines))
        await loadCredentialsAndInitialize()
    }
    
    /// 设置选择性同步子树范围
    public func setSyncSubtreeScope(nodeToken: String, title: String) {
        self.syncSubtreeRootToken = nodeToken
        self.syncSubtreeTitle = title
        self.statusMessage = "同步范围已锁定为: \(title)"
        self.hostContext?.showNotification(title: "同步范围变更", message: "当前仅同步目录: \(title) 及其子文档", level: .info)
    }
    
    /// 恢复为全量空间同步
    public func resetSyncScopeToFull() {
        self.syncSubtreeRootToken = nil
        self.syncSubtreeTitle = nil
        self.statusMessage = "已恢复为全量空间同步"
    }
    
    /// 初始化并连接 Rust 核心引擎
    public func initializeEngine(appId: String, appSecret: String, storagePath: String) async throws {
        let config = LarkAuthConfig(appId: appId, appSecret: appSecret)
        self.engine = try LarkSyncEngine(config: config, storagePath: storagePath)
        await refreshSpaces()
    }
    
    /// 刷新空间列表
    public func refreshSpaces() async {
        guard let engine = self.engine else { return }
        do {
            self.statusMessage = "正在获取空间列表..."
            self.spaces = try await engine.fetchSpaces()
            if let first = self.spaces.first {
                self.selectedSpaceId = first.spaceId
                await refreshNodes(spaceId: first.spaceId)
            }
            self.statusMessage = "空间加载完成"
        } catch {
            self.statusMessage = "获取空间失败: \(error)"
        }
    }
    
    /// 刷新指定空间下的 Wiki 树
    public func refreshNodes(spaceId: String) async {
        guard let engine = self.engine else { return }
        do {
            self.statusMessage = "正在拉取知识库树..."
            self.wikiNodes = try await engine.fetchWikiTree(spaceId: spaceId)
            self.statusMessage = "已加载 \(self.wikiNodes.count) 篇文档"
        } catch {
            self.statusMessage = "拉取知识库树失败: \(error)"
        }
    }
    
    /// 触发增量同步拉取 (支持选择性同步子目录)
    public func triggerIncrementalSync() async {
        guard !self.isSyncing, let engine = self.engine, let spaceId = self.selectedSpaceId, !spaceId.isEmpty else { return }
        self.isSyncing = true
        let scopeName = self.syncSubtreeTitle.map { "[\($0)]" } ?? "全部空间"
        self.statusMessage = "正在同步 \(scopeName)..."
        self.syncProgress = 0.0
        
        let targetDir = NSString(string: "~/.larksync/spaces/\(spaceId)").expandingTildeInPath
        let rootToken = self.syncSubtreeRootToken
        
        let callback = ProgressBridge { [weak self] event in
            Task { @MainActor in
                guard let self = self else { return }
                self.statusMessage = "\(event.currentStep): \(event.currentItemName)"
                if event.totalItems > 0 {
                    self.syncProgress = Double(event.processedItems) / Double(event.totalItems)
                }
            }
        }
        
        do {
            let processed = try await engine.syncPull(
                spaceId: spaceId,
                rootNodeToken: rootToken,
                targetDir: targetDir,
                cb: callback
            )
            self.isSyncing = false
            self.lastSyncTime = Date()
            self.statusMessage = "同步完成 (已同步 \(processed) 篇文档)"
            self.hostContext?.showNotification(title: "飞书知识库", message: "已成功同步 \(processed) 篇文档 (\(scopeName))", level: .success)
            await refreshNodes(spaceId: spaceId)
        } catch {
            self.isSyncing = false
            self.statusMessage = "同步失败: \(error)"
            self.hostContext?.showNotification(title: "同步失败", message: error.localizedDescription, level: .error)
        }
    }

    /// 导出为 TTZip 归档（支持选择性导出子目录）
    public func exportToTtzipArchive(destinationURL: URL) async throws {
        guard let engine = self.engine, let spaceId = self.selectedSpaceId, !spaceId.isEmpty else { return }
        let callback = ProgressBridge { [weak self] event in
            Task { @MainActor in
                self?.statusMessage = "归档打包: \(event.currentItemName)"
            }
        }
        try await engine.exportToTtzip(
            spaceId: spaceId,
            rootNodeToken: self.syncSubtreeRootToken,
            outputPath: destinationURL.path,
            cb: callback
        )
    }
}
