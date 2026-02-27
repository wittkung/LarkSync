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
const worker_threads_1 = require("worker_threads");
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
async function fetchWithRetry(url, config, retries = 5, delayMs = 1500) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await axios_1.default.get(url, config);
        }
        catch (e) {
            const isRateLimit = e.response && (e.response.status === 429 ||
                (e.response.status === 400 && e.response.data && e.response.data.code === 99991400));
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
    const { documentId, token, targetPath, title } = worker_threads_1.workerData;
    try {
        let allBlocks = [];
        let pageToken = '';
        let hasMore = true;
        while (hasMore) {
            const params = { page_size: 50 };
            if (pageToken)
                params.page_token = pageToken;
            const res = await fetchWithRetry(`https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks`, {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.code !== 0) {
                // Enhanced Error throwing
                const errMessage = `API Error [${res.data.code}]: ${res.data.msg}. Ensure the App has "docx:document:readonly" permissions and the token is a docx token.`;
                worker_threads_1.parentPort?.postMessage({ success: false, error: errMessage });
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
        worker_threads_1.parentPort?.postMessage({ success: true, timestamp: Date.now() });
    }
    catch (e) {
        const extra = e.response?.data ? JSON.stringify(e.response.data) : '';
        worker_threads_1.parentPort?.postMessage({ success: false, error: `${e.message} ${extra}` });
    }
}
function blockToMarkdown(block) {
    if (block.text)
        return `\n${extractTextElements(block.text.elements)}\n`;
    if (block.heading1)
        return `\n# ${extractTextElements(block.heading1.elements)}\n`;
    if (block.heading2)
        return `\n## ${extractTextElements(block.heading2.elements)}\n`;
    if (block.heading3)
        return `\n### ${extractTextElements(block.heading3.elements)}\n`;
    if (block.heading4)
        return `\n#### ${extractTextElements(block.heading4.elements)}\n`;
    if (block.heading5)
        return `\n##### ${extractTextElements(block.heading5.elements)}\n`;
    if (block.heading6)
        return `\n###### ${extractTextElements(block.heading6.elements)}\n`;
    if (block.bullet)
        return `- ${extractTextElements(block.bullet.elements)}`;
    if (block.ordered)
        return `1. ${extractTextElements(block.ordered.elements)}`;
    if (block.code)
        return `\n\`\`\`\n${extractTextElements(block.code.elements)}\n\`\`\`\n`;
    if (block.divider)
        return `\n---\n`;
    if (block.quote)
        return `> ${extractTextElements(block.quote.elements)}\n`;
    return '';
}
function extractTextElements(elements) {
    if (!elements)
        return '';
    return elements.map(e => {
        let text = e.text_run?.content || '';
        if (e.text_run?.text_element_style?.bold)
            text = `**${text}**`;
        if (e.text_run?.text_element_style?.italic)
            text = `*${text}*`;
        if (e.text_run?.text_element_style?.strikethrough)
            text = `~~${text}~~`;
        return text;
    }).join('');
}
fetchAndConvert();
//# sourceMappingURL=markdownWorker.js.map