"use strict";
/**
 * markdownWorker.ts
 * Worker 线程 — 仅负责 CPU 密集的 AST→Markdown 转换
 *
 * 方案 A 架构：
 * - 接收: { blocks: DocxBlock[], title: string } via workerData
 * - 处理: Block AST → Markdown 转换
 * - 返回: { success, markdown, mediaTokens } 或 { success: false, error }
 *
 * 注意：Worker 线程中不能使用 vscode API，
 *       不做文件 I/O 和网络请求。
 */
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const markdownConverter_1 = require("./utils/markdownConverter");
async function convert() {
    const { blocks, title } = worker_threads_1.workerData;
    try {
        const result = markdownConverter_1.MarkdownConverter.convert(title, blocks);
        worker_threads_1.parentPort?.postMessage({
            success: true,
            markdown: result.markdown,
            mediaTokens: result.mediaTokens,
        });
    }
    catch (e) {
        worker_threads_1.parentPort?.postMessage({
            success: false,
            error: e.message,
        });
    }
}
convert();
//# sourceMappingURL=markdownWorker.js.map