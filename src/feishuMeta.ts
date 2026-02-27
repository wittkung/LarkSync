import axios from 'axios';
import { getTenantAccessToken } from './feishuApi';
import { logger } from './logger';

export interface DriveMeta {
    doc_token: string;
    doc_type: string;
    title: string;
    latest_modify_time: string; // Unix timestamp string
}

export async function fetchDocsMetadata(docs: { token: string, type: string, title?: string }[]): Promise<Map<string, DriveMeta>> {
    const metaMap = new Map<string, DriveMeta>();
    if (docs.length === 0) return metaMap;

    const token = await getTenantAccessToken();

    // Feishu batch_query allows up to 200 tokens per request
    const chunkSize = 200;
    for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);

        try {
            const validDocs = chunk.filter(t => t.token && t.type);
            if (validDocs.length === 0) continue;

            const requestDocsPayload = validDocs.map(t => ({
                doc_token: t.token,
                doc_type: t.type === 'docx' ? 'docx' : 'doc'
            }));

            // For logging purposes, enrich with titles so user can identify documents
            const logDocsPayload = validDocs.map(t => ({
                title: t.title || 'Unknown',
                doc_token: t.token,
                doc_type: t.type === 'docx' ? 'docx' : 'doc'
            }));

            // Log exactly what we are about to send to Feishu
            logger.info(`Sending batch_query payload to Feishu: ${JSON.stringify({ request_docs: logDocsPayload })}`);

            const response = await axios.post('https://open.feishu.cn/open-apis/drive/v1/metas/batch_query', {
                request_docs: requestDocsPayload
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data.code === 0 && response.data.data.metas) {
                response.data.data.metas.forEach((meta: any) => {
                    // depending on feishu's response, it could be doc_token or docs_token. Try both.
                    const d_token = meta.doc_token || meta.docs_token || meta.token;
                    if (d_token) {
                        metaMap.set(d_token, meta as DriveMeta);
                    }
                });
            } else {
                throw new Error(`Batch query failed: ${response.data.msg}`);
            }
        } catch (e: any) {
            const extra = e.response?.data ? JSON.stringify(e.response.data) : '';
            throw new Error(`Feishu Meta API Error: ${e.message} ${extra}`);
        }
    }

    return metaMap;
}
