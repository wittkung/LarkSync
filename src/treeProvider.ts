/**
 * treeProvider.ts
 * 侧边栏文件树 — 使用 vscode.workspace.fs 实现 Remote Dev 兼容
 */

import * as vscode from 'vscode';
import { SyncEngine } from './syncEngine';
import { StateManager } from './core/stateManager';
import { CONSTANTS } from './utils/constants';

export class SyncTreeProvider implements vscode.TreeDataProvider<SyncNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<SyncNode | undefined | void> =
        new vscode.EventEmitter<SyncNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SyncNode | undefined | void> =
        this._onDidChangeTreeData.event;

    constructor(private syncEngine: SyncEngine) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SyncNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SyncNode): Promise<SyncNode[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const config = vscode.workspace.getConfiguration('larksync');
        const syncDirName = config.get<string>('syncDirectory') || CONSTANTS.DEFAULT_SYNC_DIR;
        const rootUri = vscode.Uri.joinPath(workspaceFolders[0].uri, syncDirName);

        // 检查同步目录是否存在
        if (!element) {
            try {
                await vscode.workspace.fs.stat(rootUri);
            } catch {
                return [
                    new SyncNode(
                        '尚未同步 (点击开始同步)',
                        rootUri,
                        vscode.TreeItemCollapsibleState.None
                    )
                ];
            }
        }

        const targetUri = element ? element.resourceUri! : rootUri;

        // 加载状态树以获取上次同步时间
        const stateManager = new StateManager(rootUri);
        await stateManager.loadState();
        const stateMapping = stateManager.getReverseMapping();

        try {
            const entries = await vscode.workspace.fs.readDirectory(targetUri);
            const nodes: SyncNode[] = [];

            for (const [name, fileType] of entries) {
                // 跳过隐藏文件（以 . 开头）
                if (name.startsWith('.')) continue;

                const childUri = vscode.Uri.joinPath(targetUri, name);
                const isDir = fileType === vscode.FileType.Directory;

                if (isDir) {
                    nodes.push(
                        new SyncNode(name, childUri, vscode.TreeItemCollapsibleState.Collapsed)
                    );
                } else {
                    // 获取相对路径 (去除前部可能因为操作系统差异导致的 \ 或 / 问题)
                    let relativePath = childUri.path.substring(rootUri.path.length);
                    // 统一为 posix 格式，去除首部斜杠
                    relativePath = relativePath.replace(/^[/\\]/, '');

                    const state = stateMapping.get(relativePath);
                    let description = '';
                    let tooltip = childUri.fsPath;

                    if (state) {
                        const date = new Date(state.lastSyncTime);
                        description = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        tooltip = `Local: ${childUri.fsPath}\nCloud ID: ${state.documentId}`;
                    } else if (childUri.fsPath.endsWith('.md')) {
                        description = '待同步';
                    }

                    nodes.push(
                        new SyncNode(
                            name,
                            childUri,
                            vscode.TreeItemCollapsibleState.None,
                            {
                                command: 'vscode.open',
                                title: '打开文件',
                                arguments: [childUri]
                            },
                            description,
                            tooltip
                        )
                    );
                }
            }

            // 排序：目录在前，然后按名称字母序
            return nodes.sort((a, b) => {
                const aIsDir = a.collapsibleState !== vscode.TreeItemCollapsibleState.None;
                const bIsDir = b.collapsibleState !== vscode.TreeItemCollapsibleState.None;
                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;
                return a.label!.toString().localeCompare(b.label!.toString());
            });
        } catch {
            return [];
        }
    }
}

class SyncNode extends vscode.TreeItem {
    constructor(
        label: string,
        uri: vscode.Uri,
        collapsibleState: vscode.TreeItemCollapsibleState,
        command?: vscode.Command,
        description?: string,
        customTooltip?: string
    ) {
        super(label, collapsibleState);
        this.resourceUri = uri;
        this.tooltip = customTooltip || uri.fsPath;
        this.description = description;
        this.command = command;

        // 使用 ThemeIcon 保持与 VS Code 视觉一致
        if (
            collapsibleState === vscode.TreeItemCollapsibleState.None &&
            uri.fsPath.endsWith('.md')
        ) {
            this.iconPath = vscode.ThemeIcon.File;
        } else if (collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.iconPath = vscode.ThemeIcon.Folder;
        }
    }
}
