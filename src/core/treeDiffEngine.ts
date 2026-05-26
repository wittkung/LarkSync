/**
 * treeDiffEngine.ts
 * 增量目录树同步引擎 — 逐层浅比对 + 定向递归刷新
 *
 * 核心思路：
 * 1. 从根层开始，调用飞书 API 拉取当前层级的节点列表
 * 2. 与本地缓存的同层节点做 Diff（按 node_token）
 * 3. 新增的节点 → 全量递归拉取其子树
 * 4. 已有但 has_child 状态变化的节点 → 递归 diff 下一层
 * 5. 缓存中有但远端没有的 → 标记删除
 * 6. 最终将变更 merge 进缓存，返回完整的 WikiNode[]
 */

import { FeishuClient } from '../api/feishuClient';
import { WikiNode } from '../types';
import { CONSTANTS } from '../utils/constants';
import { logger } from '../logger';

/** 增量 Diff 结果 */
export interface TreeDiffResult {
    /** 合并后的完整节点列表 */
    mergedNodes: WikiNode[];
    /** 本次发现的新增节点 */
    addedNodes: WikiNode[];
    /** 本次发现的删除节点 token 列表 */
    deletedNodeTokens: string[];
    /** 内容有更新的文档节点（obj_edit_time 变化） */
    contentChangedNodes: WikiNode[];
    /** 树是否完整（可安全用于孤儿清理） */
    isTreeComplete: boolean;
    /** 本次 API 调用次数 */
    apiCallCount: number;
}

export class TreeDiffEngine {
    private apiCallCount = 0;
    private levelsScanned = 0;

    constructor(
        private feishuClient: FeishuClient,
        private spaceId: string
    ) {}

    /**
     * 执行增量目录树同步
     * @param cachedNodes 本地缓存的旧节点列表
     * @returns 差异结果 + 合并后的完整树
     */
    public async diffAndMerge(cachedNodes: WikiNode[]): Promise<TreeDiffResult> {
        this.apiCallCount = 0;
        this.levelsScanned = 0;

        // 1. 建立缓存索引
        const cachedByToken = new Map<string, WikiNode>();
        const cachedByParent = new Map<string, WikiNode[]>();

        for (const node of cachedNodes) {
            cachedByToken.set(node.node_token, node);
            // 根层节点的 parent_node_token 为空字符串或 undefined
            const parentKey = node.parent_node_token || '__root__';
            if (!cachedByParent.has(parentKey)) {
                cachedByParent.set(parentKey, []);
            }
            cachedByParent.get(parentKey)!.push(node);
        }

        const added: WikiNode[] = [];
        const deleted: string[] = [];
        const contentChanged: WikiNode[] = [];

        // 2. 从根层开始逐层 diff
        try {
            await this.diffLevel(
                undefined, // 根层
                cachedByParent,
                cachedByToken,
                added,
                deleted,
                contentChanged
            );
        } catch (err: any) {
            logger.error(`增量 Diff 出错: ${err.message}`);
            // 出错时不更新树，返回原缓存 + 标记树不完整
            return {
                mergedNodes: cachedNodes,
                addedNodes: [],
                deletedNodeTokens: [],
                contentChangedNodes: [],
                isTreeComplete: false,
                apiCallCount: this.apiCallCount
            };
        }

        // 3. 构建合并后的完整树
        const mergedNodes = this.buildMergedTree(
            cachedNodes,
            cachedByToken,
            added,
            deleted
        );

        logger.info(
            `增量 Diff 完成: +${added.length} / -${deleted.length} / ~${contentChanged.length} ` +
            `(${this.apiCallCount} 次 API 调用, 合并后 ${mergedNodes.length} 个节点)`
        );

        return {
            mergedNodes,
            addedNodes: added,
            deletedNodeTokens: deleted,
            contentChangedNodes: contentChanged,
            isTreeComplete: true,
            apiCallCount: this.apiCallCount
        };
    }

