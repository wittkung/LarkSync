"use strict";
/**
 * blockHandlers.ts
 * 飞书 Docx Block 各类型的 Markdown 映射处理函数
 *
 * 每个 Handler 接收一个 Block 节点和上下文信息，返回该节点的 Markdown 文本片段。
 * 嵌套块（如列表、表格单元格、Callout）通过递归调用上下文中的 renderChildren 来处理。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHandlerMap = createHandlerMap;
exports.renderTextElements = renderTextElements;
const types_1 = require("../types");
/**
 * 创建 Block Type → Handler 的映射注册表
 */
function createHandlerMap() {
    const map = new Map();
    // 页面根节点 — 渲染所有子块
    map.set(types_1.BlockType.PAGE, handlePage);
    // 文本类块
    map.set(types_1.BlockType.TEXT, handleText);
    map.set(types_1.BlockType.HEADING1, createHeadingHandler(1));
    map.set(types_1.BlockType.HEADING2, createHeadingHandler(2));
    map.set(types_1.BlockType.HEADING3, createHeadingHandler(3));
    map.set(types_1.BlockType.HEADING4, createHeadingHandler(4));
    map.set(types_1.BlockType.HEADING5, createHeadingHandler(5));
    map.set(types_1.BlockType.HEADING6, createHeadingHandler(6));
    map.set(types_1.BlockType.HEADING7, createHeadingHandler(7));
    map.set(types_1.BlockType.HEADING8, createHeadingHandler(8));
    map.set(types_1.BlockType.HEADING9, createHeadingHandler(9));
    // 列表类块
    map.set(types_1.BlockType.BULLET, handleBullet);
    map.set(types_1.BlockType.ORDERED, handleOrdered);
    map.set(types_1.BlockType.TODO, handleTodo);
    // 代码块
    map.set(types_1.BlockType.CODE, handleCode);
    // 引用与容器
    map.set(types_1.BlockType.QUOTE, handleQuote);
    map.set(types_1.BlockType.QUOTE_CONTAINER, handleQuoteContainer);
    map.set(types_1.BlockType.CALLOUT, handleCallout);
    // 分割线
    map.set(types_1.BlockType.DIVIDER, handleDivider);
    // 媒体
    map.set(types_1.BlockType.IMAGE, handleImage);
    map.set(types_1.BlockType.FILE, handleFile);
    // 表格
    map.set(types_1.BlockType.TABLE, handleTable);
    map.set(types_1.BlockType.TABLE_CELL, handleTableCell);
    // 分栏
    map.set(types_1.BlockType.GRID, handleGrid);
    map.set(types_1.BlockType.GRID_COLUMN, handleGridColumn);
    // 嵌入
    map.set(types_1.BlockType.IFRAME, handleIframe);
    // 视图块（仅作为容器透传子块）
    map.set(types_1.BlockType.VIEW, handlePassthrough);
    return map;
}
// ========================================================
// 富文本元素解析
// ========================================================
/**
 * 将 TextElement 数组渲染为 Markdown 内联文本
 */
function renderTextElements(elements) {
    if (!elements || elements.length === 0)
        return '';
    return elements.map(el => {
        // 纯文本运行段
        if (el.text_run) {
            let text = el.text_run.content || '';
            const style = el.text_run.text_element_style;
            if (style) {
                text = applyInlineStyles(text, style);
            }
            return text;
        }
        // @提及用户
        if (el.mention_user) {
            return `@${el.mention_user.user_id}`;
        }
        // @提及文档
        if (el.mention_doc) {
            const title = el.mention_doc.title || '文档链接';
            const url = el.mention_doc.url || '';
            return url ? `[${title}](${url})` : title;
        }
        // 行内公式
        if (el.equation) {
            return `$${el.equation.content || ''}$`;
        }
        return '';
    }).join('');
}
/**
 * 应用内联样式到文本片段
 * 注意：样式应按照 Markdown 语法的嵌套规则依次包裹
 */
