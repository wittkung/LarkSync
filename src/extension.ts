import * as vscode from 'vscode';
import { SyncEngine } from './syncEngine';
import { logger } from './logger';
import { SyncTreeProvider } from './treeProvider';
import { SyncFileDecorationProvider } from './ui/syncFileDecorationProvider';
import { TokenStore } from './auth/tokenStore';
import { OAuthManager } from './auth/oauthManager';
import { feishuClient } from './api/feishuClient';

let syncEngine: SyncEngine;
let statusBarItem: vscode.StatusBarItem;
let pollingTimer: NodeJS.Timeout | null = null;
let treeProvider: SyncTreeProvider;
let decorationProvider: SyncFileDecorationProvider;

export function activate(context: vscode.ExtensionContext) {
    try {
        logger.info('LarkSync extension is now active!');

        syncEngine = new SyncEngine();

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
        context.subscriptions.push(vscode.commands.registerCommand('larksync.startSync', async () => {
            if (syncEngine.syncActive) {
                vscode.window.showInformationMessage('LarkSync is already syncing...');
                return;
            }

            statusBarItem.text = '$(sync~spin) LarkSync Syncing';
            await syncEngine.startSync(false, false);
            statusBarItem.text = '$(sync) LarkSync';
        }));

        // Register Force Full Sync Command
        context.subscriptions.push(vscode.commands.registerCommand('larksync.forceSyncTree', async () => {
            if (syncEngine.syncActive) {
                vscode.window.showInformationMessage('LarkSync is already syncing...');
                return;
            }

            statusBarItem.text = '$(sync~spin) LarkSync Fetching Tree...';
            await syncEngine.startSync(false, true);
            statusBarItem.text = '$(sync) LarkSync';
        }));

        context.subscriptions.push(vscode.commands.registerCommand('larksync.refreshSidebar', () => {
            if (treeProvider) {
                treeProvider.refresh();
            }
        }));

        // 注册 OAuth 登录/登出（独立 try-catch，不影响核心功能）
        try {
            const tokenStore = new TokenStore(context.secrets);
            const oauthManager = new OAuthManager(tokenStore);

            context.subscriptions.push(
                vscode.window.registerUriHandler(oauthManager)
            );

            context.subscriptions.push(vscode.commands.registerCommand('larksync.login', async () => {
                const success = await oauthManager.login();
                if (success) {
                    const userToken = await oauthManager.getValidUserToken();
                    if (userToken) {
                        feishuClient.setUserAccessToken(userToken);
                    }
                }
            }));

            context.subscriptions.push(vscode.commands.registerCommand('larksync.logout', async () => {
                await oauthManager.logout();
                feishuClient.setUserAccessToken('');
            }));
        } catch (authErr: any) {
            logger.error(`OAuth 初始化失败（不影响核心同步）: ${authErr.message}`, authErr);
        }

        // Setup Polling
        setupPolling();

        // Re-setup polling if configuration changes
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('larksync.pollingIntervalMinutes')) {
                setupPolling();
            }
        }));

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
            if (!syncEngine.syncActive) {
                console.log('LarkSync: Background polling triggered.');
                statusBarItem.text = '$(sync~spin) LarkSync Polling';
                await syncEngine.startSync(true, false); // silent = true, forceFullTree = false
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
