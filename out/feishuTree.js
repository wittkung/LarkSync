"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWikiNodes = fetchWikiNodes;
exports.fetchAllWikiNodesRecursive = fetchAllWikiNodesRecursive;
const axios_1 = __importDefault(require("axios"));
const feishuApi_1 = require("./feishuApi");
const logger_1 = require("./logger");
async function fetchWikiNodes(spaceId, parentNodeToken) {
    const token = await (0, feishuApi_1.getTenantAccessToken)();
    let nodes = [];
    let pageToken = '';
    let hasMore = true;
    let pageCount = 1;
    logger_1.logger.info(`Fetching Wiki Node list for Space: ${spaceId} ${parentNodeToken ? `(Parent: ${parentNodeToken})` : '(Root)'} - Page ${pageCount}...`);
    while (hasMore) {
        const params = { page_size: 50 };
        if (pageToken)
            params.page_token = pageToken;
        if (parentNodeToken)
            params.parent_node_token = parentNodeToken;
        const response = await axios_1.default.get(`https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`, {
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
            logger_1.logger.info(`  => Received ${data.items.length} nodes from Page ${pageCount}.`);
        }
        hasMore = data.has_more;
        pageToken = data.page_token;
        if (hasMore) {
            pageCount++;
            logger_1.logger.info(`Fetching Wiki Node list - Page ${pageCount}...`);
        }
    }
    return nodes;
}
async function fetchAllWikiNodesRecursive(spaceId, parentNodeToken) {
    let allNodes = [];
    // Fetch current level nodes
    const children = await fetchWikiNodes(spaceId, parentNodeToken);
    allNodes = allNodes.concat(children);
    // Recursively fetch children if node is a folder or contains children
    for (const child of children) {
        if (child.has_child) {
            logger_1.logger.info(`[Recursion] Diving into branch node: [${child.title}]...`);
            const subNodes = await fetchAllWikiNodesRecursive(spaceId, child.node_token);
            allNodes = allNodes.concat(subNodes);
        }
    }
    return allNodes;
}
//# sourceMappingURL=feishuTree.js.map