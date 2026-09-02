// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import SwiftUI
import TTZipPluginKit
import TTMarkdownKit
import LarkSyncCore
import LarkSyncUI

@objc(LarkSyncPlugin)
public final class LarkSyncPlugin: NSObject, TTZipPlugin {
    public let manifest = TTZipPluginManifest(
        id: "com.ttzip.plugin.larksync",
        name: "飞书知识库同步",
        version: "1.0.2",
        author: "Witt Kung",
        description: "双向增量同步飞书知识库，支持 DocX 高保真 Markdown 互转、类 Typora 所见即所得编辑与一键 zstd 归档备份",
        iconSystemName: "cloud.fill",
        homepage: URL(string: "https://github.com/wittkung/LarkSync"),
        permissions: [.networkAccess, .keychainAccess, .fileSystemWrite, .archiveEngine]
    )
    
    private var hostContext: TTZipHostContext?
    @MainActor private lazy var store = LarkSyncStore(hostContext: self.hostContext)
    
    public override init() {
        super.init()
    }
    
    public func onInitialize(context: TTZipHostContext) async throws {
        self.hostContext = context
        self.store.setHostContext(context)
        await store.loadCredentialsAndInitialize()
    }
    
    public func onTerminate() async {}
    
    // 1. Sidebar contribution
    public var sidebarItem: TTZipSidebarContribution? {
        TTZipSidebarContribution(
            id: "larksync.sidebar",
            title: "飞书知识库",
            icon: "doc.text.below.ecg.fill",
            badgeText: "Sync",
            targetTabIdentifier: "larksync.workspace",
            priority: 20
        )
    }
    
    // 2. Main workspace view contribution (3-column Miller Columns)
    public func makeWorkspaceView(tabIdentifier: String) -> AnyView? {
        guard tabIdentifier == "larksync.workspace" else { return nil }
        return AnyView(LarkWorkspaceView(store: self.store))
    }
    
    // 3. Pro inspector view contribution
    public func makeInspectorView(selectedContext: Any?) -> AnyView? {
        return AnyView(LarkInspectorView())
    }
    
    // 4. Global Omnibar command contribution
    public var omnibarCommands: [TTZipCommandAction] {
        [
            TTZipCommandAction(
                id: "larksync.sync_now",
                title: "飞书: 立即增量同步知识库",
                icon: "arrow.triangle.2.circlepath",
                shortcut: "⌥⌘S"
            ) { [weak self] in
                Task { @MainActor in
                    await self?.store.triggerIncrementalSync()
                }
            }
        ]
    }
}

/// Dynamic factory function for TTZipPluginLoader.
@_cdecl("createTTZipPlugin")
@MainActor
public func createTTZipPlugin() -> UnsafeMutableRawPointer {
    let plugin = LarkSyncPlugin()
    return Unmanaged.passRetained(plugin).toOpaque()
}

@_cdecl("createTTZipPlugin_v1")
@MainActor
public func createTTZipPlugin_v1() -> UnsafeMutableRawPointer {
    createTTZipPlugin()
}

#if os(macOS)
import AppKit

@_cdecl("getLarkSyncWorkspaceView_c")
@MainActor
public func getLarkSyncWorkspaceView_c(rawPluginPtr: UnsafeMutableRawPointer, tabIdCString: UnsafePointer<CChar>) -> UnsafeMutableRawPointer? {
    let plugin = Unmanaged<LarkSyncPlugin>.fromOpaque(rawPluginPtr).takeUnretainedValue()
    let tabId = String(cString: tabIdCString)
    guard let view = plugin.makeWorkspaceView(tabIdentifier: tabId) else { return nil }
    let nsView = NSHostingView(rootView: view)
    return Unmanaged.passRetained(nsView).toOpaque()
}

@_cdecl("createTTZipWorkspaceView")
@MainActor
public func createTTZipWorkspaceView(rawPluginPtr: UnsafeMutableRawPointer, tabIdCString: UnsafePointer<CChar>) -> UnsafeMutableRawPointer? {
    getLarkSyncWorkspaceView_c(rawPluginPtr: rawPluginPtr, tabIdCString: tabIdCString)
}
#endif
