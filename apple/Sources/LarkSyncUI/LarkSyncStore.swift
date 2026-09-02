// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

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

/// Feishu Wiki bidirectional synchronization state machine (Swift 6 @Observable + UniFFI Rust Engine).
@Observable
@MainActor
public final class LarkSyncStore {
    public var spaces: [WikiSpaceItem] = []
    public var selectedSpaceId: String? = nil
    public var wikiNodes: [WikiNodeItem] = []
    public var selectedNodeToken: String? = nil
    public var currentMarkdown: String = ""
    
    // Subtree selective sync scope
    public var syncSubtreeRootToken: String? = nil
    public var syncSubtreeTitle: String? = nil
    
    public var isConfigured: Bool = false
    public var isSyncing: Bool = false
    public var syncProgress: Double = 0.0
    public var lastSyncTime: Date?
    public var statusMessage: String = "Ready"
    
    private var engine: LarkSyncEngine?
    private var hostContext: TTZipHostContext?
    
    public init(hostContext: TTZipHostContext? = nil) {
        self.hostContext = hostContext
    }
    
    /// Injects host context dynamically.
    public func setHostContext(_ context: TTZipHostContext) {
        self.hostContext = context
    }
    
    /// Reads tenant-scoped credentials from injected Keychain.
    public func getCredentials() async -> (appId: String, appSecret: String) {
        guard let keychain = hostContext?.keychain else {
            return ("", "")
        }
        let appId = (try? await keychain.get(key: "lark_app_id")) ?? ""
        let appSecret = (try? await keychain.get(key: "lark_app_secret")) ?? ""
        return (appId, appSecret)
    }
    
    /// Automatically loads credentials from Keychain and initializes the engine.
    public func loadCredentialsAndInitialize() async {
        let (appId, appSecret) = await getCredentials()
        
        if !appId.isEmpty && !appSecret.isEmpty {
            self.isConfigured = true
            do {
                let storagePath = NSString(string: "~/.larksync").expandingTildeInPath
                try await initializeEngine(appId: appId, appSecret: appSecret, storagePath: storagePath)
            } catch {
                self.statusMessage = "Engine initialization failed: \(error.localizedDescription)"
            }
        } else {
            self.isConfigured = false
            self.statusMessage = "Feishu App ID and App Secret not configured"
        }
    }
    
    /// Saves credentials into tenant-scoped Keychain and re-initializes engine.
    public func saveCredentials(appId: String, appSecret: String) async throws {
        guard let keychain = hostContext?.keychain else {
            throw NSError(domain: "LarkSyncStore", code: 403, userInfo: [NSLocalizedDescriptionKey: "Host keychain store unavailable"])
        }
        try await keychain.set(key: "lark_app_id", value: appId.trimmingCharacters(in: .whitespacesAndNewlines))
        try await keychain.set(key: "lark_app_secret", value: appSecret.trimmingCharacters(in: .whitespacesAndNewlines))
        await loadCredentialsAndInitialize()
    }
    
    /// Sets selective sync scope for a specific subtree.
    public func setSyncSubtreeScope(nodeToken: String, title: String) {
        self.syncSubtreeRootToken = nodeToken
        self.syncSubtreeTitle = title
        self.statusMessage = "Sync scope locked to: \(title)"
        self.hostContext?.showNotification(title: "Sync Scope Changed", message: "Sync restricted to directory: \(title) and its descendants", level: .info)
    }
    
    /// Resets sync scope to full space.
    public func resetSyncScopeToFull() {
        self.syncSubtreeRootToken = nil
        self.syncSubtreeTitle = nil
        self.statusMessage = "Restored to full space sync"
    }
    
    /// Initializes and connects pure Rust microkernel engine.
    public func initializeEngine(appId: String, appSecret: String, storagePath: String) async throws {
        let config = LarkAuthConfig(appId: appId, appSecret: appSecret)
        self.engine = try LarkSyncEngine(config: config, storagePath: storagePath)
        await refreshSpaces()
    }
    
