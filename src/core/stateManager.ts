/**
 * stateManager.ts
 * 同步状态管理器 — 使用 vscode.workspace.fs 实现 Remote Dev 兼容
 */

import * as vscode from 'vscode';
import { SyncState, SyncStateEntry } from '../types';
import { CONSTANTS } from '../utils/constants';

export class StateManager {
    private stateUri: vscode.Uri;
    private state: SyncState = {};

    constructor(rootUri: vscode.Uri) {
        this.stateUri = vscode.Uri.joinPath(rootUri, CONSTANTS.STATE_FILE_NAME);
    }

    /**
     * 从工作区文件系统加载同步状态
     */
    public async loadState(): Promise<void> {
        try {
            const data = await vscode.workspace.fs.readFile(this.stateUri);
            const text = Buffer.from(data).toString('utf-8');
            this.state = JSON.parse(text);
        } catch {
            // 状态文件不存在或损坏，使用空状态
            this.state = {};
        }
    }

    /**
     * 将当前状态持久化写入工作区文件系统
     */
    public async saveState(): Promise<void> {
        const content = JSON.stringify(this.state, null, 2);
        const data = Buffer.from(content, 'utf-8');
        await vscode.workspace.fs.writeFile(this.stateUri, data);
    }

    public getDocState(documentId: string): SyncStateEntry | undefined {
        return this.state[documentId];
    }

    public updateDocState(documentId: string, timestamp: number, cloudEditTime?: string, localRelativePath?: string) {
        this.state[documentId] = {
            lastSyncTime: timestamp,
            cloudEditTime: cloudEditTime,
            localRelativePath: localRelativePath,
        };
    }

    /**
     * 获取反向映射：相对路径 -> { documentId, SyncStateEntry }
     * 供侧边栏 UI 快速查询使用
     */
    public getReverseMapping(): Map<string, SyncStateEntry & { documentId: string }> {
        const mapping = new Map<string, SyncStateEntry & { documentId: string }>();
        for (const [docId, entry] of Object.entries(this.state)) {
            if (entry.localRelativePath) {
                // 统一移除开头的斜杠，确保映射匹配
                const normalizedPath = entry.localRelativePath.replace(/^[/\\]/, '');
                mapping.set(normalizedPath, { ...entry, documentId: docId });
            }
        }
        return mapping;
    }

    public isDocUnchanged(documentId: string, cloudEditTime?: string): boolean {
        const docState = this.getDocState(documentId);
        if (!docState) return false;

        if (cloudEditTime && docState.cloudEditTime === cloudEditTime) {
            return true;
        }

        if (!cloudEditTime && (Date.now() - docState.lastSyncTime < CONSTANTS.FALLBACK_CACHE_TTL_MS)) {
            return true;
        }

        return false;
    }
}
