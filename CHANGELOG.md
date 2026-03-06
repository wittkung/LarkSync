# Changelog

## [1.0.0] - 2026-03-07

### Added
- **AST 转换引擎**：DFS 树遍历 + Handler Map 策略，支持 30+ 种飞书 Block 类型
- **媒体资源下载引擎**：p-limit 并发控制 + Token 去重缓存
- **文件系统抽象层**：全面迁移至 `vscode.workspace.fs`，支持 Remote Development
- **增量同步状态机**：SyncManifest 结构 + 文档修改时间戳比对
- **Frontmatter 保护**：`<!-- LARKSYNC:START/END -->` 边界标记保护用户内容
- **云端知识树视图**：FileDecorationProvider A/M/D 差异徽标
- **OAuth 2.0 + PKCE**：完整授权码流程 + SecretStorage 加密存储 + 自动刷新
- **表格双模式渲染**：HTML 高保真 / GFM 纯 Markdown 动态切换
- **全局 API 限流器**：令牌桶（5 QPS）+ 指数退避 + Jitter + retry-after 支持
- **后台轮询同步**：可配置定时自动同步
- **Worker 线程转换**：CPU 密集型 AST 转换卸载到 Worker 线程
