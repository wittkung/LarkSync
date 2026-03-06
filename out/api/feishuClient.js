"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.feishuClient = exports.FeishuClient = void 0;
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
const constants_1 = require("../utils/constants");
const errors_1 = require("../utils/errors");
const logger_1 = require("../logger");
class FeishuClient {
    constructor() {
        this.tenantAccessToken = '';
        this.tokenExpirationTime = 0;
        this.client = axios_1.default.create({
            baseURL: constants_1.CONSTANTS.FEISHU_API_BASE,
            timeout: 30000,
        });
        // Response Interceptor for Error Handling
        this.client.interceptors.response.use((response) => {
            if (response.data && response.data.code !== undefined && response.data.code !== 0) {
                if (response.data.code === 99991400) {
                    return Promise.reject(new errors_1.RateLimitError(response.data.msg, response.data.code));
                }
                return Promise.reject(new errors_1.FeishuApiError(response.data.msg, response.data.code, response.data));
            }
            return response;
        }, (error) => {
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                if (status === 429 || (status === 400 && data?.code === 99991400)) {
                    return Promise.reject(new errors_1.RateLimitError(data?.msg || 'Rate Limit Exceeded', data?.code || 429));
                }
                return Promise.reject(new errors_1.FeishuApiError(data?.msg || error.message, data?.code || status, data));
            }
            return Promise.reject(new errors_1.FeishuApiError(`Network error: ${error.message}`));
        });
    }
    /**
     * Retrieves a valid tenant access token, refreshing if necessary.
     */
    async getTenantAccessToken() {
        const now = Date.now();
        if (this.tenantAccessToken && now < this.tokenExpirationTime) {
            return this.tenantAccessToken;
        }
        const config = vscode.workspace.getConfiguration('larksync');
        const appId = config.get('appId');
        const appSecret = config.get('appSecret');
        if (!appId || !appSecret) {
            throw new errors_1.FeishuAuthError('App ID or App Secret is not configured. Please set them in VS Code settings.');
        }
        try {
            logger_1.logger.info('Refreshing Feishu Tenant Access Token...');
            const response = await axios_1.default.post(constants_1.CONSTANTS.FEISHU_AUTH_URL, { app_id: appId, app_secret: appSecret });
            if (response.data.code === 0) {
                this.tenantAccessToken = response.data.tenant_access_token;
                // Refresh slightly before exact expiry to prevent race conditions
                this.tokenExpirationTime = now + (response.data.expire - constants_1.CONSTANTS.TOKEN_REFRESH_MARGIN_SEC) * 1000;
                return this.tenantAccessToken;
            }
            else {
                throw new errors_1.FeishuAuthError(response.data.msg);
            }
        }
        catch (error) {
            throw new errors_1.FeishuAuthError(error.message);
        }
    }
    /**
     * Standard Request wrapper with automatic token injection and retries.
     */
    async request(config, retries = constants_1.CONSTANTS.MAX_API_RETRIES) {
        let lastError;
        for (let i = 0; i <= retries; i++) {
            try {
                const token = await this.getTenantAccessToken();
                const headers = { ...config.headers, Authorization: `Bearer ${token}` };
                const response = await this.client.request({
                    ...config,
                    headers
                });
                return response.data.data;
            }
            catch (error) {
                lastError = error;
                if (error instanceof errors_1.RateLimitError && i < retries) {
                    const backoff = constants_1.CONSTANTS.RETRY_BASE_DELAY_MS * Math.pow(1.5, i) + Math.random() * 500;
                    logger_1.logger.warn(`Rate limit hit [${config.url}]. Retrying in ${Math.round(backoff)}ms...`);
                    await new Promise(res => setTimeout(res, backoff));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }
    /**
     * Fetches child nodes of a given parent node or space.
     */
    async fetchWikiNodes(spaceId, pageToken, parentNodeToken) {
        const params = { page_size: 50 };
        if (pageToken)
            params.page_token = pageToken;
        if (parentNodeToken)
            params.parent_node_token = parentNodeToken;
        return this.request({
            url: `/wiki/v2/spaces/${spaceId}/nodes`,
            method: 'GET',
            params
        });
    }
    /**
     * Recursively fetches the entire wiki tree.
     */
    async fetchAllWikiNodesRecursive(spaceId, parentNodeToken) {
        let allNodes = [];
        let pageToken = '';
        let hasMore = true;
        let pageCount = 1;
        logger_1.logger.info(`Fetching Wiki Node list for Space: ${spaceId} ${parentNodeToken ? `(Parent: ${parentNodeToken})` : '(Root)'} - Page ${pageCount}...`);
        while (hasMore) {
            const data = await this.fetchWikiNodes(spaceId, pageToken, parentNodeToken);
            if (data.items) {
                allNodes = allNodes.concat(data.items);
                logger_1.logger.info(`  => Received ${data.items.length} nodes from Page ${pageCount}.`);
            }
            hasMore = data.has_more;
            pageToken = data.page_token;
            if (hasMore)
                pageCount++;
        }
        // Recursively fetch children
        const finalNodes = [...allNodes];
        for (const child of allNodes) {
            if (child.has_child) {
                logger_1.logger.info(`[Recursion] Diving into branch node: [${child.title}]...`);
                const subNodes = await this.fetchAllWikiNodesRecursive(spaceId, child.node_token);
                finalNodes.push(...subNodes);
            }
        }
        return finalNodes;
    }
    /**
     * Gets document metadata for multiple files to check their modify times.
     */
    async fetchDocsMetadata(docs) {
        const metaMap = new Map();
        if (docs.length === 0)
            return metaMap;
        const chunkSize = constants_1.CONSTANTS.MAX_META_BATCH_SIZE;
        for (let i = 0; i < docs.length; i += chunkSize) {
            const chunk = docs.slice(i, i + chunkSize);
            const validDocs = chunk.filter(t => t.token && t.type);
            if (validDocs.length === 0)
                continue;
            const requestDocsPayload = validDocs.map(t => ({
                doc_token: t.token,
                doc_type: t.type === 'docx' ? 'docx' : 'doc'
            }));
            // Log exactly what we are about to send to Feishu
            const logDocsPayload = validDocs.map(t => ({
                title: t.title || 'Unknown',
                doc_token: t.token,
                doc_type: t.type === 'docx' ? 'docx' : 'doc'
            }));
            logger_1.logger.info(`Sending batch_query payload to Feishu: ${JSON.stringify({ request_docs: logDocsPayload })}`);
            const data = await this.request({
                url: '/drive/v1/metas/batch_query',
                method: 'POST',
                data: { request_docs: requestDocsPayload }
            });
            if (data && data.metas) {
                data.metas.forEach((meta) => {
                    const d_token = meta.doc_token || meta.docs_token || meta.token;
                    if (d_token) {
                        metaMap.set(d_token, meta);
                    }
                });
            }
        }
        return metaMap;
    }
    /**
     * 下载飞书云端媒体文件（图片/附件）
     * 返回 Uint8Array 以便直接传递给 vscode.workspace.fs.writeFile
     */
    async downloadMedia(fileToken) {
        const token = await this.getTenantAccessToken();
        const response = await this.client.get(`/drive/v1/medias/${fileToken}/download`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'arraybuffer',
        });
        return new Uint8Array(response.data);
    }
}
exports.FeishuClient = FeishuClient;
exports.feishuClient = new FeishuClient();
//# sourceMappingURL=feishuClient.js.map