# Phase 1: React Webview Dashboard 架构设计与开发规划

## 1. 架构目标
彻底取代传统的 VS Code `settings.json` 静态配置，提供一个开箱即用的、极具现代感的图形化控制台体验（Premium Webview Dashboard）。利用 React 的组件化优势处理复杂的图形交互（如 OAuth 扫码、树形空间选择器、高频流数据图表），同时保持 LarkSync 插件的高性能和低延迟。

## 2. 工程目录结构
为了确保前端代码与 Node.js (VS Code Extension) 后端代码解耦，我们将在项目根目录创建并行的 `webview-ui` 目录：

```text
LarkSync/
├── src/                    # 现有的 VS Code Extension 运行时后端逻辑
│   ├── ui/                 
│   │   └── dashboardPanel.ts   # (新建) VS Code Webview Provider，用于加载和管理 HTML
│   ├── core/
│   ...
├── webview-ui/             # (新建) React 独立前端工程
│   ├── index.html
│   ├── vite.config.ts      # Vite 构建配置（输出内联 HTML 或特定资源目录）
│   ├── src/
│   │   ├── App.tsx         # 控制台面板根入口
│   │   ├── components/     # 控制台基础 UI（玻璃态面板、状态卡片、图表）
│   │   ├── hooks/          # 处理与 VS Code postMessage 的通讯总线
│   ...
├── docs/                   # 架构文档
├── package.json            # 外层构建脚本将联动 build webview-ui
```

## 3. 跨端通信设计 (Message Bridge)

Webview (前端) 与 VS Code Window (后端) 是完全隔离的两个进程。我们将通过 `postMessage` 建立强类型（TypeScript）的 IPC 通信协议。

### 通信标头定义 (Protocol)
所有的信息交互应遵循以下结构：
```typescript
interface WebviewMessage<T = any> {
    command: 'getSpaces' | 'updateToken' | 'syncStatus' | 'openAuthPage';
    payload?: T;
    requestId?: string; // 用于异步回调的链路追踪
}
```

### 业务流走向
1. **Frontend Request**: 用户在 Webview 中点击 "绑定空间"，触发 `vscode.postMessage({ command: 'getSpaces' })`。
2. **Backend Handler**: `dashboardPanel.ts` 监听到消息，调用底层的 `feishuClient.getSpaces()` 发起真实 HTTP 网络请求。
3. **Frontend Response**: 获取列表后，通过 `panel.webview.postMessage({ command: 'spacesCallback', payload: [...]})` 将数据推回前端，完成 React 视图更新。

## 4. 美学与体验基准 (Premium Aesthetics Constraints)
我们抛弃组件库的死板，基于 **TailwindCSS** 自定义设计系统：
1. **Glassmorphism (玻璃拟物化)**：大量运用 `backdrop-blur` 和带有低透明度的深色底色，融入 VS Code 的原生风格，但质感更剔透。
2. **微动画 (Micro-Interactions)**：同步按钮的呼吸渐变、错误提示框的抽屉式滑出、加载状态下的流畅骨架屏 (Skeleton)。排斥任何“生硬跳变”。
3. **颜色栈 (Color Tokens)**：以霓虹色调（如 Tailwind 的 `indigo-500` 到 `fuchsia-500` 的渐变）为主轴，传达数据流动的高级科技感。

## 5. 开发步骤与排期 (Milestones)

### 步骤一：创建 Vite 子工程与双向构建流 (Infrastructure)
1. 运行 `npx -y create-vite@latest webview-ui --template react-ts`。
2. 配置 `vite.config.ts`：禁止 chunk 分离并关闭 hash 以便 VS Code 环境静态读取；或是将打包结果指向 `dist/webview`。
3. 对齐统一主项目的 `npm run build` 工作流（同步构建 UI + Extension）。

### 步骤二：实现 dashboardPanel.ts (Host Provider)
1. 开发底层面板宿主：`const panel = vscode.window.createWebviewPanel(...)`。
2. 配置 `panel.webview.html` 读取 Vite 编译出来的产物，并注入随机的 `nonce` 遵守所有的安全策略(CSP)。
3. 重构现存 `package.json` 的菜单：新增左侧菜单/命令面板入口 `larksync.openDashboard`。 

### 步骤三：打通基础交互骨架 (React Bridge)
1. 在 Webview 创建 Mock `vscode` 对象，方便独立在外部浏览器 `yarn dev` 进行图形开发。
2. 搭建首屏的 Onboarding 卡片：检测是否含有 Token。如果没有，展示优雅的 “Connect Feishu” 引导操作流。

### 步骤四：开发业务组件 (Business Logic Modules)- **高优**
1. **Space Selector (节点选择)**：列出飞书个人工作区和团队的空间供挑选，选中后写入 VS Code `Configuration`。
2. **Status Audit (状态审计)**：接收并展示由 `SyncEngine` 不断吐出的 `syncProgress` 流（显示当前分析或拉取的文档）。
3. **Quota Widget (限流挂件)**：在底栏悬浮展示目前 API Tokens 距刷新还有多少时长。

## 6. 后续延展防范点
- React 侧在用户切换 tab 被 VS Code 销毁时会丢失状态，须善用 `vscode.getState()` 与 `setState()` 将 UI 持久化。
- 安全策略严禁任意请求跨域，对于图片的显示需经过 `asWebviewUri` 转化方可呈现外部封面图像。
