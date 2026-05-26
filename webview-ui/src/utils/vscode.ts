/**
 * Wrapper for the VS Code webview API
 */

interface VSCodeAPI {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
}

declare const acquireVsCodeApi: () => VSCodeAPI;

class VSCodeWrapper {
    private readonly vsCodeApi: VSCodeAPI | undefined;

    constructor() {
        if (typeof acquireVsCodeApi === 'function') {
            this.vsCodeApi = acquireVsCodeApi();
        }
    }

    /**
     * Post a message to the extension
     */
    public postMessage(message: any) {
        if (this.vsCodeApi) {
            this.vsCodeApi.postMessage(message);
        } else {
            console.log('Would post message to VS Code:', message);
        }
    }

    /**
     * Get the state representing the webview's current state
     */
    public getState(): any {
        if (this.vsCodeApi) {
            return this.vsCodeApi.getState();
        } else {
            const state = localStorage.getItem('vscodeState');
            return state ? JSON.parse(state) : undefined;
        }
    }

    /**
     * Set the state representing the webview's current state
     */
    public setState(state: any) {
        if (this.vsCodeApi) {
            this.vsCodeApi.setState(state);
        } else {
            localStorage.setItem('vscodeState', JSON.stringify(state));
        }
    }
}

export const vscode = new VSCodeWrapper();
