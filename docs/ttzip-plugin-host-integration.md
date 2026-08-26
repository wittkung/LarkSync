# TTZip 宿主端插件插槽集成指南 (Host Integration Guide)

本文档指导如何在 TTZip 宿主应用本体 (`products/ttzip`) 中接入 `TTZipPluginKit`，实现动态侧边栏 Tab 注入、工作区视图渲染与预览器挂载。

---

## 1. 宿主 Package.swift 依赖声明

在 `products/ttzip/apple/Package.swift` 中添加 `TTZipPluginKit` 依赖：

```swift
// Package.swift
dependencies: [
    .package(path: "../../studio-lab/larksync/apple")
],
targets: [
    .executableTarget(
        name: "TTZipApp",
        dependencies: [
            .product(name: "TTZipPluginKit", package: "LarkSync"),
            .product(name: "LarkSyncPlugin", package: "LarkSync")
        ]
    )
]
```

---

## 2. 宿主侧边栏动态 Tab 渲染 (`MacEditorialSidebar.swift`)

在 `MacEditorialSidebar` 中使用 `TTZipPluginRegistry.shared.sidebarItems` 替代静态硬编码 Tab：

```swift
ForEach(pluginRegistry.sidebarItems) { item in
    SidebarTabButton(
        title: item.title,
        icon: item.icon,
        badge: item.badgeText,
        isSelected: selectedTab == item.targetTabIdentifier
    ) {
        selectedTab = item.targetTabIdentifier
    }
}
```

---

## 3. 宿主主工作区动态视图渲染 (`MainView.swift`)

在 `MainView` 的内容区域根据 `selectedTab` 查询已注册的插件：

```swift
if let plugin = pluginRegistry.installedPlugins.first(where: { $0.sidebarItem?.targetTabIdentifier == selectedTab }),
   let customView = plugin.makeWorkspaceView(tabIdentifier: selectedTab) {
    customView
} else {
    // 默认内置工作区 (Compress, Presets, Vault 等)
}
```
