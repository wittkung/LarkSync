# Interface Contract: Scoped Host Context & OCap Enforcement

- **Feature Directory**: `specs/002-ttzip-plugin-engine-and-larksync-deepening`
- **Module**: `TTZipPluginKit`
- **Language**: Swift 6 (Strict Concurrency)

---

## 1. Protocol Definition

```swift
public struct SubscriptionToken: Sendable, Hashable {
    public let id: UUID
    public init() { self.id = UUID() }
}

@MainActor
public protocol TTZipHostContext: AnyObject {
    var pluginIdentifier: String { get }
    var keychain: TTZipKeychainStore { get }
    
    func createArchive(sources: [URL], destination: URL, format: String, level: Int) async throws -> URL
    func showNotification(title: String, message: String, level: TTZipNotificationLevel)
    func setGlobalProgress(progress: Double?, statusText: String?)
    
    // Strong-typed EventBus with explicit unsubscription
    func subscribeEvent<T: Sendable & Codable>(_ type: T.Type, name: String, handler: @escaping @Sendable (T) -> Void) -> SubscriptionToken
    func unsubscribeEvent(token: SubscriptionToken)
    func publishEvent<T: Sendable & Codable>(name: String, event: T)
}
```
