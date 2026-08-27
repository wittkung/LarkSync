/**
 * Wrapper for the VS Code webview API
 */

interface VSCodeAPI<T = unknown> {
    postMessage(message: unknown): void;
    getState(): T | undefined;
    setState(state: T): void;
}

declare const acquireVsCodeApi: <T = unknown>() => VSCodeAPI<T>;

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
    public postMessage(message: unknown) {
        if (this.vsCodeApi) {
            this.vsCodeApi.postMessage(message);
        } else {
            console.log('Would post message to VS Code:', message);
        }
    }

    /**
     * Get the state representing the webview's current state
     */
    public getState<T = unknown>(): T | undefined {
        if (this.vsCodeApi) {
            return this.vsCodeApi.getState() as T;
        } else {
            const state = localStorage.getItem('vscodeState');
            return state ? (JSON.parse(state) as T) : undefined;
        }
    }

    /**
     * Set the state representing the webview's current state
     */
    public setState<T = unknown>(state: T) {
        if (this.vsCodeApi) {
            this.vsCodeApi.setState(state);
        } else {
            localStorage.setItem('vscodeState', JSON.stringify(state));
        }
    }
}

export const vscode = new VSCodeWrapper();