function applyInlineStyles(text, style) {
    // 空白文本不应用样式（避免产生 `****` 等空标记）
    if (!text || text.trim() === '')
        return text;
    // 超链接 — 最外层处理
    if (style.link?.url) {
        // 解码飞书可能编码过的 URL
        let url = style.link.url;
        try {
            url = decodeURIComponent(url);
        }
        catch {
            // 解码失败则使用原始 URL
        }
        text = `[${text}](${url})`;
        // 链接内文本已完成，不再叠加其他 Markdown 样式（避免语法冲突）
        return text;
    }
    // 行内代码 — 优先处理，代码内不应再嵌套其他标记
    if (style.inline_code) {
        return `\`${text}\``;
    }
    // 粗体 + 斜体组合
    if (style.bold && style.italic) {
        text = `***${text}***`;
    }
    else if (style.bold) {
        text = `**${text}**`;
    }
    else if (style.italic) {
        text = `*${text}*`;
    }
    // 删除线
    if (style.strikethrough) {
        text = `~~${text}~~`;
    }
    // 下划线 — Markdown 原生不支持，使用 HTML
    if (style.underline) {
        text = `<u>${text}</u>`;
    }
    return text;
}
// ========================================================
// 各 Block Type Handler 实现
// ========================================================
// --- 页面根节点 ---
function handlePage(block, ctx) {
    if (!block.children || block.children.length === 0)
        return '';
    return ctx.renderChildren(block.children, ctx);
}
// --- 段落文本 ---
function handleText(block, ctx) {
    const data = block.text;
    if (!data)
        return '';
    const text = renderTextElements(data.elements);
    // 空段落保持为空行
    if (!text.trim())
        return '\n';
    return text + '\n\n';
}
// --- 标题 (1-9 级) ---
function createHeadingHandler(level) {
    return (block, ctx) => {
        // 飞书支持 1-9 级标题，Markdown 仅支持 1-6 级
        const effectiveLevel = Math.min(level, 6);
        const prefix = '#'.repeat(effectiveLevel);
        // 根据 block_type 定位对应数据字段
        const dataKey = `heading${level}`;
        const data = block[dataKey];
        if (!data)
            return '';
        const text = renderTextElements(data.elements);
        return `${prefix} ${text}\n\n`;
    };
}
// --- 无序列表 ---
function handleBullet(block, ctx) {
    const data = block.bullet;
    if (!data)
        return '';
    const indent = '  '.repeat(ctx.depth);
    const text = renderTextElements(data.elements);
    let result = `${indent}- ${text}\n`;
    // 递归处理子块（嵌套列表）
    if (block.children && block.children.length > 0) {
        const childCtx = { ...ctx, depth: ctx.depth + 1 };
        result += ctx.renderChildren(block.children, childCtx);
    }
    return result;
}
// --- 有序列表 ---
function handleOrdered(block, ctx) {
    const data = block.ordered;
    if (!data)
        return '';
    const indent = '  '.repeat(ctx.depth);
    // 管理有序列表计数器
    while (ctx.orderedCounters.length <= ctx.depth) {
        ctx.orderedCounters.push(0);
    }
    ctx.orderedCounters[ctx.depth]++;
    const number = ctx.orderedCounters[ctx.depth];
    const text = renderTextElements(data.elements);
    let result = `${indent}${number}. ${text}\n`;
    // 递归处理子块（嵌套列表）
    if (block.children && block.children.length > 0) {
        const childCtx = { ...ctx, depth: ctx.depth + 1 };
        result += ctx.renderChildren(block.children, childCtx);
    }
    return result;
}
// --- 待办事项 ---
function handleTodo(block, ctx) {
    const data = block.todo;
    if (!data)
        return '';
    const indent = '  '.repeat(ctx.depth);
    const checkbox = data.style?.done ? '[x]' : '[ ]';
    const text = renderTextElements(data.elements);
    let result = `${indent}- ${checkbox} ${text}\n`;
    if (block.children && block.children.length > 0) {
        const childCtx = { ...ctx, depth: ctx.depth + 1 };
        result += ctx.renderChildren(block.children, childCtx);
    }
    return result;
}
// --- 代码块 ---
function handleCode(block, ctx) {
    const data = block.code;
    if (!data)
        return '';
    // 从语言枚举值映射为语法高亮标记
    const langEnum = data.style?.language ?? 1;
    const language = types_1.CODE_LANGUAGE_MAP[langEnum] || 'plaintext';
    // 提取纯文本内容（不应用任何内联样式）
    const codeText = (data.elements || [])
        .map(el => el.text_run?.content || '')
        .join('');
    return `\`\`\`${language}\n${codeText}\`\`\`\n\n`;
}
// --- 引用块（单行引用） ---
function handleQuote(block, ctx) {
    const data = block.quote;
    if (!data)
        return '';
    const text = renderTextElements(data.elements);
    let result = `> ${text}\n`;
    if (block.children && block.children.length > 0) {
        const childContent = ctx.renderChildren(block.children, ctx);
        // 对子块的每一行都添加 > 前缀
        result += childContent.split('\n')
            .map(line => line ? `> ${line}` : '>')
            .join('\n') + '\n';
    }
    return result + '\n';
}
// --- 引用容器 ---
function handleQuoteContainer(block, ctx) {
    if (!block.children || block.children.length === 0)
        return '';
    const childContent = ctx.renderChildren(block.children, ctx);
    // 对所有子内容行添加引用前缀
    const quoted = childContent.split('\n')
        .map(line => line ? `> ${line}` : '>')
        .join('\n');
    return quoted + '\n\n';
}
// --- 高亮块 (Callout) ---
function handleCallout(block, ctx) {
    const data = block.callout;
    const emoji = data?.emoji_id ? `${data.emoji_id} ` : '💡 ';
    if (!block.children || block.children.length === 0)
        return '';
    const childContent = ctx.renderChildren(block.children, ctx);
    const lines = childContent.split('\n').filter(l => l.trim() !== '');
    // 渲染为带 Emoji 的引用块
    let result = `> ${emoji}**注意**\n>\n`;
    result += lines.map(line => `> ${line}`).join('\n');
    return result + '\n\n';
}
// --- 分割线 ---
function handleDivider(_block, _ctx) {
    return '---\n\n';
}
// --- 图片块 ---
function handleImage(block, ctx) {
    const data = block.image;
    if (!data || !data.token)
        return '';
    // 收集媒体 Token
    const altText = data.alt || '图片';
    ctx.mediaTokens.push({
        token: data.token,
        name: data.alt,
        type: 'image',
    });
    // 生成基于相对路径的占位符（实际路径由主线程确定）
    const sanitizedTitle = sanitizeFileName(ctx.docTitle);
    const placeholderPath = `./assets/${sanitizedTitle}/${data.token}.png`;
    return `![${altText}](${placeholderPath})\n\n`;
}
// --- 附件文件块 ---
function handleFile(block, ctx) {
    const data = block.file;
    if (!data || !data.token)
        return '';
    const fileName = data.name || data.token;
    ctx.mediaTokens.push({
        token: data.token,
        name: data.name,
        type: 'file',
    });
    const sanitizedTitle = sanitizeFileName(ctx.docTitle);
    const placeholderPath = `./assets/${sanitizedTitle}/${data.name || data.token}`;
    return `📎 [${fileName}](${placeholderPath})\n\n`;
}
// --- 表格块（双模式渲染） ---
function handleTable(block, ctx) {
    if (!block.children || block.children.length === 0)
        return '';
    const tableData = block.table;
    const rowSize = tableData?.property?.row_size ?? 0;
    const colSize = tableData?.property?.column_size ?? 0;
    if (rowSize === 0 || colSize === 0)
        return '';
    // 构建二维表格：children 按照 从左到右、从上到下 排列
    const cells = [];
    for (let r = 0; r < rowSize; r++) {
        const row = [];
        for (let c = 0; c < colSize; c++) {
            const cellIndex = r * colSize + c;
            const cellId = block.children[cellIndex];
            if (cellId) {
                const cellBlock = ctx.blockMap.get(cellId);
                if (cellBlock) {
                    const cellContent = handleTableCell(cellBlock, ctx);
                    row.push(cellContent.trim());
                }
                else {
                    row.push('');
                }
            }
            else {
                row.push('');
            }
        }
        cells.push(row);
    }
    // 根据配置选择渲染模式
    if (ctx.tableRenderMode === 'gfm') {
        return renderTableGFM(cells);
    }
    return renderTableHTML(cells);
}
/**
 * GFM 纯 Markdown 表格渲染
 */
