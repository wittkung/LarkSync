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
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const syncEngine_1 = require("./syncEngine");
const syncScheduler_1 = require("./core/syncScheduler");
const logger_1 = require("./logger");
const treeProvider_1 = require("./treeProvider");
const syncFileDecorationProvider_1 = require("./ui/syncFileDecorationProvider");
const tokenStore_1 = require("./auth/tokenStore");
const oauthManager_1 = require("./auth/oauthManager");
const feishuClient_1 = require("./api/feishuClient");
const dashboardPanel_1 = require("./ui/dashboardPanel");
const constants_1 = require("./utils/constants");
let feishuClient;
let syncEngine;
let syncScheduler;
let statusBarItem;
let pollingTimer = null;
let treeProvider;
let decorationProvider;
function activate(context) {
    try {
        logger_1.logger.info('LarkSync extension is now active!');
        feishuClient = new feishuClient_1.FeishuClient();
        syncEngine = new syncEngine_1.SyncEngine(feishuClient);
        syncScheduler = new syncScheduler_1.SyncScheduler(syncEngine);
        // 注册侧边栏知识树
        treeProvider = new treeProvider_1.SyncTreeProvider(syncEngine);
        context.subscriptions.push(vscode.window.registerTreeDataProvider('larksyncSidebar', treeProvider));
        // 注册文件装饰器（A/M/D 差异状态徽标）
        decorationProvider = new syncFileDecorationProvider_1.SyncFileDecorationProvider();
        context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorationProvider));
        // Create Status Bar Item
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.command = 'larksync.startSync';
        statusBarItem.text = '$(sync) LarkSync';
        statusBarItem.tooltip = 'Click to force sync Feishu Docs';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);
        // Register Fast Sync Command
        context.subscriptions.push(vscode.commands.registerCommand('larksync.startSync', async () => {
            statusBarItem.text = '$(sync~spin) LarkSync Syncing';
            await syncScheduler.requestSync(false, false);
            statusBarItem.text = '$(sync) LarkSync';
        }));
        // Register Force Full Sync Command
        context.subscriptions.push(vscode.commands.registerCommand('larksync.forceSyncTree', async () => {
            statusBarItem.text = '$(sync~spin) LarkSync Fetching Tree...';
            await syncScheduler.requestSync(false, true);
            statusBarItem.text = '$(sync) LarkSync';
        }));
        // Register Open Sync Folder Command
        context.subscriptions.push(vscode.commands.registerCommand('larksync.openSyncFolder', () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const config = vscode.workspace.getConfiguration('larksync');
                const syncDirName = config.get('syncDir', constants_1.CONSTANTS.DEFAULT_SYNC_DIR);
                const targetUri = vscode.Uri.joinPath(workspaceFolders[0].uri, syncDirName);
                vscode.commands.executeCommand('revealFileInOS', targetUri);
            }
            else {
                vscode.window.showErrorMessage('LarkSync: 没有打开的工作区。');
            }
        }));
        context.subscriptions.push(vscode.commands.registerCommand('larksync.refreshSidebar', () => {
            if (treeProvider) {
                treeProvider.refresh();
            }
        }));
        context.subscriptions.push(vscode.commands.registerCommand('larksync.openDashboard', () => {
            dashboardPanel_1.DashboardPanel.createOrShow(context.extensionUri, syncEngine, feishuClient);
        }));
        // 注册 OAuth 登录/登出（独立 try-catch，不影响核心功能）
        try {
            const tokenStore = new tokenStore_1.TokenStore(context.secrets);
            const oauthManager = new oauthManager_1.OAuthManager(tokenStore);
            context.subscriptions.push(vscode.window.registerUriHandler(oauthManager));
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
        }
        catch (authErr) {
            logger_1.logger.error(`OAuth 初始化失败（不影响核心同步）: ${authErr.message}`, authErr);
        }
        // Setup Polling
        setupPolling();
        // Re-setup polling if configuration changes
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('larksync.pollingIntervalMinutes')) {
                setupPolling();
            }
        }));
        logger_1.logger.info('LarkSync 所有组件注册完毕。');
    }
    catch (err) {
        const msg = `LarkSync 激活失败: ${err.message}`;
        console.error(msg, err);
        logger_1.logger.error(msg, err);
        vscode.window.showErrorMessage(msg);
    }
}
function setupPolling() {
    if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
    }
    const config = vscode.workspace.getConfiguration('larksync');
    const intervalMinutes = config.get('pollingIntervalMinutes') || 0;
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
function deactivate() {
    if (pollingTimer) {
        clearInterval(pollingTimer);
    }
}
//# sourceMappingURL=extension.js.map