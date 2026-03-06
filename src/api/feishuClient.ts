import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as vscode from 'vscode';
import { CONSTANTS } from '../utils/constants';
import { FeishuApiError, FeishuAuthError, RateLimitError } from '../utils/errors';
import { logger } from '../logger';
import {
    WikiNode,
    WikiNodeListResponse,
    DriveMeta,
    MetaBatchQueryRequest,
    MetaBatchQueryResponse,
    FeishuBaseResponse
} from '../types';

export class FeishuClient {
    private client: AxiosInstance;
    private tenantAccessToken: string = '';
    private tokenExpirationTime: number = 0;
    /** 用户级别 Token（OAuth 登录后设置，优先于 tenant token） */
    private userAccessToken: string = '';

    /**
     * 设置用户级别的 access_token（由 OAuthManager 在登录后调用）
     */
    public setUserAccessToken(token: string): void {
        this.userAccessToken = token;
    }

    /**
     * 获取当前有效的 Token（优先用户级，其次应用级）
     */
    public async getActiveToken(): Promise<string> {
        if (this.userAccessToken) {
            return this.userAccessToken;
        }
        return this.getTenantAccessToken();
    }

    constructor() {
        this.client = axios.create({
            baseURL: CONSTANTS.FEISHU_API_BASE,
            timeout: 30000,
        });

        // Response Interceptor for Error Handling
        this.client.interceptors.response.use(
            (response) => {
                if (response.data && response.data.code !== undefined && response.data.code !== 0) {
                    if (response.data.code === 99991400) {
                        return Promise.reject(new RateLimitError(response.data.msg, response.data.code));
                    }
                    return Promise.reject(new FeishuApiError(response.data.msg, response.data.code, response.data));
                }
                return response;
            },
            (error) => {
                if (error.response) {
                    const status = error.response.status;
                    const data = error.response.data;

                    if (status === 429 || (status === 400 && data?.code === 99991400)) {
                        return Promise.reject(new RateLimitError(data?.msg || 'Rate Limit Exceeded', data?.code || 429));
                    }
                    return Promise.reject(new FeishuApiError(data?.msg || error.message, data?.code || status, data));
                }
                return Promise.reject(new FeishuApiError(`Network error: ${error.message}`));
            }
        );
    }

    /**
     * Retrieves a valid tenant access token, refreshing if necessary.
     */
    public async getTenantAccessToken(): Promise<string> {
        const now = Date.now();
        if (this.tenantAccessToken && now < this.tokenExpirationTime) {
            return this.tenantAccessToken;
        }

        const config = vscode.workspace.getConfiguration('larksync');
        const appId = config.get<string>('appId');
        const appSecret = config.get<string>('appSecret');

        if (!appId || !appSecret) {
            throw new FeishuAuthError('App ID or App Secret is not configured. Please set them in VS Code settings.');
        }

        try {
            logger.info('Refreshing Feishu Tenant Access Token...');
            const response = await axios.post<{ code: number, msg: string, tenant_access_token: string, expire: number }>(
                CONSTANTS.FEISHU_AUTH_URL,
                { app_id: appId, app_secret: appSecret }
            );

            if (response.data.code === 0) {
                this.tenantAccessToken = response.data.tenant_access_token;
                // Refresh slightly before exact expiry to prevent race conditions
                this.tokenExpirationTime = now + (response.data.expire - CONSTANTS.TOKEN_REFRESH_MARGIN_SEC) * 1000;
                return this.tenantAccessToken;
            } else {
                throw new FeishuAuthError(response.data.msg);
            }
        } catch (error: any) {
            throw new FeishuAuthError(error.message);
        }
    }

