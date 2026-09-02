// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import Testing
import Foundation
import SwiftUI
@testable import TTZipPluginKit

@MainActor
private final class MockHostContext: TTZipHostContext {
    let pluginIdentifier: String = "test.plugin"
    let keychain: TTZipKeychainStore = MockKeychain()
    
    func createArchive(sources: [URL], destination: URL, format: String, level: Int) async throws -> URL {
        return destination
    }
    func showNotification(title: String, message: String, level: TTZipNotificationLevel) {}
    func setGlobalProgress(progress: Double?, statusText: String?) {}
    
    func subscribeEvent<T: Sendable & Codable>(_ type: T.Type, name: String, handler: @escaping @Sendable (T) -> Void) -> SubscriptionToken {
        return SubscriptionToken()
    }
    func unsubscribeEvent(token: SubscriptionToken) {}
    func publishEvent<T: Sendable & Codable>(name: String, event: T) {}
}

private final class MockKeychain: TTZipKeychainStore, @unchecked Sendable {
    private var store: [String: String] = [:]
    func get(key: String) async throws -> String? { store[key] }
    func set(key: String, value: String) async throws { store[key] = value }
    func delete(key: String) async throws { store.removeValue(forKey: key) }
}

@Suite("TTZip Plugin Installer E2E Tests")
struct TTZipPluginInstallerTests {
    
    @Test("Test Full Atomic Installation and Hot-Mounting Pipeline")
    @MainActor
    func testAtomicInstallPipeline() async throws {
        let fallback = TTZipMarketplaceService.fallbackPlugin
        let currentDir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let distURL = currentDir.appendingPathComponent("dist/LarkSync-v\(fallback.version).ttplugin.zip")
        let parentDistURL = currentDir.deletingLastPathComponent().appendingPathComponent("dist/LarkSync-v\(fallback.version).ttplugin.zip")
        
        let targetURL: URL?
        if FileManager.default.fileExists(atPath: distURL.path) {
            targetURL = distURL
        } else if FileManager.default.fileExists(atPath: parentDistURL.path) {
            targetURL = parentDistURL
        } else {
            targetURL = nil
        }
        
        guard let zipURL = targetURL else {
            return // Skip if distribution package is not built yet
        }
        
        let installer = TTZipPluginInstaller.shared
        let mockContext = MockHostContext()
        
        // 1. Execute end-to-end atomic installation
        let pluginToInstall = TTZipMarketplacePlugin(
            id: fallback.id,
            name: fallback.name,
            displayName: fallback.displayName,
            version: fallback.version,
            author: fallback.author,
            description: fallback.description,
            minHostVersion: fallback.minHostVersion,
            homepage: fallback.homepage,
            downloadUrl: zipURL.absoluteString,
            size: fallback.size,
            sha256: fallback.sha256,
            signature: fallback.signature,
            publicKey: fallback.publicKey,
            permissions: fallback.permissions,
            publishedAt: fallback.publishedAt
        )
        try await installer.install(plugin: pluginToInstall, context: mockContext)
        
        // 2. Verify Registry mounting
        let installed = TTZipPluginRegistry.shared.installedPlugins
        #expect(!installed.isEmpty)
        #expect(installed.contains(where: { $0.manifest.id == fallback.id }))
        
        // 3. Verify sidebar contribution dynamic mounting
        let sidebarItems = TTZipPluginRegistry.shared.sidebarItems
        #expect(sidebarItems.contains(where: { $0.id == "larksync.sidebar" }))
        
        // 4. Verify unregistration and cleanup
        await TTZipPluginRegistry.shared.unregister(pluginId: fallback.id)
        #expect(!TTZipPluginRegistry.shared.installedPlugins.contains(where: { $0.manifest.id == fallback.id }))
        #expect(!TTZipPluginRegistry.shared.sidebarItems.contains(where: { $0.id == "larksync.sidebar" }))
    }
}