function renderTableGFM(cells) {
    if (cells.length === 0)
        return '';
    const colCount = cells[0].length;
    // 计算每列最大宽度（至少 3 个字符以满足 GFM 规范）
    const colWidths = [];
    for (let c = 0; c < colCount; c++) {
        let maxWidth = 3;
        for (const row of cells) {
            const cellText = (row[c] || '').replace(/<br>/g, ' ');
            maxWidth = Math.max(maxWidth, cellText.length);
        }
        colWidths.push(maxWidth);
    }
    const lines = [];
    // 表头行
    const headerCells = cells[0].map((cell, i) => {
        const text = (cell || '').replace(/<br>/g, ' ');
        return text.padEnd(colWidths[i]);
    });
    lines.push('| ' + headerCells.join(' | ') + ' |');
    // 分隔行
    const separator = colWidths.map(w => '-'.repeat(w));
    lines.push('| ' + separator.join(' | ') + ' |');
    // 数据行
    for (let r = 1; r < cells.length; r++) {
        const rowCells = cells[r].map((cell, i) => {
            const text = (cell || '').replace(/<br>/g, ' ');
            return text.padEnd(colWidths[i]);
        });
        lines.push('| ' + rowCells.join(' | ') + ' |');
    }
    return lines.join('\n') + '\n\n';
}
/**
 * HTML 高保真表格渲染
 */
