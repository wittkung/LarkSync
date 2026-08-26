// SPDX-License-Identifier: MIT
//
// TTZipPluginKit: Root plugin protocol.

import SwiftUI

/// 插件根协议 (Root Plugin Protocol)
@MainActor
public protocol TTZipPlugin: AnyObject {
    /// 插件静态清单
    var manifest: TTZipPluginManifest { get }
    
    /// 生命周期钩子
    func onInitialize(context: TTZipHostContext) async throws
    func onTerminate() async
    
    /// 8 大标准扩展点贡献 (默认提供空实现，插件按需覆盖)
    var sidebarItem: TTZipSidebarContribution? { get }
    @ViewBuilder func makeWorkspaceView(tabIdentifier: String) -> AnyView?
    @ViewBuilder func makeInspectorView(selectedContext: Any?) -> AnyView?
    var previewProviders: [TTZipPreviewProvider] { get }
    var archiveSourceProviders: [TTZipArchiveSourceProvider] { get }
    var omnibarCommands: [TTZipCommandAction] { get }
    var contextMenuActions: [TTZipContextMenuAction] { get }
}

public extension TTZipPlugin {
    var sidebarItem: TTZipSidebarContribution? { nil }
    func makeWorkspaceView(tabIdentifier: String) -> AnyView? { nil }
    func makeInspectorView(selectedContext: Any?) -> AnyView? { nil }
    var previewProviders: [TTZipPreviewProvider] { [] }
    var archiveSourceProviders: [TTZipArchiveSourceProvider] { [] }
    var omnibarCommands: [TTZipCommandAction] { [] }
    var contextMenuActions: [TTZipContextMenuAction] { [] }
}
