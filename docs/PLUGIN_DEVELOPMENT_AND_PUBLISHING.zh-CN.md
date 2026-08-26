# TTZip 插件开发、打包、签名与上架全流程指南 (Plugin Development & Marketplace Publishing Guide)

<p align="center">
  <b>简体中文</b> | <a href="PLUGIN_DEVELOPMENT_AND_PUBLISHING.md">English</a>
</p>

本文档面向所有希望为 **TTZip / ttsubs** 桌面应用生态开发扩展插件的第三方开发者与社区贡献者，详细介绍从零开发、本地调试、密码学签名到提交官方插件商店（Marketplace）上架的完整流程。

---

## 目录

1. [插件系统架构与隔离模型](#1-插件系统架构与隔离模型)
2. [快速开始：从模板创建插件](#2-快速开始从模板创建插件)
3. [标准扩展点与 Manifest 声明](#3-标准扩展点与-manifest-声明)
4. [本地编译与热插拔调试](#4-本地编译与热插拔调试)
5. [CI/CD 自动化构建与 Ed25519 密码学签名](#5-cicd-自动化构建与-ed25519-密码学签名)
6. [上架官方插件商店 (GitOps 流程)](#6-上架官方插件商店-gitops-流程)
7. [自建第三方私有源 (Community Tap)](#7-自建第三方私有源-community-tap)

---

## 1. 插件系统架构与隔离模型

TTZip 采用**微内核与动态扩展架构**：
- **宿主本体零耦合**：TTZipApp 宿主仅依赖纯契约库 `TTZipPluginKit`，不依赖任何具体插件业务代码；
- **运行时反射加载**：宿主扫描 `~/Library/Application Support/TTZip/Plugins/` 目录下的 `.ttplugin` Bundle 包并安全反射实例化；
- **基于能力的安全沙盒 (OCap)**：插件通过 `TTZipHostContext` 访问 Keychain、文件系统与网络，所有权限由宿主按 Manifest 严格仲裁；
- **崩溃软失败保护 (Soft-Fail)**：插件缺失或崩溃绝不影响 TTZip 核心的压缩、解压与归档浏览功能。

---

## 2. 快速开始：从模板创建插件

### 2.1 依赖引入
在您的 Swift Package (`Package.swift`) 中引入 `TTZipPluginKit`：

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MyCustomPlugin",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "MyCustomPlugin", type: .dynamic, targets: ["MyCustomPlugin"])
    ],
    dependencies: [
        .package(path: "../larksync/apple") // 或通过 Git URL 引用 TTZipPluginKit
    ],
    targets: [
        .target(
            name: "MyCustomPlugin",
            dependencies: [
                .product(name: "TTZipPluginKit", package: "apple")
            ]
        )
    ]
)
```

### 2.2 实现 `TTZipPlugin` 协议入口

```swift
import SwiftUI
import TTZipPluginKit

@objc(MyCustomPlugin)
public final class MyCustomPlugin: NSObject, TTZipPlugin {
    public let manifest: TTZipPluginManifest
    private var hostContext: TTZipHostContext?
    
    public override init() {
        self.manifest = TTZipPluginManifest(
            id: "com.example.myplugin",
            name: "MyCustomPlugin",
            displayName: "我的自定义插件",
            version: "1.0.0",
            author: "Developer Name",
            description: "插件功能简介",
            minHostVersion: "1.0.0",
            permissions: [.network, .fsWrite],
            entryPoint: "MyCustomPlugin"
        )
        super.init()
    }
    
    public func onInitialize(context: TTZipHostContext) async throws {
        self.hostContext = context
        print("[\(manifest.name)] 初始化成功！")
    }
    
    public func onTerminate() async {
        print("[\(manifest.name)] 正在卸载...")
    }
    
    // 贡献侧边栏项
    public var sidebarContribution: TTZipSidebarContribution? {
        TTZipSidebarContribution(
            id: "myplugin.sidebar",
            title: "我的工作区",
            icon: "sparkles",
            targetTabIdentifier: "myplugin.workspace",
            priority: 200
        )
    }
    
    // 提供工作区主界面
    public func makeWorkspaceView(tabIdentifier: String) -> AnyView? {
        if tabIdentifier == "myplugin.workspace" {
            return AnyView(
                VStack {
                    Text("欢迎使用我的自定义插件！")
                        .font(.title)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            )
        }
        return nil
    }
}
```

---

## 3. 标准扩展点与 Manifest 声明

`TTZipPluginKit` 提供 8 大标准扩展点：
1. **侧边栏扩展 (`TTZipSidebarContribution`)**：动态在 TTZip 左侧导航栏增加专属 Tab；
2. **工作区容器 (`makeWorkspaceView`)**：嵌入插件的主交互界面；
3. **检查器面板 (`makeInspectorView`)**：在右侧 Pro 检查器中挂载元数据面板；
4. **预览器提供者 (`TTZipPreviewProvider`)**：为特殊文件扩展名提供原生 QuickLook 视图；
5. **虚拟归档数据源 (`TTZipVirtualArchiveDataSource`)**：将云端或外部数据虚拟化为可流式打包的归档源；
6. **全局 Omnibar 命令 (`TTZipOmnibarCommand`)**：在快捷指令栏中注册操作；
7. **上下文菜单 (`TTZipContextMenuContribution`)**：在文件列表中增加右键菜单动作；
8. **安全保险箱 (`TTZipKeychainStore`)**：租户隔离的安全凭证管理。

---

## 4. 本地编译与热插拔调试

使用 `build-plugin.sh` 脚本可将代码编译为标准的 `.ttplugin` Bundle：

```bash
# 编译并一键安装到本地 TTZip 用户目录
./scripts/build-plugin.sh --install-user
```

启动 TTZip，宿主会自动动态加载该插件，左侧边栏即时显示您声明的工作区！

---

## 5. CI/CD 自动化构建与 Ed25519 密码学签名

为了保障分发安全，所有发布到插件商店的 `.ttplugin.zip` 必须附带 **Ed25519 数字签名** 与 **SHA-256 校验和**。

### 5.1 本地自动化打包脚本 (`dev-release.sh`)
在插件仓库根目录下运行：

```bash
# 1. 生成 Ed25519 密钥对
./scripts/dev-release.sh keygen

# 2. 全量打包并生成签名
./scripts/dev-release.sh pack 1.0.0

# 产物清单:
# dist/MyPlugin-v1.0.0.ttplugin.zip       (归档包)
# dist/MyPlugin-v1.0.0.ttplugin.zip.sig   (Ed25519 签名)
# dist/checksums.txt                     (SHA-256 哈希)

# 3. 本地验签自检
./scripts/dev-release.sh verify 1.0.0
```

### 5.2 GitHub Actions 自动化发版
将 `dev-release.sh` 中生成的私钥 Base64 填入仓库的 GitHub Secrets (`PLUGIN_SIGNING_PRIVATE_KEY_B64`)，推送 Git Tag `v1.0.0` 时将自动执行编译、签名并发布 GitHub Release。

---

## 6. 上架官方插件商店 (GitOps 流程)

当您在自己的 GitHub 仓库完成 Release 发布后，按以下步骤上架至官方市场：

1. **Fork 官方市场仓库**：`https://github.com/KevinTungs/LarkSync`（或 `ttzip-marketplace`）；
2. **编辑 `marketplace.json`**：在 `plugins` 列表中追加您的插件条目：

```json
{
  "id": "com.example.myplugin",
  "name": "MyPlugin",
  "displayName": "我的自定义插件",
  "version": "1.0.0",
  "author": "Your Name <you@example.com>",
  "description": "插件功能简介...",
  "minHostVersion": "1.0.0",
  "homepage": "https://github.com/yourname/myplugin",
  "downloadUrl": "https://github.com/yourname/myplugin/releases/download/v1.0.0/MyPlugin-v1.0.0.ttplugin.zip",
  "size": 15284910,
  "sha256": "4a7b9c1d2e...4f5a",
  "signature": "V2hh...==",
  "publicKey": "9d8e...==",
  "permissions": ["Network", "FS-Write"],
  "publishedAt": "2026-08-26T12:00:00Z"
}
```

3. **提交 Pull Request**：
   - 官方 CI 机器人会自动拉取您的 Release 包，验证 SHA-256 与 Ed25519 签名，并进行沙盒权限审计；
   - 审查通过并 Merge 后，**全球所有 TTZip 用户的插件中心将瞬时展现您的插件，支持一键安装！**

---

## 7. 自建第三方私有源 (Community Tap)

如果您是企业内部或希望自建插件分发源，无需向官方提 PR：
1. 在您自己的服务器或 GitHub 托管一个静态 `marketplace.json`；
2. 用户在 TTZip 插件中心配置中填入该 `https://your-domain.com/marketplace.json` 链接，即可直接订阅并安装您的私有插件生态！
