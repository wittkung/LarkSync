import * as vscode from 'vscode';
import { FeishuClient, feishuClient } from '../api/feishuClient';
import { StateManager } from '../core/stateManager';
import { SyncEngine } from '../syncEngine';

export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    // Dependencies
    private syncEngine: SyncEngine;

    private constructor(
        panel: vscode.WebviewPanel, 
        extensionUri: vscode.Uri,
        syncEngine: SyncEngine
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.syncEngine = syncEngine;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            message => this._handleMessage(message),
            null,
            this._disposables
        );

        // Listen for sync progress updates from engine to broadcast to UI
        const progressDisposable = this.syncEngine.onProgress((status) => {
            if (this._panel && this._panel.webview) {
                this._panel.webview.postMessage({ command: 'syncProgress', payload: status });
            }
        });
        this._disposables.push(progressDisposable);
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        syncEngine: SyncEngine
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'larksyncDashboard',
            'LarkSync Dashboard',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'webview-ui', 'build')
                ],
                retainContextWhenHidden: true // Keep React state alive
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, syncEngine);
    }

    private async _handleMessage(message: any) {
        // We standardized on { command: string, payload: any }
        const command = message.command || message.type; // Fallback to type just in case
        const payload = message.payload || message.data; // Fallback to data just in case

        switch (command) {
            case 'ping':
                this._panel.webview.postMessage({ command: 'pong', payload: 'Hello from VS Code' });
                return;
            case 'getHealth':
                this.sendHealthData();
                return;
            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', '@ext:kevintung.larksync');
                return;
            case 'openFolder':
                vscode.commands.executeCommand('larksync.openSyncFolder');
                return;
            case 'importCacheFiles':
                vscode.commands.executeCommand('larksync.importCacheFiles');
                return;
            case 'startSync':
                vscode.commands.executeCommand('larksync.startSync');
                return;
            case 'login':
                vscode.commands.executeCommand('larksync.login');
                // Poll for login success to update health
                const pollTimer = setInterval(() => {
                    if (feishuClient.isLoggedIn()) {
                        clearInterval(pollTimer);
                        this.sendHealthData();
                    }
                }, 1000);
                setTimeout(() => clearInterval(pollTimer), 60000); // 1 min timeout
                return;
            case 'saveConfig':
                if (payload && payload.key && typeof payload.value === 'string') {
                    vscode.workspace.getConfiguration().update(payload.key, payload.value, vscode.ConfigurationTarget.Workspace);
                }
                return;
        }
    }

    public sendHealthData() {
        const config = vscode.workspace.getConfiguration('larksync');
        const hasAppId = !!config.get('appId');
        const hasAppSecret = !!config.get('appSecret');
        const spaceId = config.get('spaceId');
        const syncDir = config.get('syncDirectory');
        
        // Use a lightweight check instead of full API call
        const tokenStatus = feishuClient.isLoggedIn();
        
        let lastSync = null;
        try {
            if (this.syncEngine && (this.syncEngine as any).stateManager) {
                const state = (this.syncEngine as any).stateManager.state;
                if (state) {
                    const times = Object.values<{lastSyncTime?: number}>(state).map(e => e.lastSyncTime || 0);
                    if (times.length > 0) {
                        lastSync = Math.max(...times);
                    }
                }
            }
        } catch (e) {}

        this._panel.webview.postMessage({ 
            command: 'healthData', 
            payload: { hasAppId, hasAppSecret, tokenValid: tokenStatus, spaceId, syncDir, lastSync }
        });
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Points to the output of `npm run build` in webview-ui
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'build', 'assets', 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'build', 'assets', 'index.css'));

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <!--
                    Use a content security policy to only allow loading images from https or from our extension directory,
                    and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; connect-src https:;">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>LarkSync Dashboard</title>
            </head>
            <body>
                <div id="root"></div>
                <!-- React App Entry -->
                <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    public dispose() {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
