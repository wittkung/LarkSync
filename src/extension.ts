import * as vscode from 'vscode';
import { SyncEngine } from './syncEngine';
import { logger } from './logger';
import { SyncTreeProvider } from './treeProvider';

let syncEngine: SyncEngine;
let statusBarItem: vscode.StatusBarItem;
let pollingTimer: NodeJS.Timeout | null = null;
let treeProvider: SyncTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    logger.info('LarkSync extension is now active!');

    syncEngine = new SyncEngine();

    // Register Sidebar
    treeProvider = new SyncTreeProvider(syncEngine);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('larksyncSidebar', treeProvider)
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
