"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncEngine = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const worker_threads_1 = require("worker_threads");
const p_limit_1 = __importDefault(require("p-limit"));
const feishuClient_1 = require("./api/feishuClient");
const stateManager_1 = require("./core/stateManager");
const fileManager_1 = require("./core/fileManager");
const mediaManager_1 = require("./core/mediaManager");
const constants_1 = require("./utils/constants");
const logger_1 = require("./logger");
const errors_1 = require("./utils/errors");
const fileWriteStrategy_1 = require("./utils/fileWriteStrategy");
class SyncEngine {
    constructor() {
        this.isSyncing = false;
    }
    get syncActive() {
        return this.isSyncing;
    }
    async startSync(silent = false, forceFullTree = false) {
        logger_1.logger.info('同步触发。');
        if (this.isSyncing) {
            logger_1.logger.warn('同步正在进行中。');
            if (!silent) {
                vscode.window.showWarningMessage('LarkSync: 同步正在进行中。');
            }
            return;
        }
        const config = vscode.workspace.getConfiguration('larksync');
        const spaceId = config.get('spaceId');
        if (!spaceId) {
            logger_1.logger.error('同步中止: 未配置 Space ID。');
            if (!silent) {
                vscode.window.showErrorMessage('LarkSync: 请在设置中配置 Space ID。');
            }
            return;
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            logger_1.logger.error('同步中止: 未打开工作区目录。');
            if (!silent) {
                vscode.window.showErrorMessage('LarkSync: 请打开一个工作区目录。');
            }
            return;
        }
        this.isSyncing = true;
        const syncDirName = config.get('syncDirectory') || constants_1.CONSTANTS.DEFAULT_SYNC_DIR;
        const rootUri = vscode.Uri.joinPath(workspaceFolders[0].uri, syncDirName);
        logger_1.logger.info(`开始同步 Space: ${spaceId} → ${rootUri.fsPath}`);
        // 初始化各管理器
        this.stateManager = new stateManager_1.StateManager(rootUri);
        this.fileManager = new fileManager_1.FileManager(rootUri);
        this.mediaManager = new mediaManager_1.MediaManager(rootUri);
        await this.fileManager.ensureRootDirectory();
        await this.stateManager.loadState();
        await this.mediaManager.initialize();
        const treeCacheUri = vscode.Uri.joinPath(rootUri, constants_1.CONSTANTS.TREE_CACHE_FILE_NAME);
        try {
            logger_1.logger.info('初始化进度窗口...');
            await vscode.window.withProgress({
                location: silent ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification,
                title: "LarkSync",
                cancellable: false
            }, async (progress) => {
                let nodes = [];
                // 尝试从本地缓存加载目录树
                if (!forceFullTree) {
                    try {
                        const cacheData = await vscode.workspace.fs.readFile(treeCacheUri);
                        nodes = JSON.parse(Buffer.from(cacheData).toString('utf-8'));
                        logger_1.logger.info(`从缓存加载了 ${nodes.length} 个节点。`);
                        progress.report({ message: "从缓存加载目录树..." });
                    }
                    catch {
                        logger_1.logger.info('无本地缓存，将从飞书拉取。');
                    }
                }
                // 从飞书拉取目录树
                if (nodes.length === 0 || forceFullTree) {
                    logger_1.logger.info('从飞书拉取目录树...');
                    progress.report({ message: "正在从飞书拉取目录树..." });
                    nodes = await feishuClient_1.feishuClient.fetchAllWikiNodesRecursive(spaceId);
                    // 缓存目录树
                    const treeCacheContent = Buffer.from(JSON.stringify(nodes, null, 2), 'utf-8');
                    await vscode.workspace.fs.writeFile(treeCacheUri, treeCacheContent);
                    logger_1.logger.info(`已缓存 ${nodes.length} 个节点。`);
                }
                progress.report({ message: `准备同步 ${nodes.length} 个节点...` });
                this.fileManager.setNodes(nodes);
                await this.syncNodes(nodes, progress);
            });
            logger_1.logger.info('同步完成！');
            vscode.commands.executeCommand('larksync.refreshSidebar');
            if (!silent) {
                vscode.window.showInformationMessage('LarkSync: 同步完成！');
            }
        }
        catch (error) {
            logger_1.logger.error(`同步错误: ${error.message}`, error);
            if (!silent) {
                vscode.window.showErrorMessage(`LarkSync 错误: ${error.message}`);
            }
        }
        finally {
            this.isSyncing = false;
        }
    }
    /**
     * 同步所有文档节点
     */
    async syncNodes(nodes, progress) {
        const limit = (0, p_limit_1.default)(constants_1.CONSTANTS.CONCURRENCY_LIMIT);
        // 构建本地目录结构
        await this.fileManager.buildLocalDirectories(nodes);
        // 筛选文档节点
        const docs = nodes.filter(n => n.obj_type === 'doc' || n.obj_type === 'docx');
        const incrementValue = 100 / (docs.length || 1);
        // 批量获取云端元数据（用于增量比对）
        progress.report({ message: `正在校验 ${docs.length} 篇文档的云端状态...` });
        logger_1.logger.info('批量获取文档元数据...');
        const metaTokens = docs.map(d => ({ token: d.obj_token, type: d.obj_type, title: d.title }));
        const cloudMetas = await feishuClient_1.feishuClient.fetchDocsMetadata(metaTokens);
        // 并发处理每篇文档
        const tasks = docs.map(doc => limit(async () => {
            progress.report({ message: `同步: ${doc.title}`, increment: incrementValue });
            const targetUri = this.fileManager.getDocLocalUri(doc);
            const fileExists = await this.fileManager.fileExists(targetUri);
            const cloudMeta = cloudMetas.get(doc.obj_token);
            // 增量比对：如果文档未变更则跳过
            if (fileExists && this.stateManager.getDocState(doc.obj_token)) {
                if (this.stateManager.isDocUnchanged(doc.obj_token, cloudMeta?.latest_modify_time)) {
                    logger_1.logger.info(`跳过 (未变更): [${doc.title}]`);
                    return;
                }
            }
            logger_1.logger.info(`开始处理: [${doc.title}]`);
            try {
                // Step 1: 主线程从飞书拉取 Block 数据
                const blocks = await this.fetchDocBlocks(doc.obj_token, doc.title);
                // Step 2: Worker 线程执行 AST 转换
                const result = await this.runWorkerConversion(blocks, doc.title);
                if (result.success) {
                    // Step 3: 主线程写入 Markdown 文件（含 Frontmatter 保护）
                    let existingContent = null;
                    if (fileExists) {
                        try {
                            existingContent = await this.fileManager.readFile(targetUri);
                        }
                        catch {
                            // 读取失败则视为首次写入
                        }
                    }
                    const finalContent = (0, fileWriteStrategy_1.applyProtectedWrite)(existingContent, result.markdown);
                    await this.fileManager.writeFile(targetUri, finalContent);
                    logger_1.logger.info(`已保存: [${doc.title}]`);
                    // Step 4: 主线程下载媒体资源
                    if (result.mediaTokens && result.mediaTokens.length > 0) {
                        await this.mediaManager.processTokens(result.mediaTokens, doc.title);
                    }
                    // 更新同步状态
                    this.stateManager.updateDocState(doc.obj_token, Date.now(), cloudMeta?.latest_modify_time);
                }
                else {
                    logger_1.logger.error(`转换失败 [${doc.title}]: ${result.error}`);
                }
            }
            catch (err) {
                logger_1.logger.error(`处理失败 [${doc.title}]: ${err.message}`);
            }
        }));
        await Promise.all(tasks);
        await this.stateManager.saveState();
    }
    /**
     * 从飞书 API 分页拉取文档的所有 Block 数据
     */
    async fetchDocBlocks(documentId, title) {
        let allBlocks = [];
        let pageToken = '';
        let hasMore = true;
        while (hasMore) {
            const params = { page_size: 50 };
            if (pageToken)
                params.page_token = pageToken;
            try {
                const response = await feishuClient_1.feishuClient.request({
                    url: `/docx/v1/documents/${documentId}/blocks`,
                    method: 'GET',
                    params
                });
                if (response.items) {
                    allBlocks = allBlocks.concat(response.items);
                }
                hasMore = response.has_more;
                pageToken = response.page_token;
            }
            catch (err) {
                if (err instanceof errors_1.FeishuApiError) {
                    throw new Error(`API Error [${err.code}]: ${err.message} — 请确认应用拥有 docx:document:readonly 权限。`);
                }
                throw err;
            }
        }
        logger_1.logger.info(`  [${title}] 共拉取 ${allBlocks.length} 个 Block。`);
        return allBlocks;
    }
    /**
     * 在 Worker 线程中执行 AST→Markdown 转换
     */
    runWorkerConversion(blocks, title) {
        return new Promise((resolve) => {
            const workerPath = path.join(__dirname, 'markdownWorker.js');
            const worker = new worker_threads_1.Worker(workerPath, {
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
exports.SyncEngine = SyncEngine;
//# sourceMappingURL=syncEngine.js.map