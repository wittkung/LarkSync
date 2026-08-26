# Research: TTZip 插件系统级质量门禁与跨 Mach-O 架构治理

## 决策与结论总结 (Consolidated Findings)

### 1. dyld 运行时加载与 Mach-O 洁净度 (Decision: 宿主纯静态化 + 插件自包含 Bundle)
- **结论**：宿主 `TTZipApp` 仅依赖静态契约 SDK `TTZipPluginKit`。
- **依据**：dyld 在用户态入口前解析 `LC_LOAD_DYLIB`，任何非弱链接缺失即触发不可捕获的 `SIGABRT` 闪退。
- **方案**：引入 `verify_bundle_linkage.sh`，强制执行 5 项二进制门禁。

### 2. Swift 6 跨 dylib 协议隔离突破 (Decision: C-ABI VTable + NSHostingView 桥接)
- **结论**：废弃不可靠的 `as? TTZipPlugin` 跨库强转，使用 `struct TTZipPluginVTable_v1` 结构体函数指针进行通信。
- **依据**：Swift 编译器生成的 `ProtocolDescriptor` 在不同 Mach-O 中存在物理地址分裂，`swift_conformsToProtocol` 判定恒为 `false`。Objective-C 类跨镜像全局唯一，使用 `NSHostingView` (`NSView*`) 传递 SwiftUI View 零元数据损失。

### 3. 响应式生命周期与 Tab 驱逐 (Decision: pluginId 分区存储 + KeepAliveTabContainer 驱逐)
- **结论**：所有扩展点显式绑定 `ownerPluginId`；`KeepAliveTabContainer` 监听卸载通知并主动从 `visitedTabs` 驱逐。
- **依据**：避免字符串前缀匹配失效与缓存视图驻留内存引发的僵尸态。

### 4. SSOT 发布工具链与哈希对齐 (Decision: 物理产物驱动回填)
- **结论**：`scripts/dev-release.sh pack` 编译打包后，以生成的 Zip 为单一事实源，自动正则更新 `marketplace.json` 与 `TTZipMarketplaceModel.swift`。
- **依据**：根治多处硬编码导致的人工同步滞后与哈希漂移。

### 5. 云端分发协议与真实网络 E2E (Decision: 标准 User-Agent + 缓存穿透 + 真实网络探测)
- **结论**：注入合法 `User-Agent`，在获取索引时附加 `no-cache` 与时间戳参数；CI 强制挂载 `verify-distribution-e2e.sh`。
- **依据**：击穿 Fastly 300s TTL 缓存并杜绝 GitHub WAF 拦截与 404 伪装。

### 6. 全状态交互闭环与零状态 Onboarding (Decision: 全屏向导 + 情境感知空状态)
- **结论**：未配置凭证时全屏渲染液态玻璃连接向导；三栏米勒列引入骨架屏与未选空间/文档卡片。
- **依据**：消除三栏灰白空白与死循环转圈，彻底阻断虚假占位文本写入本地文件。
