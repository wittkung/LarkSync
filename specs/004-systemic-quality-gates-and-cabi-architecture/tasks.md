# Tasks: TTZip 插件系统级质量门禁与跨 Mach-O 架构治理

## Phase 1: Setup & Contracts (基础设施与契约定义)
- [x] T001 [P] 校验并在 `apple/Sources/TTZipPluginKit/TTZipExtensionPoints.swift` 规范化 `TTZipContribution` 协议与 `ownerPluginId` 强绑定
- [x] T002 [P] 固化 C-ABI 虚函数表结构体 `TTZipPluginVTable_v1` 到 `apple/Sources/TTZipPluginKit/TTZipPlugin.swift`

## Phase 2: Foundational Architecture & Decoupling (基础架构解耦)
- [x] T003 彻底解耦宿主 `products/ttzip/apple/Package.swift`，移除对 `LarkSyncUI` 的编译依赖
- [x] T004 彻底解耦 `products/ttzip/apple/Sources/TTZipApp/Views/MainView.swift`，移除硬编码 `import LarkSyncUI`，统一由 `registry.installedPlugins` 动态分发
- [x] T005 [P] 在 `apple/Sources/TTZipPluginKit/TTZipPluginRegistry.swift` 中实现基于 `pluginId` 分区存储与确定性清理状态机

## Phase 3: User Story 1 (US1) - 跨 Mach-O C-ABI 通信与 原生 UI 桥接 (P1)
- [x] T006 [P] [US1] 在 `apple/Sources/LarkSyncPlugin/LarkSyncPlugin.swift` 导出 `@_cdecl("getTTZipPluginVTable_v1")` 与 `NSHostingView` 桥接
- [x] T007 [P] [US1] 在 `apple/Sources/TTZipPluginKit/TTZipPluginLoader.swift` 接入 `TTZipCABIPluginAdapter` 与 `HostNativePluginViewWrapper`

## Phase 4: User Story 2 (US2) - SSOT 自动化发布工具链与防漂移 (P1)
- [x] T008 [US2] 升级 `scripts/dev-release.sh` 支持原子计算 SHA-256、Ed25519 签名并自动回填 `marketplace.json` 与 `TTZipMarketplaceModel.swift`
- [x] T009 [P] [US2] 在 `scripts/dev-release.sh verify` 增加三方物理一致性与 CryptoKit 严格校验断言

## Phase 5: User Story 3 (US3) - 真实网络 E2E 探测与分发门禁 (P2)
- [x] T010 [US3] 创建 `scripts/verify-distribution-e2e.sh` 真实网络可达性与密码学校验门禁脚本
- [x] T011 [P] [US3] 在 `apple/Sources/TTZipPluginKit/TTZipPluginInstaller.swift` 注入合法 User-Agent、防跨域 Token 泄露与 Zip Magic Header 校验

## Phase 6: User Story 4 (US4) - 全屏 Onboarding 与全状态三栏 UX 闭环 (P2)
- [x] T012 [P] [US4] 在 `apple/Sources/LarkSyncUI/LarkWorkspaceView.swift` 实现未配置凭证时的全屏 Hero Onboarding 视图
- [x] T013 [P] [US4] 在 `apple/Sources/LarkSyncUI/LarkWorkspaceView.swift` 增加骨架屏加载微光与未选文档 Zen 欢迎页
- [x] T014 [US4] 修复 `loadLocalDocument`，杜绝向本地 Markdown 注入虚假占位字符串

## Phase 7: Polish & Automated Quality Gates (全量门禁与实机 Smoke)
- [x] T015 创建 `scripts/verify_bundle_linkage.sh` 并接入 `products/ttzip/apple/scripts/bundle_app.sh`
- [x] T016 运行全量 `swift test` 验证 6 项测试 100% 毫秒级通过
- [x] T017 运行 `bundle_app.sh --release --open` 进行实机桌面 Smoke 测试并验证 0 崩溃与全流程闭环
