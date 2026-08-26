# TTZip Plugin Development, Packaging, Signing & Marketplace Guide

<p align="center">
  <a href="PLUGIN_DEVELOPMENT_AND_PUBLISHING.zh-CN.md">简体中文</a> | <b>English</b>
</p>

This document is dedicated to all developers and community contributors who wish to build extensions for the **TTZip / ttsubs** desktop ecosystem. It provides an end-to-end guide covering local development, sandbox declaration, cryptographic signing, CI/CD automation, and publishing to the official Marketplace.

---

## Table of Contents

1. [Plugin System Architecture & Isolation Model](#1-plugin-system-architecture--isolation-model)
2. [Quickstart: Creating a Plugin from Template](#2-quickstart-creating-a-plugin-from-template)
3. [Standard Extension Points & Manifest Declaration](#3-standard-extension-points--manifest-declaration)
4. [Local Compilation & Live Hot-Reloading](#4-local-compilation--live-hot-reloading)
5. [CI/CD Automated Cross-Compilation & Ed25519 Signing](#5-cicd-automated-cross-compilation--ed25519-signing)
6. [Publishing to the Official Marketplace (GitOps Workflow)](#6-publishing-to-the-official-marketplace-gitops-workflow)
7. [Self-Hosted Third-Party Taps (Community Taps)](#7-self-hosted-third-party-taps-community-taps)

---

## 1. Plugin System Architecture & Isolation Model

TTZip is built upon a **microkernel dynamic extension architecture**:
- **Zero Host Coupling**: The host application `TTZipApp` depends strictly on the contract SDK `TTZipPluginKit` with zero hardcoded business logic.
- **Dynamic Bundle Reflection**: The host scans `.ttplugin` bundles located in `~/Library/Application Support/TTZip/Plugins/` and safely instantiates the declared `principalClass`.
- **Object-Capability (OCap) Sandbox**: Plugins interact with the Keychain, filesystem, and network exclusively through `TTZipHostContext`.
- **Soft-Fail Fault Isolation**: Any missing or crashing plugin is isolated gracefully, guaranteeing that core compression and extraction features remain 100% operational.

---

## 2. Quickstart: Creating a Plugin from Template

### 2.1 Package Dependencies
Declare `TTZipPluginKit` in your `Package.swift`:

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
        .package(path: "../larksync/apple") // or remote Git URL
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

### 2.2 Implementing the `TTZipPlugin` Protocol

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
            displayName: "My Custom Extension",
            version: "1.0.0",
            author: "Developer Name",
            description: "Extension brief description",
            minHostVersion: "1.0.0",
            permissions: [.network, .fsWrite],
            entryPoint: "MyCustomPlugin"
        )
        super.init()
    }
    
    public func onInitialize(context: TTZipHostContext) async throws {
        self.hostContext = context
        print("[\(manifest.name)] Initialized successfully!")
    }
    
    public func onTerminate() async {
        print("[\(manifest.name)] Terminating...")
    }
    
    // Contribute a sidebar tab
    public var sidebarContribution: TTZipSidebarContribution? {
        TTZipSidebarContribution(
            id: "myplugin.sidebar",
            title: "My Workspace",
            icon: "sparkles",
            targetTabIdentifier: "myplugin.workspace",
            priority: 200
        )
    }
    
    // Provide the workspace view
    public func makeWorkspaceView(tabIdentifier: String) -> AnyView? {
        if tabIdentifier == "myplugin.workspace" {
            return AnyView(
                VStack {
                    Text("Welcome to My Custom Extension!")
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

## 3. Standard Extension Points & Manifest Declaration

`TTZipPluginKit` provides 8 standard extension points:
1. **Sidebar Contribution (`TTZipSidebarContribution`)**: Mounts custom tabs on the host left navigation bar;
2. **Workspace Container (`makeWorkspaceView`)**: Houses the extension main interactive view;
3. **Inspector Panel (`makeInspectorView`)**: Extends the right Pro inspector sidebar;
4. **Preview Provider (`TTZipPreviewProvider`)**: Native QuickLook rendering for specialized file extensions;
5. **Virtual Archive DataSource (`TTZipVirtualArchiveDataSource`)**: Streams remote or custom data directly into compression pipelines;
6. **Global Omnibar Commands (`TTZipOmnibarCommand`)**: Registers shortcuts into the quick command palette;
7. **Context Menu (`TTZipContextMenuContribution`)**: Adds custom actions to file context menus;
8. **Secure Keychain Vault (`TTZipKeychainStore`)**: Tenant-scoped encrypted credential management.

---

## 4. Local Compilation & Live Hot-Reloading

Use the included `build-plugin.sh` script to compile your code into a standard `.ttplugin` bundle:

```bash
# Build and install directly to the local TTZip user directory
./scripts/build-plugin.sh --install-user
```

Launch TTZip—the host will automatically scan and hot-mount your plugin, and your workspace tab will appear immediately on the sidebar!

---

## 5. CI/CD Automated Cross-Compilation & Ed25519 Signing

To protect users against supply chain tampering, all packages published to the Marketplace must carry an **Ed25519 digital signature** and a **SHA-256 checksum**.

### 5.1 Local Developer Packaging Tool (`dev-release.sh`)
Run in the root directory:

```bash
# 1. Generate Ed25519 keypair
./scripts/dev-release.sh keygen

# 2. Package and sign release bundle
./scripts/dev-release.sh pack 1.0.0

# 3. Verify signature locally
./scripts/dev-release.sh verify 1.0.0
```

### 5.2 GitHub Actions Release Automation
Store the generated private key seed in your repository GitHub Secrets (`PLUGIN_SIGNING_PRIVATE_KEY_B64`). Pushing a Git Tag `v1.0.0` will automatically compile Universal binaries, sign the archive, and create a GitHub Release.

---

## 6. Publishing to the Official Marketplace (GitOps Workflow)

Once your GitHub Release is published:

1. **Fork the Marketplace Repository**: `https://github.com/KevinTungs/LarkSync` (or `ttzip-marketplace`);
2. **Edit `marketplace.json`**: Append your extension metadata entry into the `plugins` list:

```json
{
  "id": "com.example.myplugin",
  "name": "MyPlugin",
  "displayName": "My Custom Extension",
  "version": "1.0.0",
  "author": "Your Name <you@example.com>",
  "description": "Brief description of the extension...",
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

3. **Submit a Pull Request**:
   - Official CI robots will automatically download the archive, verify SHA-256 and Ed25519 signatures, and run sandbox permission audits;
   - Once merged, **your extension will instantly appear in the Plugin Marketplace for all TTZip users worldwide!**

---

## 7. Self-Hosted Third-Party Taps (Community Taps)

For private enterprise distribution or internal team extensions:
1. Host your own static `marketplace.json` on any web server or GitHub Pages;
2. Users can simply add `https://your-domain.com/marketplace.json` under TTZip Settings to subscribe and install your private extensions directly.
