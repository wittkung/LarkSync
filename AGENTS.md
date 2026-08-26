# LarkSync — 项目级 AI 执行规则 (Project-Level Agent Rules)

## 一、 项目概况与架构定位

LarkSync 是专为 VS Code 设计的飞书知识库双向同步与 Markdown 沉浸式管理扩展。

| 维度 | 规格 |
| :--- | :--- |
| 宿主环境 | VS Code Extension API (`^1.80.0`) |
| 核心语言 | TypeScript 5.x + Node.js 18.x |
| UI 架构 | React + Vite (Webview UI) + VS Code Sidebar View |
| 打包工具 | esbuild (`esbuild.mjs`) + vsce (`@vscode/vsce`) |
| 核心依赖 | `axios`, `p-limit` |

### 核心架构

```
LarkSync/
├── src/
│   ├── extension.ts        # 扩展生命周期入口与命令注册
│   ├── client/             # 飞书开放平台 OpenAPI 客户端 (Auth, Knowledge, DocX)
│   ├── sync/               # 知识库双向增量同步引擎与树形拓扑解析
│   ├── converter/          # 飞书 DocX 块结构 ➔ Markdown/HTML 转换管道
│   ├── views/              # Sidebar TreeDataProvider 与 Webview 视图提供者
│   └── utils/              # 缓存、文件 I/O、并发限制器 (p-limit)
├── webview-ui/             # 仪表盘前端 (React + Vite + Tailwind/CSS)
└── scripts/                # 编译打包与本地安装脚本
```

---

## 二、 核心开发铁律 (Critical Invariants)

1. **飞书 API 鉴权与并发安全**：
   - 所有飞书 OpenAPI 请求必须统一通过 Token 管理器刷新与重试，严禁在业务层硬编码 Token。
   - 所有批量拉取与节点遍历必须受 `p-limit` 节流控制，严禁瞬间触发飞书 QPS 限流 (HTTP 429)。
2. **Markdown 转换保真度与防覆盖**：
   - 飞书 DocX 块转换为 Markdown 必须保持结构与元数据无损，支持表格的双模渲染（HTML 高保真 / GFM 纯 Markdown）。
   - 本地写入必须支持增量比对与安全防冲突机制，严禁在未确认云端版本时粗暴覆盖本地已编辑内容。
3. **VS Code Webview 通信规范**：
   - Webview 与 Extension 主进程通信必须严格使用强类型 `postMessage` 协议，消息格式统一遵循 `{ command: string, payload: any }`。
   - Webview 内部不得直接引用 Node.js 原生模块，必须保持安全沙盒隔离。


