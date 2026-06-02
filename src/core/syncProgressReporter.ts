import * as vscode from 'vscode';
import { logger } from '../logger';

export class SyncProgressReporter {
    private currentPercent = 0;
    private rawProgress?: vscode.Progress<{ message?: string; increment?: number }>;

    constructor(
        private _onProgress: vscode.EventEmitter<{
            type: 'start' | 'progress' | 'complete' | 'error';
            message: string;
            percent?: number;
        }>
    ) {}

    public setRawProgress(progress: vscode.Progress<{ message?: string; increment?: number }>) {
        this.rawProgress = progress;
        this.currentPercent = 0;
    }

    public report(
        message?: string,
        increment?: number,
        type: 'start' | 'progress' | 'complete' | 'error' = 'progress'
    ) {
        if (this.rawProgress) {
            this.rawProgress.report({ message, increment });
        }

        if (increment) {
            this.currentPercent += increment;
        }
        const pct = Math.min(Math.round(this.currentPercent), 100);

        this._onProgress.fire({ type, message: message || '', percent: pct });

        if (message) {
            logger.debug(`[Progress] ${message}`);
        }
    }
}
