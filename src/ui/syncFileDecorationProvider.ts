/**
 * syncFileDecorationProvider.ts
 * 文件装饰器 — 为统一知识树中的节点渲染 A/M/D 差异状态徽标
 *
 * 设计灵感类似 VS Code Git SCM 侧边栏的版本状态标记。
 */

import * as vscode from 'vscode';
import { SyncNodeStatus } from '../types';

/** 为 TreeView 中的节点提供视觉装饰（颜色 + 徽标字母） */
export class SyncFileDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    /** 存储每个节点 URI 对应的同步状态 */
    private statusMap = new Map<string, SyncNodeStatus>();

    /**
     * 更新节点的同步状态
     */
    public setStatus(uri: vscode.Uri, status: SyncNodeStatus): void {
        this.statusMap.set(uri.toString(), status);
        this._onDidChangeFileDecorations.fire(uri);
    }

    /**
     * 批量更新多个节点的状态
     */
    public setStatuses(entries: Array<{ uri: vscode.Uri; status: SyncNodeStatus }>): void {
        const uris: vscode.Uri[] = [];
        for (const { uri, status } of entries) {
            this.statusMap.set(uri.toString(), status);
            uris.push(uri);
        }
        this._onDidChangeFileDecorations.fire(uris);
    }

    /**
     * 清空所有状态
     */
    public clear(): void {
        this.statusMap.clear();
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        const status = this.statusMap.get(uri.toString());
        if (!status || status === SyncNodeStatus.SYNCED) {
            return undefined;
        }

        switch (status) {
            case SyncNodeStatus.LOCAL_MODIFIED:
                return {
                    badge: 'M',
                    color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
                    tooltip: '本地已被修改'
                };
            case SyncNodeStatus.CLOUD_UPDATED:
                return {
                    badge: 'U',
                    color: new vscode.ThemeColor('gitDecoration.untrackedResourceForeground'), // Often blue/green
                    tooltip: '云端有新版本'
                };
            case SyncNodeStatus.CONFLICT:
                return {
                    badge: 'C',
                    color: new vscode.ThemeColor('gitDecoration.conflictingResourceForeground'),
                    tooltip: '双端均被修改，存在冲突！'
                };
            case SyncNodeStatus.UNTRACKED:
                return {
                    badge: 'U',
                    color: new vscode.ThemeColor('gitDecoration.untrackedResourceForeground'),
                    tooltip: '本地脱机文件'
                };
            case SyncNodeStatus.ADDED:
                return {
                    badge: 'A',
                    color: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
                    tooltip: '远端新增文件'
                };
            case SyncNodeStatus.DELETED:
                return {
                    badge: 'D',
                    color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
                    tooltip: '远端已删除'
                };
            default:
                return undefined;
        }
    }
}
