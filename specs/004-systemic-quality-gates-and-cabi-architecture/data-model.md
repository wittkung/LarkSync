# Data Model: C-ABI 虚函数表、生命周期状态机与工作区数据模型

## 一、 C-ABI VTable 跨库契约模型 (`TTZipPluginVTable_v1`)

```c
struct TTZipPluginVTable_v1 {
    size_t struct_size;
    uint32_t version;
    
    // 生命周期
    int32_t (*initialize)(const void* self, void* host_context);
    void (*terminate)(const void* self);
    
    // 元数据
    const char* (*get_manifest_json)(const void* self);
    void (*release_string)(const char* str);
    
    // 视图桥接 (返回 Retained NSView*)
    void* (*make_workspace_view)(const void* self, const char* tab_id);
    void* (*make_inspector_view)(const void* self);
    
    // 内存释放
    void (*destroy_instance)(const void* self);
};
```

---

## 二、 插件生命周期状态机 (`PluginLifecycleState`)

```
Discovered ──► Verified ──► Staged ──► Installed ──► Activated ──► Deactivated ──► Uninstalled
```

| 状态 | 说明 | 触发动作 |
| :--- | :--- | :--- |
| `discovered` | 发现可用插件包/索引 | `fetch()` |
| `verified` | SHA-256 与 Ed25519 验签通过 | `unpack()` |
| `staged` | 解压至临时沙盒 | `replaceItem()` |
| `installed` | Bundle 写入 Application Support | `dlopen() / load()` |
| `activated` | `initialize()` 执行完毕，扩展点已挂载 | 用户使用 |
| `deactivated` | `terminate()` 执行完毕，扩展点已卸载 | 停用/卸载 |
| `uninstalled` | 文件与凭证彻底清除，Tab 缓存已驱逐 | 终态 |

---

## 三、 工作区路由与状态模型 (`WorkspacePhase`)

```swift
public enum WorkspacePhase: Equatable {
    case onboardingHero               // 未配置凭证，全屏连接向导
    case authenticating               // 正在连接飞书并校验 Token
    case authFailed(reason: String)   // 凭证错误或网络不可达
    case ready(spaceId: String?)      // 准备就绪，呈现三栏米勒列
}

public enum EditorContentState {
    case noDocumentSelected           // 未选文档，显示 WSJ Zen 欢迎页
    case loadingFromLocal             // 正在读取本地 Markdown
    case documentActive(token: String)// 正常处于编辑状态
    case unSyncedDocument(token: String, title: String) // 文档尚未拉取，显示下载卡片
}
```
