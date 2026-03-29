/**
 * syncEngine.ts
 * 同步引擎 — 编排文档拉取、AST 转换、文件写入和媒体下载
 *
 * 架构（Plan A）：
 * 1. 主线程从飞书 API 拉取文档 Block 数据
 * 2. 将 Block 数据发送给 Worker 线程做 AST→Markdown 转换
 * 3. 主线程通过 vscode.workspace.fs 写入 Markdown 文件
 * 4. 主线程通过 MediaManager 下载媒体资源
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Worker } from 'worker_threads';
import pLimit from 'p-limit';

import { feishuClient } from './api/feishuClient';
import { StateManager } from './core/stateManager';
import { FileManager } from './core/fileManager';
import { MediaManager } from './core/mediaManager';
import { WikiNode, DocxBlock, DocxBlockListResponse, MediaTokenEntry } from './types';
import { CONSTANTS } from './utils/constants';
import { logger } from './logger';
import { FeishuApiError } from './utils/errors';
import { applyProtectedWrite } from './utils/fileWriteStrategy';

export class SyncEngine {
    private isSyncing = false;
    private stateManager!: StateManager;
    private fileManager!: FileManager;
    private mediaManager!: MediaManager;

    public get syncActive() {
        return this.isSyncing;
    }

    public get state(): StateManager {
        return this.stateManager;
    }

    public async startSync(silent: boolean = false, forceFullTree: boolean = false) {
        logger.info('同步触发。');
        if (this.isSyncing) {
            logger.warn('同步正在进行中。');
            if (!silent) {
                vscode.window.showWarningMessage('LarkSync: 同步正在进行中。');
            }
            return;
        }

        const config = vscode.workspace.getConfiguration('larksync');
        const spaceId = config.get<string>('spaceId');
        if (!spaceId) {
            logger.error('同步中止: 未配置 Space ID。');
            if (!silent) {
                vscode.window.showErrorMessage('LarkSync: 请在设置中配置 Space ID。');
            }
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            logger.error('同步中止: 未打开工作区目录。');
            if (!silent) {
                vscode.window.showErrorMessage('LarkSync: 请打开一个工作区目录。');
            }
            return;
        }

        this.isSyncing = true;
        const syncDirName = config.get<string>('syncDirectory') || CONSTANTS.DEFAULT_SYNC_DIR;
        const rootUri = vscode.Uri.joinPath(workspaceFolders[0].uri, syncDirName);
        logger.info(`开始同步 Space: ${spaceId} → ${rootUri.fsPath}`);

        // 初始化各管理器
        this.stateManager = new StateManager(rootUri);
        this.fileManager = new FileManager(rootUri);
        this.mediaManager = new MediaManager(rootUri);

        await this.fileManager.ensureRootDirectory();
        await this.stateManager.loadState();
        await this.mediaManager.initialize();

        const treeCacheUri = vscode.Uri.joinPath(rootUri, CONSTANTS.TREE_CACHE_FILE_NAME);

        try {
            logger.info('初始化进度窗口...');
            await vscode.window.withProgress({
                location: silent ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification,
                title: "LarkSync",
                cancellable: false
            }, async (progress) => {
                let nodes: WikiNode[] = [];
                const deleteOrphans = config.get<boolean>('deleteOrphanFiles') ?? true;

                // 当启用孤儿清理时，必须始终从云端拉取最新树以准确检测删除
                const mustFetchFreshTree = deleteOrphans || forceFullTree;

                // 尝试从本地缓存加载目录树
                if (!mustFetchFreshTree) {
                    try {
                        const cacheData = await vscode.workspace.fs.readFile(treeCacheUri);
                        nodes = JSON.parse(Buffer.from(cacheData).toString('utf-8'));
                        logger.info(`从缓存加载了 ${nodes.length} 个节点。`);
                        progress.report({ message: "从缓存加载目录树..." });
                    } catch {
                        logger.info('无本地缓存，将从飞书拉取。');
                    }
                }

                // 从飞书拉取目录树
                if (nodes.length === 0 || mustFetchFreshTree) {
                    logger.info('从飞书拉取目录树...');
                    progress.report({ message: "正在从飞书拉取目录树..." });
                    nodes = await feishuClient.fetchAllWikiNodesRecursive(spaceId);

                    // 缓存目录树
                    const treeCacheContent = Buffer.from(JSON.stringify(nodes, null, 2), 'utf-8');
                    await vscode.workspace.fs.writeFile(treeCacheUri, treeCacheContent);
                    logger.info(`已缓存 ${nodes.length} 个节点。`);
                }

                progress.report({ message: `准备同步 ${nodes.length} 个节点...` });
                this.fileManager.setNodes(nodes);
                await this.syncNodes(nodes, progress);

                // 清理云端已删除的本地孤儿文件
                if (deleteOrphans) {
                    progress.report({ message: '正在清理云端已删除的本地文件...' });
                    await this.cleanOrphanFiles(nodes);
                }
            });

            logger.info('同步完成！');
            vscode.commands.executeCommand('larksync.refreshSidebar');
            if (!silent) {
                vscode.window.showInformationMessage('LarkSync: 同步完成！');
            }
        } catch (error: any) {
            logger.error(`同步错误: ${error.message}`, error);
            if (!silent) {
                vscode.window.showErrorMessage(`LarkSync 错误: ${error.message}`);
            }
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * 同步所有文档节点
     */
    private async syncNodes(nodes: WikiNode[], progress: vscode.Progress<{ message?: string; increment?: number }>) {
        const limit = pLimit(CONSTANTS.CONCURRENCY_LIMIT);

        // 构建本地目录结构
        await this.fileManager.buildLocalDirectories(nodes);

        // 筛选文档节点
        const docs = nodes.filter(n => n.obj_type === 'doc' || n.obj_type === 'docx');
        const incrementValue = 100 / (docs.length || 1);

        // 批量获取云端元数据（用于增量比对）
        progress.report({ message: `正在校验 ${docs.length} 篇文档的云端状态...` });
        logger.info('批量获取文档元数据...');

        const metaTokens = docs.map(d => ({ token: d.obj_token, type: d.obj_type, title: d.title }));
        const cloudMetas = await feishuClient.fetchDocsMetadata(metaTokens);

        // 并发处理每篇文档
        const tasks = docs.map(doc => limit(async () => {
            progress.report({ message: `同步: ${doc.title}`, increment: incrementValue });

            const targetUri = this.fileManager.getDocLocalUri(doc);
            const fileExists = await this.fileManager.fileExists(targetUri);
            const cloudMeta = cloudMetas.get(doc.obj_token);

            // 增量比对：如果文档未变更则跳过
            if (fileExists && this.stateManager.getDocState(doc.obj_token)) {
                if (this.stateManager.isDocUnchanged(doc.obj_token, cloudMeta?.latest_modify_time)) {
                    logger.info(`跳过 (未变更): [${doc.title}]`);
                    return;
                }
            }

            logger.info(`开始处理: [${doc.title}]`);

            try {
                // Step 1: 主线程从飞书拉取 Block 数据
                const blocks = await this.fetchDocBlocks(doc.obj_token, doc.title);

                // Step 2: Worker 线程执行 AST 转换
                const result = await this.runWorkerConversion(blocks, doc.title);

                if (result.success) {
                    // Step 3: 主线程写入 Markdown 文件（含 Frontmatter 保护）
                    let existingContent: string | null = null;
                    if (fileExists) {
                        try {
                            existingContent = await this.fileManager.readFile(targetUri);
                        } catch {
                            // 读取失败则视为首次写入
                        }
                    }
                    const finalContent = applyProtectedWrite(existingContent, result.markdown!);
                    await this.fileManager.writeFile(targetUri, finalContent);
                    logger.info(`已保存: [${doc.title}]`);

                    // Step 4: 主线程下载媒体资源
                    if (result.mediaTokens && result.mediaTokens.length > 0) {
                        await this.mediaManager.processTokens(result.mediaTokens, doc.title);
                    }

                    // 更新同步状态
                    this.stateManager.updateDocState(
                        doc.obj_token,
                        Date.now(),
                        cloudMeta?.latest_modify_time,
                        this.fileManager.getDocRelativePath(doc)
                    );
                } else {
                    logger.error(`转换失败 [${doc.title}]: ${result.error}`);
                }
            } catch (err: any) {
                logger.error(`处理失败 [${doc.title}]: ${err.message}`);
            }
        }));

        await Promise.all(tasks);
        await this.stateManager.saveState();
    }

    /**
     * 清理云端已删除/移动但本地仍存在的孤儿文件和空目录
     */
    private async cleanOrphanFiles(nodes: WikiNode[]) {
        // 使用 uri.toString() 建立预期路径集合，杜绝操作系统的 fsPath 差异
        const expectedUris = this.fileManager.getExpectedDocUris(nodes);
        const localFiles = await this.fileManager.listLocalMarkdownFiles();

        logger.info(`孤儿检测: 云端文档 ${expectedUris.size} 篇, 本地文件 ${localFiles.length} 个`);

        let deletedCount = 0;
        for (const localUri of localFiles) {
            const localUriString = localUri.toString();
            if (!expectedUris.has(localUriString)) {
                logger.info(`删除孤儿文件: ${localUri.fsPath}`);
                await this.fileManager.deleteFile(localUri);
                deletedCount++;
            }
        }

        // 删除 .md 文件后，递归清理空目录
        const emptyDirCount = await this.fileManager.cleanEmptyDirectories();

        if (deletedCount > 0 || emptyDirCount > 0) {
            logger.info(`共清理 ${deletedCount} 个孤儿文件, ${emptyDirCount} 个空目录。`);
        } else {
            logger.info('无需清理孤儿文件。');
        }
    }

    /**
     * 从飞书 API 分页拉取文档的所有 Block 数据
     */
    private async fetchDocBlocks(documentId: string, title: string): Promise<DocxBlock[]> {
        let allBlocks: DocxBlock[] = [];
        let pageToken = '';
        let hasMore = true;

        while (hasMore) {
            const params: any = { page_size: 50 };
            if (pageToken) params.page_token = pageToken;

            try {
                const response = await feishuClient.request<DocxBlockListResponse>({
                    url: `/docx/v1/documents/${documentId}/blocks`,
                    method: 'GET',
                    params
                });

                if (response.items) {
                    allBlocks = allBlocks.concat(response.items);
                }
                hasMore = response.has_more;
                pageToken = response.page_token;
            } catch (err: any) {
                if (err instanceof FeishuApiError) {
                    throw new Error(`API Error [${err.code}]: ${err.message} — 请确认应用拥有 docx:document:readonly 权限。`);
                }
                throw err;
            }
        }

        logger.info(`  [${title}] 共拉取 ${allBlocks.length} 个 Block。`);
        return allBlocks;
    }

    /**
     * 在 Worker 线程中执行 AST→Markdown 转换
     */
    private runWorkerConversion(
        blocks: DocxBlock[],
        title: string
    ): Promise<{ success: boolean; markdown?: string; mediaTokens?: MediaTokenEntry[]; error?: string }> {
        return new Promise((resolve) => {
            const workerPath = path.join(__dirname, 'markdownWorker.js');
            const worker = new Worker(workerPath, {
                workerData: { blocks, title }
            });

            worker.on('message', (msg) => {
                resolve(msg);
            });
            worker.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });
            worker.on('exit', (code) => {
                if (code !== 0) {
                    resolve({ success: false, error: `Worker 异常退出 (code: ${code})` });
                }
            });
        });
    }
}
