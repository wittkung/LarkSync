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
     * 获取文档相对于同步根目录的相对路径（使用正斜杠），用于状态存储映射
     */
    public getDocRelativePath(doc: WikiNode): string {
        const parts = this.buildPathParts(doc);
        parts[parts.length - 1] = this.sanitizeFileName(doc.title) + '.md';
        return parts.join('/');
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

    /**
     * 删除文件
     */
    public async deleteFile(uri: vscode.Uri): Promise<void> {
        try {
            await vscode.workspace.fs.delete(uri, { recursive: false });
        } catch {
            // 文件可能已不存在
        }
    }

    /**
     * 递归列出本地同步目录下所有 .md 文件的 URI
     */
    public async listLocalMarkdownFiles(): Promise<vscode.Uri[]> {
        const results: vscode.Uri[] = [];
        await this.walkDirectory(this.rootUri, results);
        return results;
    }

    /**
     * 递归遍历目录收集 .md 文件
     */
    private async walkDirectory(dirUri: vscode.Uri, results: vscode.Uri[]): Promise<void> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(dirUri);
            for (const [name, type] of entries) {
                const childUri = vscode.Uri.joinPath(dirUri, name);
                if (type === vscode.FileType.Directory) {
                    // 跳过 assets 和隐藏目录
                    if (name === 'assets' || name.startsWith('.')) continue;
                    await this.walkDirectory(childUri, results);
                } else if (type === vscode.FileType.File && name.endsWith('.md')) {
                    results.push(childUri);
                }
            }
        } catch {
            // 目录不存在或无权限
        }
    }

    /**
     * 获取所有文档的预期本地 URI 集合
     */
    public getExpectedDocUris(docs: WikiNode[]): Set<string> {
        const uriSet = new Set<string>();
        for (const doc of docs) {
            if (doc.obj_type === 'doc' || doc.obj_type === 'docx') {
                uriSet.add(this.getDocLocalUri(doc).toString());
            }
        }
        return uriSet;
    }

    /**
     * 递归清理同步目录下的空文件夹
     * @returns 删除的空目录数量
     */
    public async cleanEmptyDirectories(): Promise<number> {
        return this.removeEmptyDirs(this.rootUri);
    }

    /**
     * 递归删除空目录（自底向上）
     */
    private async removeEmptyDirs(dirUri: vscode.Uri): Promise<number> {
        let count = 0;
        try {
            const entries = await vscode.workspace.fs.readDirectory(dirUri);

            // 先递归处理子目录
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory) {
                    if (name === 'assets' || name.startsWith('.')) continue;
                    const childUri = vscode.Uri.joinPath(dirUri, name);
                    count += await this.removeEmptyDirs(childUri);
                }
            }

            // 再次检查当前目录是否已为空（子目录可能刚被删除）
            // 不删除根同步目录本身
            if (dirUri.toString() !== this.rootUri.toString()) {
                const remaining = await vscode.workspace.fs.readDirectory(dirUri);
                if (remaining.length === 0) {
                    logger.info(`删除空目录: ${dirUri.fsPath}`);
                    await vscode.workspace.fs.delete(dirUri, { recursive: false });
                    count++;
                }
            }
        } catch {
            // 目录不存在或无权限
        }
        return count;
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
