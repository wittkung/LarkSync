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

import { parentPort, workerData } from 'worker_threads';
import { MarkdownConverter } from './utils/markdownConverter';
import { DocxBlock } from './types';

async function convert() {
    const { blocks, title } = workerData as { blocks: DocxBlock[]; title: string };

    try {
        const result = MarkdownConverter.convert(title, blocks);

        parentPort?.postMessage({
            success: true,
            markdown: result.markdown,
            mediaTokens: result.mediaTokens
        });
    } catch (e: any) {
        parentPort?.postMessage({
            success: false,
            error: e.message
        });
    }
}

convert();
