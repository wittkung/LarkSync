import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Worker } from 'worker_threads';
import pLimit from 'p-limit';
import { fetchAllWikiNodesRecursive, WikiNode } from './feishuTree';
import { getTenantAccessToken } from './feishuApi';
import { fetchDocsMetadata } from './feishuMeta';
import { logger } from './logger';

interface SyncState {
    [documentId: string]: {
        lastSyncTime: number; // For compatibility or explicit updates
        cloudEditTime?: string; // UNIX Timestamp string from Drive Meta
    }
}

export class SyncEngine {
    private isSyncing = false;
    private statePath = '';

    public get syncActive() {
        return this.isSyncing;
    }

    public async startSync(silent: boolean = false, forceFullTree: boolean = false) {
        logger.info('Sync triggered.');
        if (this.isSyncing) {
            logger.warn('Sync is already in progress.');
            if (!silent) vscode.window.showWarningMessage('LarkSync: Sync is already in progress.');
            return;
        }

        const config = vscode.workspace.getConfiguration('larksync');
        const spaceId = config.get<string>('spaceId');
        if (!spaceId) {
            logger.error('Sync aborted: Space ID is not configured in settings.');
            if (!silent) vscode.window.showErrorMessage('LarkSync: Space ID is not configured. Please set it in VS Code settings.');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            logger.error('Sync aborted: No VS Code workspace folder is currently open.');
            if (!silent) vscode.window.showErrorMessage('LarkSync: Please open a workspace folder to sync documents.');
            return;
        }

        this.isSyncing = true;
        const syncDirName = config.get<string>('syncDirectory') || 'LarkDocs';
        const rootPath = path.join(workspaceFolders[0].uri.fsPath, syncDirName);
        logger.info(`Starting sync for Space ID: ${spaceId} into Workspace: ${rootPath}`);

        // Git-friendly persistent state path inside root folder
        this.statePath = path.join(rootPath, '.larksync_state.json');
        const treeCachePath = path.join(rootPath, '.larksync_tree.json');

        if (!fs.existsSync(rootPath)) {
            logger.info(`Creating root sync directory: ${rootPath}`);
            fs.mkdirSync(rootPath, { recursive: true });
        }

        try {
            logger.info('Initializing VS Code Progress Window...');
            await vscode.window.withProgress({
                location: silent ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification,
                title: "LarkSync",
                cancellable: false
            }, async (progress) => {
                let nodes: WikiNode[] = [];

                if (!forceFullTree && fs.existsSync(treeCachePath)) {
                    try {
                        nodes = JSON.parse(fs.readFileSync(treeCachePath, 'utf-8'));
                        logger.info(`Loaded ${nodes.length} nodes from local tree cache. Skipping remote fetch.`);
                        progress.report({ message: "Loaded directory tree from cache..." });
                    } catch (e: any) {
                        logger.warn(`Failed to parse tree cache: ${e.message}. Forcing full tree fetch.`);
                        forceFullTree = true;
                    }
                }

                if (nodes.length === 0 || forceFullTree) {
                    logger.info('Progress window activated. Fetching structural tree from Feishu (this may take a while)...');
                    progress.report({ message: "Fetching directory tree from Feishu..." });
                    nodes = await fetchAllWikiNodesRecursive(spaceId);
                    fs.writeFileSync(treeCachePath, JSON.stringify(nodes, null, 2), 'utf-8');
                    logger.info(`Saved ${nodes.length} nodes to local tree cache.`);
                }

                progress.report({ message: `Preparing synchronized state for ${nodes.length} nodes...` });
                await this.syncNodes(nodes, rootPath, progress);
            });
            logger.info('Sync completed successfully!');
            vscode.commands.executeCommand('larksync.refreshSidebar');
            if (!silent) vscode.window.showInformationMessage('LarkSync: Sync completed successfully!');
        } catch (error: any) {
            logger.error(`Critical Sync Error: ${error.message}`, error);
            if (!silent) vscode.window.showErrorMessage(`LarkSync Error: ${error.message}`);
        } finally {
            this.isSyncing = false;
        }
    }

