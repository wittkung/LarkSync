"use strict";
/**
 * treeProvider.ts
 * 侧边栏文件树 — 使用 vscode.workspace.fs 实现 Remote Dev 兼容
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
const constants_1 = require("./utils/constants");
class SyncTreeProvider {
    constructor(syncEngine) {
        this.syncEngine = syncEngine;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }
        const config = vscode.workspace.getConfiguration('larksync');
        const syncDirName = config.get('syncDirectory') || constants_1.CONSTANTS.DEFAULT_SYNC_DIR;
        const rootUri = vscode.Uri.joinPath(workspaceFolders[0].uri, syncDirName);
        // 检查同步目录是否存在
        if (!element) {
            try {
                await vscode.workspace.fs.stat(rootUri);
            }
            catch {
                return [new SyncNode('尚未同步 (点击开始同步)', rootUri, vscode.TreeItemCollapsibleState.None)];
            }
        }
        const targetUri = element ? element.resourceUri : rootUri;
        try {
            const entries = await vscode.workspace.fs.readDirectory(targetUri);
            const nodes = [];
            for (const [name, fileType] of entries) {
                // 跳过隐藏文件（以 . 开头）
                if (name.startsWith('.'))
                    continue;
                const childUri = vscode.Uri.joinPath(targetUri, name);
                const isDir = fileType === vscode.FileType.Directory;
                if (isDir) {
                    nodes.push(new SyncNode(name, childUri, vscode.TreeItemCollapsibleState.Collapsed));
                }
                else {
                    nodes.push(new SyncNode(name, childUri, vscode.TreeItemCollapsibleState.None, {
                        command: 'vscode.open',
                        title: '打开文件',
                        arguments: [childUri]
                    }));
                }
            }
            // 排序：目录在前，然后按名称字母序
            return nodes.sort((a, b) => {
                const aIsDir = a.collapsibleState !== vscode.TreeItemCollapsibleState.None;
                const bIsDir = b.collapsibleState !== vscode.TreeItemCollapsibleState.None;
                if (aIsDir && !bIsDir)
                    return -1;
                if (!aIsDir && bIsDir)
                    return 1;
                return a.label.toString().localeCompare(b.label.toString());
            });
        }
        catch {
            return [];
        }
    }
}
exports.SyncTreeProvider = SyncTreeProvider;
class SyncNode extends vscode.TreeItem {
    constructor(label, uri, collapsibleState, command) {
        super(label, collapsibleState);
        this.resourceUri = uri;
        this.tooltip = uri.fsPath;
        this.command = command;
        // 使用 ThemeIcon 保持与 VS Code 视觉一致
        if (collapsibleState === vscode.TreeItemCollapsibleState.None && uri.fsPath.endsWith('.md')) {
            this.iconPath = vscode.ThemeIcon.File;
        }
        else if (collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.iconPath = vscode.ThemeIcon.Folder;
        }
    }
}
//# sourceMappingURL=treeProvider.js.map