    /**
     * 对某一层级做 Diff
     * @param parentNodeToken 父节点 token（undefined 表示根层）
     */
    private async diffLevel(
        parentNodeToken: string | undefined,
        cachedByParent: Map<string, WikiNode[]>,
        cachedByToken: Map<string, WikiNode>,
        added: WikiNode[],
        deleted: string[],
        contentChanged: WikiNode[]
    ): Promise<void> {
        // 拉取此层级的全部节点（处理分页）
        const parentLabel = parentNodeToken ? parentNodeToken.substring(0, 8) + '...' : 'root';
        this.levelsScanned++;
        if (this.levelsScanned % 5 === 0 || !parentNodeToken) {
            logger.info(`[增量] 扫描层级 #${this.levelsScanned} (${parentLabel})...`);
        }
        const freshNodes = await this.fetchAllNodesForParent(parentNodeToken);

        const parentKey = parentNodeToken || '__root__';
        const cachedChildren = cachedByParent.get(parentKey) || [];
        const freshTokenSet = new Set(freshNodes.map(n => n.node_token));

        // 遍历远端最新节点
        for (const freshNode of freshNodes) {
            const cachedNode = cachedByToken.get(freshNode.node_token);

            if (!cachedNode) {
                // ===== 新增节点 =====
                logger.info(`[增量] 发现新节点: [${freshNode.title}] (${freshNode.node_token})`);
                added.push(freshNode);

                // 新节点如果有子节点，全量递归拉取整个子树
                if (freshNode.has_child) {
                    logger.info(`[增量] 递归拉取新分支: [${freshNode.title}]`);
                    const subTree = await this.feishuClient.fetchAllWikiNodesRecursive(
                        this.spaceId,
                        freshNode.node_token
                    );
                    this.apiCallCount++; // fetchAllWikiNodesRecursive 内部有多次调用，粗略计为一组
                    added.push(...subTree);
                }
            } else {
                // ===== 已存在的节点 =====

                // 检查文档内容是否有更新
                if (
                    freshNode.obj_edit_time &&
                    cachedNode.obj_edit_time &&
                    freshNode.obj_edit_time !== cachedNode.obj_edit_time
                ) {
                    logger.info(
                        `[增量] 文档有更新: [${freshNode.title}] ` +
                        `(${cachedNode.obj_edit_time} → ${freshNode.obj_edit_time})`
                    );
                    contentChanged.push(freshNode);
                } else if (freshNode.obj_edit_time && !cachedNode.obj_edit_time) {
                    // 旧缓存没有 obj_edit_time 字段（首次增量升级），视为可能变更
                    contentChanged.push(freshNode);
                }

                // 检查标题是否变更（需要更新缓存中的元数据）
                if (freshNode.title !== cachedNode.title) {
                    logger.info(
                        `[增量] 标题变更: [${cachedNode.title}] → [${freshNode.title}]`
                    );
                }

                // 更新缓存中该节点的最新元数据（title / obj_edit_time / has_child 等）
                cachedByToken.set(freshNode.node_token, freshNode);

                // 检查子节点状态
                if (freshNode.has_child) {
                    if (!cachedNode.has_child) {
                        // 之前无子节点，现在有了 → 全量拉取子树
                        logger.info(`[增量] 节点新增子级: [${freshNode.title}]`);
                        const subTree = await this.feishuClient.fetchAllWikiNodesRecursive(
                            this.spaceId,
                            freshNode.node_token
                        );
                        this.apiCallCount++;
                        added.push(...subTree);
                    } else {
                        // 之前也有子节点 → 递归 Diff 下一层
                        await this.diffLevel(
                            freshNode.node_token,
                            cachedByParent,
                            cachedByToken,
                            added,
                            deleted,
                            contentChanged
                        );
                    }
                }
                // 如果 freshNode.has_child 为 false 且 cachedNode.has_child 为 true：
                // 说明子节点全被删了，下面的删除检测逻辑会处理
            }
        }

        // ===== 检测删除 =====
        // 缓存中该层有、但远端该层没有的节点
        for (const cachedChild of cachedChildren) {
            if (!freshTokenSet.has(cachedChild.node_token)) {
                logger.info(`[增量] 节点已删除: [${cachedChild.title}] (${cachedChild.node_token})`);
                deleted.push(cachedChild.node_token);
                // 级联标记其所有子孙为删除
                this.collectDescendantTokens(cachedChild.node_token, cachedByParent, deleted);
            }
        }
    }

    /**
     * 拉取某个父节点下的所有子节点（处理分页）
     */
    private async fetchAllNodesForParent(parentNodeToken?: string): Promise<WikiNode[]> {
        const allNodes: WikiNode[] = [];
        let pageToken = '';
        let hasMore = true;
        let pageCount = 0;

        while (hasMore) {
            pageCount++;
            if (pageCount > CONSTANTS.MAX_PAGES_PER_LEVEL) {
                logger.warn(
                    `[增量] 分页数超过安全阀 ${CONSTANTS.MAX_PAGES_PER_LEVEL}，停止拉取 ` +
                    `(parent: ${parentNodeToken || 'root'})`
                );
                break;
            }

            const data = await this.feishuClient.fetchWikiNodes(
                this.spaceId,
                pageToken || undefined,
                parentNodeToken
            );
            this.apiCallCount++;

            if (data.items) {
                allNodes.push(...data.items);
            }
            hasMore = data.has_more;
            pageToken = data.page_token;
        }

        return allNodes;
    }

    /**
     * 递归收集某个节点的所有子孙 token（用于级联删除）
     */
    private collectDescendantTokens(
        nodeToken: string,
        cachedByParent: Map<string, WikiNode[]>,
        result: string[]
    ): void {
        const children = cachedByParent.get(nodeToken) || [];
        for (const child of children) {
            result.push(child.node_token);
            this.collectDescendantTokens(child.node_token, cachedByParent, result);
        }
    }

    /**
     * 将增量变更合并进缓存，构建完整的节点列表
     */
    private buildMergedTree(
        originalCachedNodes: WikiNode[],
        updatedByToken: Map<string, WikiNode>,
        addedNodes: WikiNode[],
        deletedTokens: string[]
    ): WikiNode[] {
        const deletedSet = new Set(deletedTokens);

        // 1. 从原始缓存中过滤掉已删除的，同时用 updatedByToken 中的最新元数据替换
        const surviving = originalCachedNodes
            .filter(n => !deletedSet.has(n.node_token))
            .map(n => updatedByToken.get(n.node_token) || n);

        // 2. 去重（避免 added 中与 surviving 重复）
        const existingTokens = new Set(surviving.map(n => n.node_token));
        const uniqueAdded = addedNodes.filter(n => !existingTokens.has(n.node_token));

        // 3. 合并
        return [...surviving, ...uniqueAdded];
    }
}
