/**
 * mediaManager.ts
 * 媒体资源（图片/附件）下载管理器
 *
 * 核心职责：
 * 1. 管理待下载的媒体 Token 队列
 * 2. 本地缓存比对（按 file_token 去重）
 * 3. 使用 p-limit 控制并发下载
 * 4. 计算 Markdown 中的相对路径引用
 */

import * as vscode from 'vscode';
import pLimit from 'p-limit';
import { feishuClient } from '../api/feishuClient';
import { MediaTokenEntry } from '../types';
import { CONSTANTS } from '../utils/constants';
import { logger } from '../logger';

export class MediaManager {
    private rootUri: vscode.Uri;
    private assetsUri: vscode.Uri;
    /** 已下载到本地的 Token 集合（用于跨文档去重） */
    private downloadedTokens: Set<string> = new Set();

    constructor(rootUri: vscode.Uri) {
        this.rootUri = rootUri;
        this.assetsUri = vscode.Uri.joinPath(rootUri, CONSTANTS.ASSETS_DIR_NAME);
    }

    /**
     * 扫描 assets 目录，初始化已下载 Token 缓存
     */
    public async initialize(): Promise<void> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(this.assetsUri);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory) {
                    // 扫描每个文档的 assets 子目录
                    const subDir = vscode.Uri.joinPath(this.assetsUri, name);
                    const subEntries = await vscode.workspace.fs.readDirectory(subDir);
                    for (const [fileName] of subEntries) {
                        // 文件名格式：<token>.<ext>
                        const tokenPart = fileName.replace(/\.[^.]+$/, '');
                        this.downloadedTokens.add(tokenPart);
                    }
                }
            }
            logger.info(`媒体缓存初始化完成，已有 ${this.downloadedTokens.size} 个资源文件。`);
        } catch {
            // assets 目录不存在是正常的初始状态
            logger.info('assets 目录尚不存在，将在首次下载时创建。');
        }
    }

    /**
     * 处理一批媒体 Token：检查缓存并下载缺失的资源
     *
     * @param tokens 本次文档转换中收集到的媒体 Token 列表
     * @param docTitle 文档标题（用于创建资产子目录）
     */
    public async processTokens(tokens: MediaTokenEntry[], docTitle: string): Promise<void> {
        if (tokens.length === 0) return;

        const sanitizedTitle = this.sanitizeFileName(docTitle);
        const docAssetsUri = vscode.Uri.joinPath(this.assetsUri, sanitizedTitle);

        // 筛选出需要下载的 Token（排除已缓存的）
        const toDownload = tokens.filter(t => !this.downloadedTokens.has(t.token));

        if (toDownload.length === 0) {
            logger.info(`[${docTitle}] 所有 ${tokens.length} 个媒体资源已缓存，跳过下载。`);
            return;
        }

        logger.info(`[${docTitle}] 需下载 ${toDownload.length}/${tokens.length} 个媒体资源。`);

        // 确保资产目录存在
        await this.ensureDirectory(docAssetsUri);

        // 使用 p-limit 控制并发下载
        const limit = pLimit(CONSTANTS.MEDIA_DOWNLOAD_CONCURRENCY);
        const tasks = toDownload.map(entry => limit(async () => {
            try {
                const buffer = await feishuClient.downloadMedia(entry.token);
                const ext = this.guessExtension(entry);
                const fileName = entry.name || `${entry.token}${ext}`;
                const fileUri = vscode.Uri.joinPath(docAssetsUri, fileName);

                await vscode.workspace.fs.writeFile(fileUri, buffer);
                this.downloadedTokens.add(entry.token);
                logger.info(`  已下载: ${fileName}`);
            } catch (err: any) {
                logger.error(`  下载失败 [${entry.token}]: ${err.message}`);
            }
        }));

        await Promise.all(tasks);
    }

    /**
     * 获取已下载的 Token 集合（用于持久化到 manifest）
     */
    public getDownloadedTokens(): Set<string> {
        return this.downloadedTokens;
    }

    /**
     * 确保目录存在
     */
    private async ensureDirectory(uri: vscode.Uri): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(uri);
        } catch {
            // 目录已存在
        }
    }

    /**
     * 根据媒体类型猜测文件扩展名
     */
    private guessExtension(entry: MediaTokenEntry): string {
        if (entry.name) {
            const match = entry.name.match(/\.[^.]+$/);
            if (match) return match[0];
        }
        return entry.type === 'image' ? '.png' : '';
    }

    private sanitizeFileName(name: string): string {
        return name.replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim();
    }
}
