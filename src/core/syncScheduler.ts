import { SyncEngine } from '../syncEngine';
import { logger } from '../logger';
import * as vscode from 'vscode';

export class SyncScheduler {
    private syncPromise: Promise<void> | null = null;
    private nextSyncScheduled: { silent: boolean; forceFullTree: boolean } | null = null;

    constructor(private syncEngine: SyncEngine) {}

    public get isSyncing(): boolean {
        return this.syncPromise !== null;
    }

    public async requestSync(
        silent: boolean = false,
        forceFullTree: boolean = false
    ): Promise<void> {
        if (this.syncPromise) {
            logger.info('同步已在进行中，排队处理...');
            if (!silent) {
                vscode.window.showInformationMessage('LarkSync: 同步正在进行中，已为您排队。');
            }
            if (this.nextSyncScheduled) {
                this.nextSyncScheduled.forceFullTree =
                    this.nextSyncScheduled.forceFullTree || forceFullTree;
                this.nextSyncScheduled.silent = this.nextSyncScheduled.silent && silent;
            } else {
                this.nextSyncScheduled = { silent, forceFullTree };
            }
            return;
        }

        return this.runSync(silent, forceFullTree);
    }

    private async runSync(silent: boolean, forceFullTree: boolean) {
        this.syncPromise = this.syncEngine.startSync(silent, forceFullTree);
        try {
            await this.syncPromise;
        } finally {
            this.syncPromise = null;
            if (this.nextSyncScheduled) {
                const next = this.nextSyncScheduled;
                this.nextSyncScheduled = null;
                setTimeout(() => {
                    this.runSync(next.silent, next.forceFullTree);
                }, 1000);
            }
        }
    }
}
