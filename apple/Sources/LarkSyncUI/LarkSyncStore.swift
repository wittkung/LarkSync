// Copyright 2026 MetastudyLine. All rights reserved.
// Proprietary and confidential.

import SwiftUI
import Observation
import Security
import LarkSyncCore

/// Direct macOS Keychain wrapper for LarkSync credentials.
public final class SystemKeychainStore: @unchecked Sendable {
    public static let shared = SystemKeychainStore()
    private let service = "com.metastudyline.larksync"

    public init() {}

    public func get(key: String) async throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func set(key: String, value: String) async throws {
        guard let data = value.data(using: .utf8) else { return }
        try? await delete(key: key)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    public func delete(key: String) async throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}

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

    public init() {}

    /// 从 Keychain 自动加载凭证并初始化引擎
    public func loadCredentialsAndInitialize() async {
        let keychain = SystemKeychainStore.shared
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
        let keychain = SystemKeychainStore.shared
        try await keychain.set(key: "lark_app_id", value: appId.trimmingCharacters(in: .whitespacesAndNewlines))
        try await keychain.set(key: "lark_app_secret", value: appSecret.trimmingCharacters(in: .whitespacesAndNewlines))
        await loadCredentialsAndInitialize()
    }

    /// 设置选择性同步子树范围
    public func setSyncSubtreeScope(nodeToken: String, title: String) {
        self.syncSubtreeRootToken = nodeToken
        self.syncSubtreeTitle = title
        self.statusMessage = "同步范围已锁定为: \(title)"
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
            self.spaces = try await engine.fetchSpaces()
            if self.selectedSpaceId == nil, let first = self.spaces.first {
                self.selectedSpaceId = first.spaceId
                await refreshNodes(spaceId: first.spaceId)
            }
        } catch {
            self.statusMessage = "加载知识库空间失败: \(error.localizedDescription)"
        }
    }

    /// 刷新节点树
    public func refreshNodes(spaceId: String) async {
        guard let engine = self.engine else { return }
        do {
            self.wikiNodes = try await engine.fetchWikiTree(spaceId: spaceId)
        } catch {
            self.statusMessage = "加载文档节点树失败: \(error.localizedDescription)"
        }
    }

    /// 触发增量/全量同步
    public func triggerIncrementalSync() async {
        guard let engine = self.engine, let spaceId = self.selectedSpaceId, !spaceId.isEmpty else {
            self.statusMessage = "未选择有效知识库空间"
            return
        }

        self.isSyncing = true
        self.syncProgress = 0.0

        let rootToken = self.syncSubtreeRootToken
        let scopeName = self.syncSubtreeTitle ?? "全空间"
        self.statusMessage = "正在同步 (\(scopeName))..."

        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
        let targetDir = "\(homeDir)/.larksync/wiki/\(spaceId)"

        let callback = ProgressBridge { [weak self] event in
            Task { @MainActor in
                self?.statusMessage = "\(event.currentStep): \(event.currentItemName)"
                if event.totalItems > 0 {
                    self?.syncProgress = Double(event.processedItems) / Double(event.totalItems)
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
            await refreshNodes(spaceId: spaceId)
        } catch {
            self.isSyncing = false
            self.statusMessage = "同步失败: \(error)"
        }
    }

    /// 导出为 TTZip 归档（支持选择性导出子目录）
    public func exportToTtzipArchive(destinationURL: URL) async throws {
        guard let engine = self.engine, let spaceId = self.selectedSpaceId, !spaceId.isEmpty else { return }
        let callback = ProgressBridge { [weak self] event in
            Task { @MainActor [weak self] in
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
