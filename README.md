# LarkSync — 飞书知识库同步 VS Code 插件

> 将飞书 (Feishu/Lark) 知识库无缝单向同步到本地 Markdown 文件。

## ✨ 功能亮点

- **完整 AST 转换** — 支持 30+ 种飞书文档 Block 类型（标题、列表、代码块、表格、高亮块、公式等）
- **媒体资源下载** — 自动下载图片与附件，按文档分目录存储
- **增量同步** — 基于文档修改时间戳智能跳过未变更文档
- **Frontmatter 保护** — 同步时保留用户在边界标记外手动添加的内容
- **OAuth 2.0 + PKCE** — 支持飞书个人授权登录，凭证加密存储
- **表格双模式** — HTML 高保真 / GFM 纯 Markdown 可切换
- **差异标记** — 侧边栏知识树显示 A(新增)/M(修改)/D(删除) 状态
- **Remote Dev 兼容** — 完整支持 SSH、WSL、Codespaces 远程开发
- **后台轮询** — 可配置定时自动同步

## 🚀 快速开始

1. 安装 VSIX 或从应用市场搜索 `LarkSync`
2. 打开 VS Code 设置，配置以下项：
   - `larksync.appId` — 飞书应用 App ID
   - `larksync.appSecret` — 飞书应用 App Secret
   - `larksync.spaceId` — 目标知识库 Space ID
3. 按 `Ctrl+Shift+P` 执行 **LarkSync: Incremental Sync**

## ⚙️ 配置选项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `larksync.appId` | `""` | 飞书应用 App ID |
| `larksync.appSecret` | `""` | 飞书应用 App Secret |
| `larksync.spaceId` | `""` | 目标知识库 Space ID |
| `larksync.syncDirectory` | `"LarkDocs"` | 本地同步目录名称 |
| `larksync.pollingIntervalMinutes` | `5` | 自动轮询间隔（分钟，0 禁用） |
| `larksync.tableRenderMode` | `"html"` | 表格渲染：`html` 高保真 / `gfm` 纯 Markdown |

## 📋 命令

| 命令 | 说明 |
|------|------|
| `LarkSync: Incremental Sync (Fast)` | 增量同步（优先使用缓存目录树） |
| `LarkSync: Force Fetch Directory Tree` | 强制从云端拉取完整目录树 |
| `LarkSync: Login with Feishu Account` | OAuth 2.0 个人登录 |
| `LarkSync: Logout` | 清除本地凭证 |

## 📦 从源码构建

```powershell
npm install
npm run build     # 编译 + 打包 VSIX
```

## 📄 License

MIT