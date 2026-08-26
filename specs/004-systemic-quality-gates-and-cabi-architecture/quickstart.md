# Quickstart: 四大质量门禁与端到端闭环验证指南

## 1. 门禁 1：Mach-O 动态链接洁净度与 dyld 启动安全门禁
```bash
# 验证打包产物中是否存在违规业务动态库链接，以及 @rpath 物理可达性
./scripts/verify_bundle_linkage.sh /Users/kevintung/Documents/dev/products/ttzip/apple/dist/TTZip.app
```

## 2. 门禁 2：单一事实来源 (SSOT) 一键原子发布与签名同步
```bash
# 编译 ➔ 压缩 ➔ 真实 SHA-256 / Ed25519 签名 ➔ 自动回填 marketplace.json 与 Swift Fallback
./scripts/dev-release.sh pack 1.0.0

# 验证三方哈希与签名 100% 一致
./scripts/dev-release.sh verify 1.0.0
```

## 3. 门禁 3：真实公网 CDN 下载与密码学连通性 E2E 门禁
```bash
# 真实发起公网 HTTP 请求，校验 200 OK、SHA-256 与 Ed25519 验签
./scripts/verify-distribution-e2e.sh
```

## 4. 门禁 4：实机黑盒冒烟测试与 UI 全状态验收
```bash
# 构建并拉起宿主应用
/Users/kevintung/Documents/dev/products/ttzip/apple/scripts/bundle_app.sh --release --open

# 验收清单:
# 1. 冷启动 PID 正常存活，零 dyld 闪退;
# 2. 未配置凭证时呈现全屏 Onboarding 向导卡片;
# 3. 配置凭证后呈现三栏米勒列，未选文档呈现 Zen 欢迎页;
# 4. 插件中心点击卸载，侧边栏与工作区即刻物理驱逐并回到主页。
```
