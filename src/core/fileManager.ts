/**
 * fileManager.ts
 * 文件管理器 — 使用 vscode.workspace.fs 实现 Remote Dev 兼容
 */

import * as vscode from 'vscode';
import { WikiNode } from '../types';
import { logger } from '../logger';

export class FileManager {
    private rootUri: vscode.Uri;
    private nodeMap: Map<string, WikiNode> = new Map();

    constructor(rootUri: vscode.Uri, nodes: WikiNode[] = []) {
        this.rootUri = rootUri;
        this.initNodeMap(nodes);
    }

    /**
     * 确保根同步目录存在
     */
    public async ensureRootDirectory(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.rootUri);
            logger.info(`同步根目录已就绪: ${this.rootUri.fsPath}`);
        } catch {
            // 目录已存在
        }
    }

    public setNodes(nodes: WikiNode[]) {
        this.initNodeMap(nodes);
    }

    private initNodeMap(nodes: WikiNode[]) {
        this.nodeMap.clear();
        nodes.forEach(n => this.nodeMap.set(n.node_token, n));
    }

    /**
     * 为知识库节点创建本地目录
     */
    public async buildLocalDirectories(nodes: WikiNode[]): Promise<void> {
        for (const node of nodes) {
            const dirUri = this.getDirectoryUriForNode(node);
            try {
                await vscode.workspace.fs.createDirectory(dirUri);
            } catch {
                // 目录已存在
            }
        }
    }

    /**
     * 获取文档在本地文件系统中的 Uri
     */
    public getDocLocalUri(doc: WikiNode): vscode.Uri {
        const parts = this.buildPathParts(doc);
        parts[parts.length - 1] = this.sanitizeFileName(doc.title) + '.md';
        return vscode.Uri.joinPath(this.rootUri, ...parts);
    }

    /**
     * 获取文档在本地文件系统中的路径字符串（用于日志等场景）
     */
    public getDocLocalPath(doc: WikiNode): string {
        return this.getDocLocalUri(doc).fsPath;
    }

    /**
     * 检查文件是否存在
     */
    public async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 读取文件内容
     */
    public async readFile(uri: vscode.Uri): Promise<string> {
        const data = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(data).toString('utf-8');
    }

    /**
     * 写入文件内容
     */
    public async writeFile(uri: vscode.Uri, content: string): Promise<void> {
        const data = Buffer.from(content, 'utf-8');
        await vscode.workspace.fs.writeFile(uri, data);
    }

    // --- 路径计算辅助方法 ---

    private buildPathParts(node: WikiNode): string[] {
        const parts: string[] = [this.sanitizeFileName(node.title)];
        let current = node;

        while (current.parent_node_token && this.nodeMap.has(current.parent_node_token)) {
            current = this.nodeMap.get(current.parent_node_token)!;
            parts.unshift(this.sanitizeFileName(current.title));
        }

        return parts;
    }

    private getDirectoryUriForNode(node: WikiNode): vscode.Uri {
        const parts = this.buildPathParts(node);
        // 去掉最后一个部分（节点本身），只保留父目录路径
        const dirParts = parts.slice(0, -1);
        if (dirParts.length === 0) {
            return this.rootUri;
        }
        return vscode.Uri.joinPath(this.rootUri, ...dirParts);
    }

    private sanitizeFileName(name: string): string {
        return name.replace(/[\\/:*?"<>|]/g, '_');
    }
}
