/**
 * fileWriteStrategy.ts
 * Frontmatter 保护区写入策略
 *
 * 在 Markdown 文件中使用边界标记保护用户手工内容：
 * - 首次写入：注入 <!-- LARKSYNC:START --> 和 <!-- LARKSYNC:END --> 边界标记
 * - 后续更新：仅替换两个标记之间的内容，保留标记外部的用户内容
 */

const BOUNDARY_START = '<!-- LARKSYNC:START -->';
const BOUNDARY_END = '<!-- LARKSYNC:END -->';

/**
 * 将同步内容写入时应用保护区策略
 *
 * @param existingContent 文件的现有内容（如果文件存在）
 * @param newContent 新的同步 Markdown 内容
 * @returns 最终写入文件的内容
 */
export function applyProtectedWrite(existingContent: string | null, newContent: string): string {
    // 首次写入 — 直接注入边界标记
    if (!existingContent) {
        return wrapWithBoundary(newContent);
    }

    const startIdx = existingContent.indexOf(BOUNDARY_START);
    const endIdx = existingContent.indexOf(BOUNDARY_END);

    // 如果没有找到边界标记 — 说明是用户手动创建的文件或旧版同步文件
    // 保留整个已有内容，在末尾追加带边界的同步内容
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        return wrapWithBoundary(newContent);
    }

    // 提取保护区外的用户内容
    const beforeSync = existingContent.substring(0, startIdx);
    const afterSync = existingContent.substring(endIdx + BOUNDARY_END.length);

    // 仅替换边界内的同步内容
    return beforeSync + wrapWithBoundary(newContent) + afterSync;
}

/**
 * 用边界标记包裹同步内容
 */
function wrapWithBoundary(content: string): string {
    return `${BOUNDARY_START}\n${content}\n${BOUNDARY_END}`;
}

/**
 * 判断文件内容是否包含 LarkSync 保护区边界标记
 */
export function hasProtectionBoundary(content: string): boolean {
    return content.includes(BOUNDARY_START) && content.includes(BOUNDARY_END);
}
