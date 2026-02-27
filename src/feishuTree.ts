import axios from 'axios';
import { getTenantAccessToken } from './feishuApi';
import { logger } from './logger';

export interface WikiNode {
    space_id: string;
    node_token: string;
    obj_token: string;
    obj_type: 'doc' | 'docx' | 'sheet' | 'mindnote' | 'bitable' | 'file' | 'folder';
    parent_node_token: string;
    title: string;
    has_child: boolean;
}

export async function fetchWikiNodes(spaceId: string, parentNodeToken?: string): Promise<WikiNode[]> {
    const token = await getTenantAccessToken();
    let nodes: WikiNode[] = [];
    let pageToken = '';
    let hasMore = true;
    let pageCount = 1;

    logger.info(`Fetching Wiki Node list for Space: ${spaceId} ${parentNodeToken ? `(Parent: ${parentNodeToken})` : '(Root)'} - Page ${pageCount}...`);

    while (hasMore) {
        const params: any = { page_size: 50 };
        if (pageToken) params.page_token = pageToken;
        if (parentNodeToken) params.parent_node_token = parentNodeToken;

        const response = await axios.get(`https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`, {
            params,
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response.data.code !== 0) {
            throw new Error(`Failed to fetch wiki nodes: ${response.data.msg}`);
        }

        const data = response.data.data;
        if (data.items) {
            nodes = nodes.concat(data.items);
            logger.info(`  => Received ${data.items.length} nodes from Page ${pageCount}.`);
        }

        hasMore = data.has_more;
        pageToken = data.page_token;

        if (hasMore) {
            pageCount++;
            logger.info(`Fetching Wiki Node list - Page ${pageCount}...`);
        }
    }

    return nodes;
}

export async function fetchAllWikiNodesRecursive(spaceId: string, parentNodeToken?: string): Promise<WikiNode[]> {
    let allNodes: WikiNode[] = [];

    // Fetch current level nodes
    const children = await fetchWikiNodes(spaceId, parentNodeToken);
    allNodes = allNodes.concat(children);

    // Recursively fetch children if node is a folder or contains children
    for (const child of children) {
        if (child.has_child) {
            logger.info(`[Recursion] Diving into branch node: [${child.title}]...`);
            const subNodes = await fetchAllWikiNodesRecursive(spaceId, child.node_token);
            allNodes = allNodes.concat(subNodes);
        }
    }

    return allNodes;
}
