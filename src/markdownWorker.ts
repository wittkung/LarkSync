import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';
import * as fs from 'fs';

async function fetchWithRetry(url: string, config: any, retries = 5, delayMs = 1500): Promise<any> {
    for (let i = 0; i <= retries; i++) {
        try {
            return await axios.get(url, config);
        } catch (e: any) {
            const isRateLimit = e.response && (
                e.response.status === 429 ||
                (e.response.status === 400 && e.response.data && e.response.data.code === 99991400)
            );

            if (isRateLimit && i < retries) {
                // Exponential backoff with jitter
                const backoff = delayMs * Math.pow(1.5, i) + Math.random() * 500;
                await new Promise(res => setTimeout(res, backoff));
                continue;
            }
            throw e;
        }
    }
}

async function fetchAndConvert() {
    const { documentId, token, targetPath, title } = workerData;

    try {
        let allBlocks: any[] = [];
        let pageToken = '';
        let hasMore = true;

        while (hasMore) {
            const params: any = { page_size: 50 };
            if (pageToken) params.page_token = pageToken;

            const res = await fetchWithRetry(`https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks`, {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.code !== 0) {
                // Enhanced Error throwing
                const errMessage = `API Error [${res.data.code}]: ${res.data.msg}. Ensure the App has "docx:document:readonly" permissions and the token is a docx token.`;
                parentPort?.postMessage({ success: false, error: errMessage });
                return;
            }

            const data = res.data.data;
            if (data.items) {
                allBlocks = allBlocks.concat(data.items);
            }
            hasMore = data.has_more;
            pageToken = data.page_token;
        }

        let markdown = `# ${title}\n\n`;

        for (const block of allBlocks) {
            markdown += blockToMarkdown(block) + '\n';
        }

        fs.writeFileSync(targetPath, markdown, 'utf-8');
        parentPort?.postMessage({ success: true, timestamp: Date.now() });
    } catch (e: any) {
        const extra = e.response?.data ? JSON.stringify(e.response.data) : '';
        parentPort?.postMessage({ success: false, error: `${e.message} ${extra}` });
    }
}

function blockToMarkdown(block: any): string {
    if (block.text) return `\n${extractTextElements(block.text.elements)}\n`;
    if (block.heading1) return `\n# ${extractTextElements(block.heading1.elements)}\n`;
    if (block.heading2) return `\n## ${extractTextElements(block.heading2.elements)}\n`;
    if (block.heading3) return `\n### ${extractTextElements(block.heading3.elements)}\n`;
    if (block.heading4) return `\n#### ${extractTextElements(block.heading4.elements)}\n`;
    if (block.heading5) return `\n##### ${extractTextElements(block.heading5.elements)}\n`;
    if (block.heading6) return `\n###### ${extractTextElements(block.heading6.elements)}\n`;
    if (block.bullet) return `- ${extractTextElements(block.bullet.elements)}`;
    if (block.ordered) return `1. ${extractTextElements(block.ordered.elements)}`;
    if (block.code) return `\n\`\`\`\n${extractTextElements(block.code.elements)}\n\`\`\`\n`;
    if (block.divider) return `\n---\n`;
    if (block.quote) return `> ${extractTextElements(block.quote.elements)}\n`;
    return '';
}

function extractTextElements(elements: any[]): string {
    if (!elements) return '';
    return elements.map(e => {
        let text = e.text_run?.content || '';
        if (e.text_run?.text_element_style?.bold) text = `**${text}**`;
        if (e.text_run?.text_element_style?.italic) text = `*${text}*`;
        if (e.text_run?.text_element_style?.strikethrough) text = `~~${text}~~`;
        return text;
    }).join('');
}

fetchAndConvert();
