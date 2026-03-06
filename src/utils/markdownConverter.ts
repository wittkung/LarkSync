/**
 * markdownConverter.ts
 * 飞书 Docx Block AST → Markdown 转换引擎
 *
 * 核心设计：
 * 1. 将扁平的 Block 数组重建为内存中的多叉树（通过 parent_id / children 索引）
 * 2. 从 Root Block (PAGE) 开始 DFS 深度优先遍历
 * 3. 每个节点根据 block_type 分发到对应的 Handler 函数
 * 4. Handler 通过 RenderContext 递归处理嵌套块
 */

import {
    DocxBlock,
    BlockType,
    MediaTokenEntry,
    ConversionResult,
} from '../types';

import {
    RenderContext,
    BlockHandler,
    createHandlerMap,
} from './blockHandlers';

export class MarkdownConverter {
    private static handlerMap: Map<number, BlockHandler> = createHandlerMap();

    /**
     * 将飞书 Docx Block 数组转换为 Markdown 字符串
     *
     * @param title 文档标题
     * @param blocks 从飞书 API 获取的扁平 Block 数组
     * @returns ConversionResult 包含 Markdown 文本和媒体 Token 列表
     */
    public static convert(title: string, blocks: DocxBlock[]): ConversionResult {
        if (!blocks || blocks.length === 0) {
            return { markdown: `# ${title}\n`, mediaTokens: [] };
        }

        // 1. 构建 Block ID → Block 对象索引
        const blockMap = new Map<string, DocxBlock>();
        for (const block of blocks) {
            blockMap.set(block.block_id, block);
        }

        // 2. 定位根节点（block_type === PAGE 或第一个块）
        let rootBlock = blocks.find(b => b.block_type === BlockType.PAGE);
        if (!rootBlock) {
            // 兼容：如果没有 PAGE 块，使用第一个块作为入口
            rootBlock = blocks[0];
        }

        // 3. 初始化渲染上下文
        const mediaTokens: MediaTokenEntry[] = [];
        const ctx: RenderContext = {
            depth: 0,
            orderedCounters: [0],
            blockMap,
            mediaTokens,
            docTitle: title,
            renderChildren: renderChildren,
            renderBlock: renderBlock,
        };

        // 4. 执行 DFS 遍历
        let markdown = `# ${title}\n\n`;

        if (rootBlock.block_type === BlockType.PAGE && rootBlock.children) {
            // 标准流程：从 PAGE 根节点的 children 开始遍历
            markdown += renderChildren(rootBlock.children, ctx);
        } else {
            // 降级流程：逐块遍历（跳过 PAGE 块本身）
            for (const block of blocks) {
                if (block.block_type === BlockType.PAGE) continue;
                markdown += renderBlock(block, ctx);
            }
        }

        // 5. 后处理：清理多余空行
        markdown = cleanupMarkdown(markdown);

        return { markdown, mediaTokens };
    }

    /**
     * 兼容旧版调用签名（所有现有代码使用的入口）
     * 
     * @deprecated 请使用 convert() 方法获取完整的 ConversionResult
     */
    public static convertBlocksToMarkdown(title: string, blocks: DocxBlock[]): string {
        const result = this.convert(title, blocks);
        return result.markdown;
    }
}

// ========================================================
// DFS 遍历核心函数
// ========================================================

/**
 * 渲染一组子块 ID
 */
function renderChildren(childIds: string[], ctx: RenderContext): string {
    if (!childIds || childIds.length === 0) return '';

    let result = '';
    let prevBlockType: number | null = null;

    for (const childId of childIds) {
        const childBlock = ctx.blockMap.get(childId);
        if (!childBlock) continue;

        // 在列表项之间不插入额外空行；非列表块之间正常分隔
        const currentType = childBlock.block_type;
        const isCurrentList = isListType(currentType);
        const isPrevList = prevBlockType !== null && isListType(prevBlockType);

        // 重置有序列表计数器：当非有序列表块出现时
        if (currentType !== BlockType.ORDERED && prevBlockType === BlockType.ORDERED) {
            // 重置当前深度的计数器
            if (ctx.orderedCounters.length > ctx.depth) {
                ctx.orderedCounters[ctx.depth] = 0;
            }
        }

        result += renderBlock(childBlock, ctx);
        prevBlockType = currentType;
    }

    return result;
}

/**
 * 渲染单个 Block 节点
 */
function renderBlock(block: DocxBlock, ctx: RenderContext): string {
    const handler = MarkdownConverter['handlerMap'].get(block.block_type);

    if (handler) {
        return handler(block, ctx);
    }

    // 未知块类型 — 尝试渲染子块，避免丢失内容
    if (block.children && block.children.length > 0) {
        return renderChildren(block.children, ctx);
    }

    // 完全未知且无子块 — 输出注释提醒
    return `<!-- LarkSync: 未支持的块类型 ${block.block_type} (block_id: ${block.block_id}) -->\n\n`;
}

// ========================================================
// 工具函数
// ========================================================

/**
 * 判断是否为列表类型块
 */
function isListType(blockType: number): boolean {
    return blockType === BlockType.BULLET
        || blockType === BlockType.ORDERED
        || blockType === BlockType.TODO;
}

/**
 * 清理 Markdown 输出中的多余空行
 * 连续超过 2 个空行压缩为 2 个
 */
function cleanupMarkdown(md: string): string {
    return md.replace(/\n{3,}/g, '\n\n');
}