    /// Refreshes list of visible spaces.
    public func refreshSpaces() async {
        guard let engine = self.engine else { return }
        do {
            self.statusMessage = "Fetching Wiki spaces..."
            self.spaces = try await engine.fetchSpaces()
            if let first = self.spaces.first {
                self.selectedSpaceId = first.spaceId
                await refreshNodes(spaceId: first.spaceId)
            }
            self.statusMessage = "Spaces loaded successfully"
        } catch {
            self.statusMessage = "Failed to fetch spaces: \(error.localizedDescription)"
        }
    }
    
    /// Refreshes Wiki tree nodes for a space.
    public func refreshNodes(spaceId: String) async {
        guard let engine = self.engine else { return }
        do {
            self.statusMessage = "Fetching Wiki node tree..."
            self.wikiNodes = try await engine.fetchWikiTree(spaceId: spaceId)
            self.statusMessage = "Loaded \(self.wikiNodes.count) documents"
        } catch {
            self.statusMessage = "Failed to fetch Wiki tree: \(error.localizedDescription)"
        }
    }
    
    /// Loads local document asynchronously on background detached task to prevent main-thread jank.
    public func loadDocument(for nodeToken: String) async {
        guard let node = self.wikiNodes.first(where: { $0.nodeToken == nodeToken }) else { return }
        let spaceId = self.selectedSpaceId ?? ""
        let nodeTitle = node.title
        
        let loadedContent = await Task.detached(priority: .userInitiated) { () -> String in
            let safeTitle = nodeTitle
            let targetFile = NSString(string: "~/.larksync/spaces/\(spaceId)/\(safeTitle).md").expandingTildeInPath
            if FileManager.default.fileExists(atPath: targetFile),
               let content = try? String(contentsOfFile: targetFile, encoding: .utf8) {
                return content
            } else {
                return "# \(safeTitle)\n\n*(Document not yet synced locally. Click incremental sync in the top-right to pull)*"
            }
        }.value
        
        self.currentMarkdown = loadedContent
    }
    
    /// Persists current document asynchronously on background detached task.
    public func saveDocument(content: String, for nodeToken: String) async {
        guard let node = self.wikiNodes.first(where: { $0.nodeToken == nodeToken }) else { return }
        let spaceId = self.selectedSpaceId ?? ""
        let nodeTitle = node.title
        
        await Task.detached(priority: .background) {
            let targetFile = NSString(string: "~/.larksync/spaces/\(spaceId)/\(nodeTitle).md").expandingTildeInPath
            let parentDir = (targetFile as NSString).deletingLastPathComponent
            try? FileManager.default.createDirectory(atPath: parentDir, withIntermediateDirectories: true)
            try? content.write(toFile: targetFile, atomically: true, encoding: .utf8)
        }.value
    }
    
    /// Triggers incremental sync pull with background progress bridging.
    public func triggerIncrementalSync() async {
        guard !self.isSyncing, let engine = self.engine, let spaceId = self.selectedSpaceId, !spaceId.isEmpty else { return }
        self.isSyncing = true
        let scopeName = self.syncSubtreeTitle.map { "[\($0)]" } ?? "All Spaces"
        self.statusMessage = "Syncing \(scopeName)..."
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
            self.statusMessage = "Sync complete (\(processed) documents synced)"
            self.hostContext?.showNotification(title: "Feishu Wiki", message: "Successfully synced \(processed) documents (\(scopeName))", level: .success)
            await refreshNodes(spaceId: spaceId)
        } catch {
            self.isSyncing = false
            self.statusMessage = "Sync failed: \(error.localizedDescription)"
            self.hostContext?.showNotification(title: "Sync Failed", message: error.localizedDescription, level: .error)
        }
    }

    /// Exports Wiki space to TTZip archive.
    public func exportToTtzipArchive(destinationURL: URL) async throws {
        guard let engine = self.engine, let spaceId = self.selectedSpaceId, !spaceId.isEmpty else { return }
        let callback = ProgressBridge { [weak self] event in
            Task { @MainActor in
                self?.statusMessage = "Packaging archive: \(event.currentItemName)"
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
