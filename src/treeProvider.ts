/**
 * treeProvider.ts
 * 侧边栏文件树 — 使用 vscode.workspace.fs 实现 Remote Dev 兼容
 */

import * as vscode from 'vscode';
import { SyncEngine } from './syncEngine';
import { CONSTANTS } from './utils/constants';

export class SyncTreeProvider implements vscode.TreeDataProvider<SyncNode> {

    private _onDidChangeTreeData: vscode.EventEmitter<SyncNode | undefined | void> = new vscode.EventEmitter<SyncNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SyncNode | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private syncEngine: SyncEngine) { }

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
                return [new SyncNode(
                    '尚未同步 (点击开始同步)',
                    rootUri,
                    vscode.TreeItemCollapsibleState.None
                )];
            }
        }

        const targetUri = element ? element.resourceUri! : rootUri;

        try {
            const entries = await vscode.workspace.fs.readDirectory(targetUri);
            const nodes: SyncNode[] = [];

            for (const [name, fileType] of entries) {
                // 跳过隐藏文件（以 . 开头）
                if (name.startsWith('.')) continue;

                const childUri = vscode.Uri.joinPath(targetUri, name);
                const isDir = fileType === vscode.FileType.Directory;

                if (isDir) {
                    nodes.push(new SyncNode(
                        name,
                        childUri,
                        vscode.TreeItemCollapsibleState.Collapsed
                    ));
                } else {
                    nodes.push(new SyncNode(
                        name,
                        childUri,
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'vscode.open',
                            title: '打开文件',
                            arguments: [childUri]
                        }
                    ));
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
        command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.resourceUri = uri;
        this.tooltip = uri.fsPath;
        this.command = command;

        // 使用 ThemeIcon 保持与 VS Code 视觉一致
        if (collapsibleState === vscode.TreeItemCollapsibleState.None && uri.fsPath.endsWith('.md')) {
            this.iconPath = vscode.ThemeIcon.File;
        } else if (collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.iconPath = vscode.ThemeIcon.Folder;
        }
    }
}
