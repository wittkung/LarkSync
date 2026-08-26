# Feature Spec: TTZip 插件系统级质量门禁、C-ABI 架构治理与全状态交互闭环

**Feature 目录**: `specs/004-systemic-quality-gates-and-cabi-architecture`  
**流水线分级**: `[Full SDD]`  
**提出背景**: 经全面深度审计，针对此前暴露的 dyld 启动崩溃、Swift 跨 dylib 协议转换失效、状态机未闭环、哈希漂移、公网权限/CDN 缓存盲区及三栏大面积空白等 6 大深层问题，建立工业级长效架构治理与 4 大强制质量门禁体系。

---

## 一、 功能需求与系统边界 (Functional Requirements)

### 1. 架构与加载层边界 (Architecture & Linkage Boundary)
- **FR-01 (微内核解耦)**：宿主 `TTZipApp` 必须 100% 移除对任何业务插件（包括 `LarkSyncUI`）的编译期依赖，仅依赖静态契约 SDK `TTZipPluginKit`。
- **FR-02 (C-ABI 统一函数表)**：业务插件 `.ttplugin` 与宿主之间必须通过标准的 C-ABI VTable 虚函数表（`TTZipPluginVTable_v1`）与 `@_cdecl` 入口进行强类型跨 Mach-O 边界通信，彻底废弃易受 Swift 泛型元数据隔离影响的死代码。
- **FR-03 (原生 UI 跨库桥接)**：插件端通过 AppKit `NSHostingView` 封装原生 SwiftUI View，通过 C 指针跨边界传递，宿主端使用 `NSViewRepresentable` 无缝嵌入，实现零延迟、零元数据损失的渲染。

### 2. 状态机与生命周期边界 (Lifecycle & Reactive State Machine)
- **FR-04 (扩展点所有权强绑定)**：所有扩展点（侧边栏、命令、右键菜单、预览器等）必须显式标记 `ownerPluginId`。
- **FR-05 (确定性反注册与 Tab 驱逐)**：卸载插件时，按 `pluginId` 精准 $O(1)$ 清除所有贡献项，并通过通知驱动 `KeepAliveTabContainer` 物理销毁对应 View 节点，导航控制器自动原子回退至 `.home` 主页，杜绝残留与僵尸态。

### 3. 发布流水线与 SSOT 边界 (SSOT Release Pipeline)
- **FR-06 (单一事实来源)**：打包脚本必须以物理 `.ttplugin.zip` 为唯一事实源，自动计算精确字节大小、SHA-256 哈希与 Ed25519 签名，并原子同步回填 `marketplace.json` 与 `TTZipMarketplaceModel.swift`。
- **FR-07 (密钥持久化与保护)**：禁止在缺少私钥时静默生成随机临时私钥，发布必须绑定持久根私钥。

### 4. 网络分发与 CDN 缓存边界 (Distribution & Cache Invariants)
- **FR-08 (网络请求规范化)**：客户端所有针对 GitHub API 和 CDN 的请求必须注入标准 `User-Agent` 与 `no-cache` 请求头，在 302 跨域重定向时自动剥离敏感 `Authorization` 请求头。
- **FR-09 (真实公网 E2E 门禁)**：CI 发布流水线必须挂载真实网络探测脚本，验证 GitHub Releases 资产的真实可达性、SHA-256 与 Ed25519 签名有效性。

### 5. 产品与 UX 交互边界 (Zero-State & Onboarding UX)
- **FR-10 (全屏 Hero Onboarding)**：未配置凭证时，完全隐藏 3 栏米勒列，展示专注的液态玻璃连接向导卡片，提供直达链接、权限清单与即时连通性测试。
- **FR-11 (情境感知三栏空状态)**：支持骨架屏微光加载，未选空间、未选文档、未同步文档均具备清晰卡片与主操作按钮，严禁向本地文件写入污染性合成占位文本。

---

## 二、 非功能需求与安全铁律 (Non-Functional Requirements)

1. **NFR-01 (零崩溃硬性门禁)**：任何构建产物在冷启动时必须 100% 零 dyld 寻址失败、零 SIGABRT 闪退；
2. **NFR-02 (密码学完整性)**：未通过 Ed25519 签名验证或 SHA-256 校验的插件包一律在 Staging 阶段硬阻断并回滚；
3. **NFR-03 (Swift 6 严格并发)**：全量代码必须通过 Swift 6 `StrictConcurrency` 检查，杜绝跨 Actor 数据竞争。