    private async syncNodes(nodes: WikiNode[], rootPath: string, progress: vscode.Progress<{ message?: string; increment?: number }>) {
        let syncState: SyncState = {};
        if (fs.existsSync(this.statePath)) {
            syncState = JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));
        }

        const limit = pLimit(3); // Lowered from 15 to 3 to avoid triggering Feishu's 99991400 API Frequency Limit
        this.buildLocalDirectories(nodes, rootPath);

        const docs = nodes.filter(n => n.obj_type === 'doc' || n.obj_type === 'docx');
        const incrementValue = 100 / (docs.length || 1);
        const token = await getTenantAccessToken();

        // 1. Fetch Cloud Metas for real edit_times
        progress.report({ message: `Verifying cloud modifications for ${docs.length} docs...` });
        logger.info('Fetching Drive Metadatas for incremental comparison...');
        const metaTokens = docs.map(d => ({ token: d.obj_token, type: d.obj_type, title: d.title }));
        const cloudMetas = await fetchDocsMetadata(metaTokens);

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
                    logger.info(`Skipped unchanged document: [${doc.title}]`);
                    return;
                }
            } else if (fileExists && docState && !cloudMeta) {
                // Fallback heuristic if meta fetch failed but file was recently synced
                if (Date.now() - docState.lastSyncTime < 43200 * 1000) {
                    logger.info(`Skipped document (Cache Fallback): [${doc.title}]`);
                    return;
                }
            }

            logger.info(`Starting download worker for: [${doc.title}]`);
            const errResult = await this.runWorkerForDoc(doc.obj_token, token, targetPath, doc.title);
            if (errResult.success) {
                logger.info(`Successfully saved: [${doc.title}]`);
                syncState[doc.obj_token] = {
                    lastSyncTime: errResult.timestamp!,
                    cloudEditTime: cloudMeta?.latest_modify_time || undefined
                };
            } else {
                logger.error(`Failed to convert [${doc.title}]: ${errResult.error}`);
            }
        }));

        await Promise.all(tasks);
        fs.writeFileSync(this.statePath, JSON.stringify(syncState, null, 2), 'utf-8');
    }

    private buildLocalDirectories(nodes: WikiNode[], rootPath: string) {
        const nodeMap = new Map<string, WikiNode>();
        nodes.forEach(n => nodeMap.set(n.node_token, n));

        const getPathForNode = (node: WikiNode): string => {
            const parts = [node.title.replace(/[\\/:*?"<>|]/g, '_')];
            let current = node;
            while (current.parent_node_token && nodeMap.has(current.parent_node_token)) {
                current = nodeMap.get(current.parent_node_token)!;
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

    private getDocLocalPath(doc: WikiNode, rootPath: string, allNodes: WikiNode[]): string {
        const nodeMap = new Map<string, WikiNode>();
        allNodes.forEach(n => nodeMap.set(n.node_token, n));

        const parts = [doc.title.replace(/[\\/:*?"<>|]/g, '_') + '.md'];
        let current = doc;
        while (current.parent_node_token && nodeMap.has(current.parent_node_token)) {
            current = nodeMap.get(current.parent_node_token)!;
            parts.unshift(current.title.replace(/[\\/:*?"<>|]/g, '_'));
        }
        return path.join(rootPath, ...parts);
    }

    private runWorkerForDoc(documentId: string, token: string, targetPath: string, title: string): Promise<{ success: boolean, timestamp?: number, error?: string }> {
        return new Promise((resolve) => {
            const workerPath = path.join(__dirname, 'markdownWorker.js');
            const worker = new Worker(workerPath, {
                workerData: { documentId, token, targetPath, title }
            });
            worker.on('message', (msg) => {
                resolve(msg);
            });
            worker.on('error', (err) => resolve({ success: false, error: err.message }));
            worker.on('exit', (code) => {
                if (code !== 0) resolve({ success: false, error: `Worker stopped with exit code ${code}` });
            });
        });
    }
}
