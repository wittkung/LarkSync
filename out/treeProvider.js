"use strict";
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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
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
    getChildren(element) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return Promise.resolve([]);
        }
        const config = vscode.workspace.getConfiguration('larksync');
        const syncDirName = config.get('syncDirectory') || 'LarkDocs';
        const rootPath = path.join(workspaceFolders[0].uri.fsPath, syncDirName);
        if (!fs.existsSync(rootPath)) {
            return Promise.resolve([new SyncNode('Not Synced Yet (Click Start Sync)', '', vscode.TreeItemCollapsibleState.None)]);
        }
        const targetPath = element ? element.fsPath : rootPath;
        try {
            const files = fs.readdirSync(targetPath);
            const nodes = files.filter(f => !f.startsWith('.')).map(file => {
                const fsPath = path.join(targetPath, file);
                const isDir = fs.statSync(fsPath).isDirectory();
                if (isDir) {
                    return new SyncNode(file, fsPath, vscode.TreeItemCollapsibleState.Collapsed);
                }
                else {
                    return new SyncNode(file, fsPath, vscode.TreeItemCollapsibleState.None, {
                        command: 'vscode.open',
                        title: 'Open File',
                        arguments: [vscode.Uri.file(fsPath)]
                    });
                }
            });
            // Sort: Directories first, then alphabetically
            return Promise.resolve(nodes.sort((a, b) => {
                const aIsDir = a.collapsibleState !== vscode.TreeItemCollapsibleState.None;
                const bIsDir = b.collapsibleState !== vscode.TreeItemCollapsibleState.None;
                if (aIsDir && !bIsDir)
                    return -1;
                if (!aIsDir && bIsDir)
                    return 1;
                return a.label.localeCompare(b.label);
            }));
        }
        catch (e) {
            return Promise.resolve([]);
        }
    }
}
exports.SyncTreeProvider = SyncTreeProvider;
class SyncNode extends vscode.TreeItem {
    constructor(label, fsPath, collapsibleState, command) {
        super(label, collapsibleState);
        this.label = label;
        this.fsPath = fsPath;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.tooltip = `${this.fsPath}`;
        if (collapsibleState === vscode.TreeItemCollapsibleState.None && fsPath.endsWith('.md')) {
            this.iconPath = vscode.ThemeIcon.File;
        }
        else if (collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.iconPath = vscode.ThemeIcon.Folder;
        }
    }
}
//# sourceMappingURL=treeProvider.js.map