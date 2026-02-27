import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SyncEngine } from './syncEngine';

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

    getChildren(element?: SyncNode): Thenable<SyncNode[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return Promise.resolve([]);
        }

        const config = vscode.workspace.getConfiguration('larksync');
        const syncDirName = config.get<string>('syncDirectory') || 'LarkDocs';
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
                } else {
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
                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;
                return a.label.localeCompare(b.label);
            }));
        } catch (e) {
            return Promise.resolve([]);
        }
    }
}

class SyncNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly fsPath: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.fsPath}`;

        if (collapsibleState === vscode.TreeItemCollapsibleState.None && fsPath.endsWith('.md')) {
            this.iconPath = vscode.ThemeIcon.File;
        } else if (collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.iconPath = vscode.ThemeIcon.Folder;
        }
    }
}
