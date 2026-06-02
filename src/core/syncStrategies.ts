import { FeishuClient } from '../api/feishuClient';
import { WikiNode } from '../types';
import { TreeDiffEngine } from './treeDiffEngine';
import { SyncProgressReporter } from './syncProgressReporter';
import { logger } from '../logger';

export interface ITreeSyncStrategy {
    fetchNodes(
        spaceId: string,
        cachedNodes: WikiNode[],
        reporter: SyncProgressReporter
    ): Promise<{ nodes: WikiNode[]; isComplete: boolean }>;
}

export class FullSyncStrategy implements ITreeSyncStrategy {
    constructor(private feishuClient: FeishuClient) {}

    async fetchNodes(
        spaceId: string,
        cachedNodes: WikiNode[],
        reporter: SyncProgressReporter
    ): Promise<{ nodes: WikiNode[]; isComplete: boolean }> {
        logger.info('强制全量拉取目录树...');
        reporter.report('正在从飞书拉取完整目录树...');
        const nodes = await this.feishuClient.fetchAllWikiNodesRecursive(spaceId);
        return { nodes, isComplete: true };
    }
}

export class IncrementalSyncStrategy implements ITreeSyncStrategy {
    constructor(private feishuClient: FeishuClient) {}

    async fetchNodes(
        spaceId: string,
        cachedNodes: WikiNode[],
        reporter: SyncProgressReporter
    ): Promise<{ nodes: WikiNode[]; isComplete: boolean }> {
        if (cachedNodes.length === 0) {
            logger.info('首次同步，全量拉取目录树...');
            reporter.report('首次同步，正在拉取完整目录树...');
            const nodes = await this.feishuClient.fetchAllWikiNodesRecursive(spaceId);
            return { nodes, isComplete: true };
        }

        logger.info('执行增量目录树同步...');
        reporter.report('正在检测知识库变更...');

        const diffEngine = new TreeDiffEngine(this.feishuClient, spaceId);
        const diffResult = await diffEngine.diffAndMerge(cachedNodes);

        const summary: string[] = [];
        if (diffResult.addedNodes.length > 0)
            summary.push(`新增 ${diffResult.addedNodes.length} 个节点`);
        if (diffResult.deletedNodeTokens.length > 0)
            summary.push(`删除 ${diffResult.deletedNodeTokens.length} 个节点`);
        if (diffResult.contentChangedNodes.length > 0)
            summary.push(`${diffResult.contentChangedNodes.length} 篇文档有更新`);

        if (summary.length > 0) {
            const msg = `增量检测: ${summary.join(', ')} (${diffResult.apiCallCount} 次API调用)`;
            logger.info(msg);
            reporter.report(msg);
        } else {
            logger.info(`增量检测: 知识库无变更 (${diffResult.apiCallCount} 次API调用)`);
            reporter.report('知识库无变更');
        }

        return { nodes: diffResult.mergedNodes, isComplete: diffResult.isTreeComplete };
    }
}