function renderTableHTML(cells) {
    let html = '\n<table style="border-collapse: collapse; width: 100%;">\n';
    for (let r = 0; r < cells.length; r++) {
        const isHeader = r === 0;
        html += '  <tr>\n';
        for (let c = 0; c < cells[r].length; c++) {
            const tag = isHeader ? 'th' : 'td';
            const cellContent = cells[r][c] || '&nbsp;';
            const style = 'border: 1px solid #ddd; padding: 8px;';
            html += `    <${tag} style="${style}">${cellContent}</${tag}>\n`;
        }
        html += '  </tr>\n';
    }
    html += '</table>\n\n';
    return html;
}
// --- 表格单元格 ---
function handleTableCell(block, ctx) {
    if (!block.children || block.children.length === 0)
        return '';
    // 递归渲染单元格内的所有子块
    const parts = [];
    for (const childId of block.children) {
        const childBlock = ctx.blockMap.get(childId);
        if (childBlock) {
            const rendered = ctx.renderBlock(childBlock, ctx);
            // 在表格单元格内，去除多余的尾部换行
            parts.push(rendered.replace(/\n+$/, ''));
        }
    }
    // 用 <br> 连接多段落
    return parts.join('<br>');
}
// --- 分栏块 ---
function handleGrid(block, ctx) {
    if (!block.children || block.children.length === 0)
        return '';
    // 分栏在 Markdown 中难以直接表示，降级为依次输出各列内容
    return ctx.renderChildren(block.children, ctx);
}
// --- 分栏列 ---
function handleGridColumn(block, ctx) {
    if (!block.children || block.children.length === 0)
        return '';
    return ctx.renderChildren(block.children, ctx);
}
// --- 嵌入页面 ---
function handleIframe(block, ctx) {
    const data = block.iframe;
    const url = data?.component?.url;
    if (!url)
        return '';
    return `🔗 [嵌入页面](${url})\n\n`;
}
// --- 透传容器（仅渲染子块） ---
function handlePassthrough(block, ctx) {
    if (!block.children || block.children.length === 0)
        return '';
    return ctx.renderChildren(block.children, ctx);
}
// ========================================================
// 工具函数
// ========================================================
function sanitizeFileName(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_');
}
//# sourceMappingURL=blockHandlers.js.map