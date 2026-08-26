# Tasks: TTZip 云端插件商店分发协议与安全原子安装引擎

## Phase 1: 开发者工具链与 CI/CD 自动化流水线
- [x] 1.1 编写本地发版、打包、Ed25519 签名与自检脚本 `scripts/dev-release.sh` <!-- id: 1.1 -->
- [x] 1.2 编写 GitHub Actions 多架构交叉编译与发版工作流 `.github/workflows/release-plugin.yml` <!-- id: 1.2 -->
- [x] 1.3 编写中央插件市场索引文件 `marketplace.json` <!-- id: 1.3 -->

## Phase 2: TTZipPluginKit 安全下载与原子安装引擎
- [ ] 2.1 编写 `apple/Sources/TTZipPluginKit/TTZipMarketplaceModel.swift`（数据结构、内置官方源与 Fallback 索引） <!-- id: 2.1 -->
- [ ] 2.2 编写 `apple/Sources/TTZipPluginKit/TTZipPluginSecurity.swift`（流式 SHA-256、CryptoKit Ed25519 签名验证、Zip Slip 校验） <!-- id: 2.2 -->
- [ ] 2.3 编写 `apple/Sources/TTZipPluginKit/TTZipPluginInstaller.swift`（流式下载、断点续传、2PC Staging、APFS replaceItem 原子交换与热插拔调度） <!-- id: 2.3 -->

## Phase 3: TTZipApp 宿主界面与响应式状态机集成
- [ ] 3.1 改造 `products/ttzip/apple/Sources/TTZipApp/Views/Plugins/PluginsView.swift`（接入真实 Marketplace 索引、流式下载进度环、实时下载速度、签名校验状态与一键安装/卸载） <!-- id: 3.1 -->
- [ ] 3.2 验证左侧边栏 `MacEditorialSidebar.swift` 在安装/卸载时的动态响应式挂载 <!-- id: 3.2 -->

## Phase 4: 全量构建与端到端闭环验证
- [ ] 4.1 运行 `scripts/dev-release.sh pack 1.0.0` 生成真实签名包与 SHA-256 <!-- id: 4.1 -->
- [ ] 4.2 运行 `scripts/dev-release.sh verify 1.0.0` 验证密码学一致性 <!-- id: 4.2 -->
- [ ] 4.3 运行 TTZip 宿主 `bundle_app.sh --release` 验证全量编译与打包成功 <!-- id: 4.3 -->
