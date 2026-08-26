# Data Model: 插件商店与安装引擎数据模型

## 1. 商店索引模型 (`TTZipMarketplaceIndex`)

```swift
public struct TTZipMarketplaceIndex: Codable, Sendable {
    public let version: Int
    public let updatedAt: String
    public let plugins: [TTZipMarketplacePlugin]
}

public struct TTZipMarketplacePlugin: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let displayName: String
    public let version: String
    public let author: String
    public let description: String
    public let minHostVersion: String
    public let homepage: String
    public let downloadUrl: String
    public let size: Int64
    public let sha256: String
    public let signature: String
    public let publicKey: String
    public let permissions: [String]
    public let publishedAt: String
}
```

---

## 2. 安装状态机模型 (`PluginInstallPhase`)

```swift
public enum PluginInstallPhase: Sendable, Equatable {
    case idle
    case downloading(progress: DownloadProgress)
    case verifyingHash
    case verifyingSignature
    case staging
    case committing
    case hotLoading
    case installed(pluginId: String)
    case failed(reason: String)
}

public struct DownloadProgress: Sendable, Equatable {
    public let bytesWritten: Int64
    public let totalBytesExpected: Int64?
    public let fractionCompleted: Double?
    public let bytesPerSecond: Double
}
```
