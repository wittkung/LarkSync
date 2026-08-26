# Interface Contract: TTZipPluginKit Protocol Specification

- **Feature Directory**: `specs/001-larksync-ttzip-plugin-wysiwyg-editor`
- **Module**: `TTZipPluginKit`
- **Language**: Swift 6 (Strict Concurrency)

---

## 1. Root Plugin Protocol

```swift
@MainActor
public protocol TTZipPlugin: AnyObject {
    var manifest: TTZipPluginManifest { get }
    
    func onInitialize(context: TTZipHostContext) async throws
    func onTerminate() async
    
    var sidebarItem: TTZipSidebarContribution? { get }
    @ViewBuilder func makeWorkspaceView(tabIdentifier: String) -> AnyView?
    @ViewBuilder func makeInspectorView(selectedContext: Any?) -> AnyView?
    var previewProviders: [TTZipPreviewProvider] { get }
    var archiveSourceProviders: [TTZipArchiveSourceProvider] { get }
    var omnibarCommands: [TTZipCommandAction] { get }
    var contextMenuActions: [TTZipContextMenuAction] { get }
}
```

---

## 2. The 8 Standard Extension Points

1. **`TTZipSidebarContribution`**: Injects navigation icon & title into WSJ 52pt header bar sidebar.
2. **`WorkspaceViewProvider`**: Returns SwiftUI view for custom 3-column workspace tabs.
3. **`InspectorViewProvider`**: Dynamic Pro metadata cards in the right 280pt inspector.
4. **`TTZipPreviewProvider`**: Handles document & media previews for specific file extensions.
5. **`TTZipArchiveSourceProvider`**: Virtual File System data source for streaming archiving.
6. **`TTZipCommandAction`**: Omnibar (`⌥⌘S` / `⌘K`) shortcuts & global palette commands.
7. **`TTZipContextMenuAction`**: Right-click actions for file entries in Miller columns.
8. **`TTZipKeychainStore`**: Secure credentials access for API tokens & app secrets.