    /**
     * Standard Request wrapper with automatic token injection and retries.
     */
    public async request<T = any>(config: AxiosRequestConfig, retries = CONSTANTS.MAX_API_RETRIES): Promise<T> {
        let lastError: any;

        for (let i = 0; i <= retries; i++) {
            try {
                const token = await this.getTenantAccessToken();
                const headers = { ...config.headers, Authorization: `Bearer ${token}` };

                const response = await this.client.request<FeishuBaseResponse<T>>({
                    ...config,
                    headers
                });

                return response.data.data;
            } catch (error: any) {
                lastError = error;
                if (error instanceof RateLimitError && i < retries) {
                    const backoff = CONSTANTS.RETRY_BASE_DELAY_MS * Math.pow(1.5, i) + Math.random() * 500;
                    logger.warn(`Rate limit hit [${config.url}]. Retrying in ${Math.round(backoff)}ms...`);
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
    public async fetchWikiNodes(spaceId: string, pageToken?: string, parentNodeToken?: string): Promise<WikiNodeListResponse> {
        const params: any = { page_size: 50 };
        if (pageToken) params.page_token = pageToken;
        if (parentNodeToken) params.parent_node_token = parentNodeToken;

        return this.request<WikiNodeListResponse>({
            url: `/wiki/v2/spaces/${spaceId}/nodes`,
            method: 'GET',
            params
        });
    }

    /**
     * Recursively fetches the entire wiki tree.
     */
    public async fetchAllWikiNodesRecursive(spaceId: string, parentNodeToken?: string): Promise<WikiNode[]> {
        let allNodes: WikiNode[] = [];
        let pageToken = '';
        let hasMore = true;
        let pageCount = 1;

        logger.info(`Fetching Wiki Node list for Space: ${spaceId} ${parentNodeToken ? `(Parent: ${parentNodeToken})` : '(Root)'} - Page ${pageCount}...`);

        while (hasMore) {
            const data = await this.fetchWikiNodes(spaceId, pageToken, parentNodeToken);
            if (data.items) {
                allNodes = allNodes.concat(data.items);
                logger.info(`  => Received ${data.items.length} nodes from Page ${pageCount}.`);
            }
            hasMore = data.has_more;
            pageToken = data.page_token;
            if (hasMore) pageCount++;
        }

        // Recursively fetch children
        const finalNodes = [...allNodes];
        for (const child of allNodes) {
            if (child.has_child) {
                logger.info(`[Recursion] Diving into branch node: [${child.title}]...`);
                const subNodes = await this.fetchAllWikiNodesRecursive(spaceId, child.node_token);
                finalNodes.push(...subNodes);
            }
        }

        return finalNodes;
    }

    /**
     * Gets document metadata for multiple files to check their modify times.
     */
    public async fetchDocsMetadata(docs: { token: string, type: string, title?: string }[]): Promise<Map<string, DriveMeta>> {
        const metaMap = new Map<string, DriveMeta>();
        if (docs.length === 0) return metaMap;

        const chunkSize = CONSTANTS.MAX_META_BATCH_SIZE;
        for (let i = 0; i < docs.length; i += chunkSize) {
            const chunk = docs.slice(i, i + chunkSize);
            const validDocs = chunk.filter(t => t.token && t.type);

            if (validDocs.length === 0) continue;

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
            logger.info(`Sending batch_query payload to Feishu: ${JSON.stringify({ request_docs: logDocsPayload })}`);

            const data = await this.request<MetaBatchQueryResponse>({
                url: '/drive/v1/metas/batch_query',
                method: 'POST',
                data: { request_docs: requestDocsPayload }
            });

            if (data && data.metas) {
                data.metas.forEach((meta) => {
                    const d_token = meta.doc_token || meta.docs_token || meta.token;
                    if (d_token) {
                        metaMap.set(d_token, meta as DriveMeta);
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
    public async downloadMedia(fileToken: string): Promise<Uint8Array> {
        const token = await this.getTenantAccessToken();

        const response = await this.client.get(`/drive/v1/medias/${fileToken}/download`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'arraybuffer',
        });

        return new Uint8Array(response.data);
    }
}

export const feishuClient = new FeishuClient();
