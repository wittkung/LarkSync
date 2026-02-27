"use strict";
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
const fs = __importStar(require("fs"));
const worker_threads_1 = require("worker_threads");
const p_limit_1 = __importDefault(require("p-limit"));
const feishuTree_1 = require("./feishuTree");
const feishuApi_1 = require("./feishuApi");
const feishuMeta_1 = require("./feishuMeta");
const logger_1 = require("./logger");
class SyncEngine {
    constructor() {
        this.isSyncing = false;
        this.statePath = '';
    }
    get syncActive() {
        return this.isSyncing;
    }
    async startSync(silent = false, forceFullTree = false) {
        logger_1.logger.info('Sync triggered.');
        if (this.isSyncing) {
            logger_1.logger.warn('Sync is already in progress.');
            if (!silent)
                vscode.window.showWarningMessage('LarkSync: Sync is already in progress.');
            return;
        }
        const config = vscode.workspace.getConfiguration('larksync');
        const spaceId = config.get('spaceId');
        if (!spaceId) {
            logger_1.logger.error('Sync aborted: Space ID is not configured in settings.');
            if (!silent)
                vscode.window.showErrorMessage('LarkSync: Space ID is not configured. Please set it in VS Code settings.');
            return;
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            logger_1.logger.error('Sync aborted: No VS Code workspace folder is currently open.');
            if (!silent)
                vscode.window.showErrorMessage('LarkSync: Please open a workspace folder to sync documents.');
            return;
        }
        this.isSyncing = true;
        const syncDirName = config.get('syncDirectory') || 'LarkDocs';
        const rootPath = path.join(workspaceFolders[0].uri.fsPath, syncDirName);
        logger_1.logger.info(`Starting sync for Space ID: ${spaceId} into Workspace: ${rootPath}`);
        // Git-friendly persistent state path inside root folder
        this.statePath = path.join(rootPath, '.larksync_state.json');
        const treeCachePath = path.join(rootPath, '.larksync_tree.json');
        if (!fs.existsSync(rootPath)) {
            logger_1.logger.info(`Creating root sync directory: ${rootPath}`);
            fs.mkdirSync(rootPath, { recursive: true });
        }
        try {
            logger_1.logger.info('Initializing VS Code Progress Window...');
            await vscode.window.withProgress({
                location: silent ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification,
                title: "LarkSync",
                cancellable: false
            }, async (progress) => {
                let nodes = [];
                if (!forceFullTree && fs.existsSync(treeCachePath)) {
                    try {
                        nodes = JSON.parse(fs.readFileSync(treeCachePath, 'utf-8'));
                        logger_1.logger.info(`Loaded ${nodes.length} nodes from local tree cache. Skipping remote fetch.`);
                        progress.report({ message: "Loaded directory tree from cache..." });
                    }
                    catch (e) {
                        logger_1.logger.warn(`Failed to parse tree cache: ${e.message}. Forcing full tree fetch.`);
                        forceFullTree = true;
                    }
                }
                if (nodes.length === 0 || forceFullTree) {
                    logger_1.logger.info('Progress window activated. Fetching structural tree from Feishu (this may take a while)...');
                    progress.report({ message: "Fetching directory tree from Feishu..." });
                    nodes = await (0, feishuTree_1.fetchAllWikiNodesRecursive)(spaceId);
                    fs.writeFileSync(treeCachePath, JSON.stringify(nodes, null, 2), 'utf-8');
                    logger_1.logger.info(`Saved ${nodes.length} nodes to local tree cache.`);
                }
                progress.report({ message: `Preparing synchronized state for ${nodes.length} nodes...` });
                await this.syncNodes(nodes, rootPath, progress);
            });
            logger_1.logger.info('Sync completed successfully!');
            vscode.commands.executeCommand('larksync.refreshSidebar');
            if (!silent)
                vscode.window.showInformationMessage('LarkSync: Sync completed successfully!');
        }
        catch (error) {
            logger_1.logger.error(`Critical Sync Error: ${error.message}`, error);
            if (!silent)
                vscode.window.showErrorMessage(`LarkSync Error: ${error.message}`);
        }
        finally {
            this.isSyncing = false;
        }
    }
    async syncNodes(nodes, rootPath, progress) {
        let syncState = {};
        if (fs.existsSync(this.statePath)) {
            syncState = JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));
        }
        const limit = (0, p_limit_1.default)(3); // Lowered from 15 to 3 to avoid triggering Feishu's 99991400 API Frequency Limit
        this.buildLocalDirectories(nodes, rootPath);
        const docs = nodes.filter(n => n.obj_type === 'doc' || n.obj_type === 'docx');
        const incrementValue = 100 / (docs.length || 1);
        const token = await (0, feishuApi_1.getTenantAccessToken)();
        // 1. Fetch Cloud Metas for real edit_times
        progress.report({ message: `Verifying cloud modifications for ${docs.length} docs...` });
        logger_1.logger.info('Fetching Drive Metadatas for incremental comparison...');
        const metaTokens = docs.map(d => ({ token: d.obj_token, type: d.obj_type, title: d.title }));
        const cloudMetas = await (0, feishuMeta_1.fetchDocsMetadata)(metaTokens);
        const tasks = docs.map(doc => limit(async () => {
            progress.report({ message: `Syncing: ${doc.title}`, increment: incrementValue });
            const targetPath = this.getDocLocalPath(doc, rootPath, nodes);
            const docState = syncState[doc.obj_token];
            const fileExists = fs.existsSync(targetPath);
            const cloudMeta = cloudMetas.get(doc.obj_token);
            // True Incremental Logic
            if (fileExists && docState && cloudMeta) {
                // If local state knows about this edit_time and it matches cloud, SKIP
                if (docState.cloudEditTime === cloudMeta.latest_modify_time) {
                    logger_1.logger.info(`Skipped unchanged document: [${doc.title}]`);
                    return;
                }
            }
            else if (fileExists && docState && !cloudMeta) {
                // Fallback heuristic if meta fetch failed but file was recently synced
                if (Date.now() - docState.lastSyncTime < 43200 * 1000) {
                    logger_1.logger.info(`Skipped document (Cache Fallback): [${doc.title}]`);
                    return;
                }
            }
            logger_1.logger.info(`Starting download worker for: [${doc.title}]`);
            const errResult = await this.runWorkerForDoc(doc.obj_token, token, targetPath, doc.title);
            if (errResult.success) {
                logger_1.logger.info(`Successfully saved: [${doc.title}]`);
                syncState[doc.obj_token] = {
                    lastSyncTime: errResult.timestamp,
                    cloudEditTime: cloudMeta?.latest_modify_time || undefined
                };
            }
            else {
                logger_1.logger.error(`Failed to convert [${doc.title}]: ${errResult.error}`);
            }
        }));
        await Promise.all(tasks);
        fs.writeFileSync(this.statePath, JSON.stringify(syncState, null, 2), 'utf-8');
    }
    buildLocalDirectories(nodes, rootPath) {
        const nodeMap = new Map();
        nodes.forEach(n => nodeMap.set(n.node_token, n));
        const getPathForNode = (node) => {
            const parts = [node.title.replace(/[\\/:*?"<>|]/g, '_')];
            let current = node;
            while (current.parent_node_token && nodeMap.has(current.parent_node_token)) {
                current = nodeMap.get(current.parent_node_token);
                parts.unshift(current.title.replace(/[\\/:*?"<>|]/g, '_'));
            }
            return path.join(rootPath, ...parts.slice(0, -1));
        };
        nodes.forEach(node => {
            const dirPath = getPathForNode(node);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        });
    }
    getDocLocalPath(doc, rootPath, allNodes) {
        const nodeMap = new Map();
        allNodes.forEach(n => nodeMap.set(n.node_token, n));
        const parts = [doc.title.replace(/[\\/:*?"<>|]/g, '_') + '.md'];
        let current = doc;
        while (current.parent_node_token && nodeMap.has(current.parent_node_token)) {
            current = nodeMap.get(current.parent_node_token);
            parts.unshift(current.title.replace(/[\\/:*?"<>|]/g, '_'));
        }
        return path.join(rootPath, ...parts);
    }
    runWorkerForDoc(documentId, token, targetPath, title) {
        return new Promise((resolve) => {
            const workerPath = path.join(__dirname, 'markdownWorker.js');
            const worker = new worker_threads_1.Worker(workerPath, {
                workerData: { documentId, token, targetPath, title }
            });
            worker.on('message', (msg) => {
                resolve(msg);
            });
            worker.on('error', (err) => resolve({ success: false, error: err.message }));
            worker.on('exit', (code) => {
                if (code !== 0)
                    resolve({ success: false, error: `Worker stopped with exit code ${code}` });
            });
        });
    }
}
exports.SyncEngine = SyncEngine;
//# sourceMappingURL=syncEngine.js.map