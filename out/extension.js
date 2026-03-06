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
const logger_1 = require("./logger");
const treeProvider_1 = require("./treeProvider");
const syncFileDecorationProvider_1 = require("./ui/syncFileDecorationProvider");
let syncEngine;
let statusBarItem;
let pollingTimer = null;
let treeProvider;
let decorationProvider;
function activate(context) {
    logger_1.logger.info('LarkSync extension is now active!');
    syncEngine = new syncEngine_1.SyncEngine();
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
    // Setup Polling
    setupPolling();
    // Re-setup polling if configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('larksync.pollingIntervalMinutes')) {
            setupPolling();
        }
    }));
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
            if (!syncEngine.syncActive) {
                console.log('LarkSync: Background polling triggered.');
                statusBarItem.text = '$(sync~spin) LarkSync Polling';
                await syncEngine.startSync(true, false); // silent = true, forceFullTree = false
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