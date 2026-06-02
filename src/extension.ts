import * as vscode from 'vscode';
import { SyncEngine } from './syncEngine';
import { SyncScheduler } from './core/syncScheduler';
import { logger } from './logger';
import { SyncTreeProvider } from './treeProvider';
import { SyncFileDecorationProvider } from './ui/syncFileDecorationProvider';
import { TokenStore } from './auth/tokenStore';
import { OAuthManager } from './auth/oauthManager';
import { FeishuClient } from './api/feishuClient';
import { DashboardPanel } from './ui/dashboardPanel';
import { CONSTANTS } from './utils/constants';

let feishuClient: FeishuClient;

let syncEngine: SyncEngine;
let syncScheduler: SyncScheduler;
let statusBarItem: vscode.StatusBarItem;
let pollingTimer: NodeJS.Timeout | null = null;
let treeProvider: SyncTreeProvider;
let decorationProvider: SyncFileDecorationProvider;

export function activate(context: vscode.ExtensionContext) {
    try {
        logger.info('LarkSync extension is now active!');

        feishuClient = new FeishuClient();
        syncEngine = new SyncEngine(feishuClient);
        syncScheduler = new SyncScheduler(syncEngine);

        // 注册侧边栏知识树
        treeProvider = new SyncTreeProvider(syncEngine);
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider('larksyncSidebar', treeProvider)
        );

        // 注册文件装饰器（A/M/D 差异状态徽标）
        decorationProvider = new SyncFileDecorationProvider();
        context.subscriptions.push(
            vscode.window.registerFileDecorationProvider(decorationProvider)
        );

        // Create Status Bar Item
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.command = 'larksync.startSync';
        statusBarItem.text = '$(sync) LarkSync';
        statusBarItem.tooltip = 'Click to force sync Feishu Docs';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);

        // Register Fast Sync Command
        context.subscriptions.push(
            vscode.commands.registerCommand('larksync.startSync', async () => {
                statusBarItem.text = '$(sync~spin) LarkSync Syncing';
                await syncScheduler.requestSync(false, false);
                statusBarItem.text = '$(sync) LarkSync';
            })
        );

        // Register Force Full Sync Command
        context.subscriptions.push(
            vscode.commands.registerCommand('larksync.forceSyncTree', async () => {
                statusBarItem.text = '$(sync~spin) LarkSync Fetching Tree...';
                await syncScheduler.requestSync(false, true);
                statusBarItem.text = '$(sync) LarkSync';
            })
        );

        // Register Open Sync Folder Command
        context.subscriptions.push(
            vscode.commands.registerCommand('larksync.openSyncFolder', () => {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    const config = vscode.workspace.getConfiguration('larksync');
                    const syncDirName = config.get<string>('syncDir', CONSTANTS.DEFAULT_SYNC_DIR);
                    const targetUri = vscode.Uri.joinPath(workspaceFolders[0].uri, syncDirName);
                    vscode.commands.executeCommand('revealFileInOS', targetUri);
                } else {
                    vscode.window.showErrorMessage('LarkSync: 没有打开的工作区。');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('larksync.refreshSidebar', () => {
                if (treeProvider) {
                    treeProvider.refresh();
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('larksync.openDashboard', () => {
                DashboardPanel.createOrShow(context.extensionUri, syncEngine, feishuClient);
            })
        );

        // 注册 OAuth 登录/登出（独立 try-catch，不影响核心功能）
        try {
            const tokenStore = new TokenStore(context.secrets);
            const oauthManager = new OAuthManager(tokenStore);

            context.subscriptions.push(vscode.window.registerUriHandler(oauthManager));

            context.subscriptions.push(
                vscode.commands.registerCommand('larksync.login', async () => {
                    const success = await oauthManager.login();
                    if (success) {
                        const userToken = await oauthManager.getValidUserToken();
                        if (userToken) {
                            feishuClient.setUserAccessToken(userToken);
                        }
                    }
                })
            );

            context.subscriptions.push(
                vscode.commands.registerCommand('larksync.logout', async () => {
                    await oauthManager.logout();
                    feishuClient.setUserAccessToken('');
                })
            );
        } catch (authErr: any) {
            logger.error(`OAuth 初始化失败（不影响核心同步）: ${authErr.message}`, authErr);
        }

        // Setup Polling
        setupPolling();

        // Re-setup polling if configuration changes
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('larksync.pollingIntervalMinutes')) {
                    setupPolling();
                }
            })
        );

        logger.info('LarkSync 所有组件注册完毕。');
    } catch (err: any) {
        const msg = `LarkSync 激活失败: ${err.message}`;
        console.error(msg, err);
        logger.error(msg, err);
        vscode.window.showErrorMessage(msg);
    }
}

function setupPolling() {
    if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
    }

    const config = vscode.workspace.getConfiguration('larksync');
    const intervalMinutes = config.get<number>('pollingIntervalMinutes') || 0;

    if (intervalMinutes > 0) {
        const intervalMs = intervalMinutes * 60 * 1000;
        pollingTimer = setInterval(async () => {
            if (!syncScheduler.isSyncing) {
                console.log('LarkSync: Background polling triggered.');
                statusBarItem.text = '$(sync~spin) LarkSync Polling';
                await syncScheduler.requestSync(true, false); // silent = true, forceFullTree = false
                statusBarItem.text = '$(sync) LarkSync';
            }
        }, intervalMs);
    }
}

export function deactivate() {
    if (pollingTimer) {
        clearInterval(pollingTimer);
    }
}
