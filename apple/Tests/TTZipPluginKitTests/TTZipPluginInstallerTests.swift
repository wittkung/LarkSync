// SPDX-License-Identifier: MIT
//
// TTZipPluginInstallerTests: End-to-end integration tests for plugin installer and registry.

import XCTest
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

final class TTZipPluginInstallerTests: XCTestCase {
    
    @MainActor
    func testAtomicInstallPipeline() async throws {
        let fallback = TTZipMarketplaceService.fallbackPlugin
        let zipURL = URL(fileURLWithPath: "/Users/kevintung/Documents/dev/studio-lab/larksync/dist/LarkSync-v\(fallback.version).ttplugin.zip")
        guard FileManager.default.fileExists(atPath: zipURL.path) else {
            return // 若本地未打包则跳过
        }
        
        let installer = TTZipPluginInstaller.shared
        let mockContext = MockHostContext()
        
        // 1. 执行端到端完整原子安装 (包含 SHA256 校验、Ed25519 验签、解压与 APFS 替换)
        try await installer.install(plugin: fallback, context: mockContext)
        
        // 2. 验证 Registry 已挂载
        let installed = TTZipPluginRegistry.shared.installedPlugins
        XCTAssertFalse(installed.isEmpty)
        XCTAssertTrue(installed.contains(where: { $0.manifest.id == fallback.id }))
        
        // 3. 验证侧边栏项已动态挂载
        let sidebarItems = TTZipPluginRegistry.shared.sidebarItems
        XCTAssertTrue(sidebarItems.contains(where: { $0.id == "larksync.sidebar" }))
        
        // 4. 验证反注册与卸载 (包括 Registry 与 侧边栏贡献项全部同步移除)
        await TTZipPluginRegistry.shared.unregister(pluginId: fallback.id)
        XCTAssertFalse(TTZipPluginRegistry.shared.installedPlugins.contains(where: { $0.manifest.id == fallback.id }))
        XCTAssertFalse(TTZipPluginRegistry.shared.sidebarItems.contains(where: { $0.id == "larksync.sidebar" }))
    }
}
