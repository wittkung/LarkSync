"use strict";

// src/markdownWorker.ts
var import_worker_threads = require("worker_threads");

// src/types/index.ts
var CODE_LANGUAGE_MAP = {
  1: "plaintext",
  2: "abap",
  3: "ada",
  4: "apache",
  5: "apex",
  6: "assembly",
  7: "bash",
  8: "csharp",
  9: "cpp",
  10: "c",
  11: "cobol",
  12: "css",
  13: "coffeescript",
  14: "d",
  15: "dart",
  16: "delphi",
  17: "django",
  18: "dockerfile",
  19: "erlang",
  20: "fortran",
  21: "foxpro",
  22: "go",
  23: "groovy",
  24: "html",
  25: "htmlbars",
  26: "http",
  27: "haskell",
  28: "json",
  29: "java",
  30: "javascript",
  31: "julia",
  32: "kotlin",
  33: "latex",
  34: "lisp",
  35: "logo",
  36: "lua",
  37: "matlab",
  38: "makefile",
  39: "markdown",
  40: "nginx",
  41: "objectivec",
  42: "openedgeabl",
  43: "perl",
  44: "php",
  45: "pascal",
  46: "powershell",
  47: "prolog",
  48: "protobuf",
  49: "python",
  50: "r",
  51: "rpm",
  52: "ruby",
  53: "rust",
  54: "sas",
  55: "scala",
  56: "scheme",
  57: "scss",
  58: "shell",
  59: "sql",
  60: "swift",
  61: "thrift",
  62: "typescript",
  63: "vbscript",
  64: "visual_basic",
  65: "xml",
  66: "yaml",
  67: "cmake",
  68: "diff",
  69: "gams",
  70: "gaussl",
  71: "gherkin",
  72: "ini",
  73: "jinja2",
  74: "json5",
  75: "lasso",
  76: "livescript",
  77: "mipsasm",
  78: "modelica",
  79: "octave",
  80: "pf",
  81: "pgsql",
  82: "reasonml",
  83: "solidity",
  84: "stata",
  85: "stylus",
  86: "tcl",
  87: "toml",
  88: "twig",
  89: "verilog",
  90: "vue"
};

// src/utils/blockHandlers.ts
function createHandlerMap() {
  const map = /* @__PURE__ */ new Map();
  map.set(1 /* PAGE */, handlePage);
  map.set(2 /* TEXT */, handleText);
  map.set(3 /* HEADING1 */, createHeadingHandler(1));
  map.set(4 /* HEADING2 */, createHeadingHandler(2));
  map.set(5 /* HEADING3 */, createHeadingHandler(3));
  map.set(6 /* HEADING4 */, createHeadingHandler(4));
  map.set(7 /* HEADING5 */, createHeadingHandler(5));
  map.set(8 /* HEADING6 */, createHeadingHandler(6));
  map.set(9 /* HEADING7 */, createHeadingHandler(7));
  map.set(10 /* HEADING8 */, createHeadingHandler(8));
  map.set(11 /* HEADING9 */, createHeadingHandler(9));
  map.set(12 /* BULLET */, handleBullet);
  map.set(13 /* ORDERED */, handleOrdered);
  map.set(17 /* TODO */, handleTodo);
  map.set(14 /* CODE */, handleCode);
  map.set(15 /* QUOTE */, handleQuote);
  map.set(34 /* QUOTE_CONTAINER */, handleQuoteContainer);
  map.set(19 /* CALLOUT */, handleCallout);
  map.set(22 /* DIVIDER */, handleDivider);
  map.set(27 /* IMAGE */, handleImage);
  map.set(23 /* FILE */, handleFile);
  map.set(31 /* TABLE */, handleTable);
  map.set(32 /* TABLE_CELL */, handleTableCell);
  map.set(24 /* GRID */, handleGrid);
  map.set(25 /* GRID_COLUMN */, handleGridColumn);
  map.set(26 /* IFRAME */, handleIframe);
  map.set(33 /* VIEW */, handlePassthrough);
  return map;
}
function renderTextElements(elements) {
  if (!elements || elements.length === 0) return "";
  return elements.map((el) => {
    if (el.text_run) {
      let text = el.text_run.content || "";
      const style = el.text_run.text_element_style;
      if (style) {
        text = applyInlineStyles(text, style);
      }
      return text;
    }
    if (el.mention_user) {
      return `@${el.mention_user.user_id}`;
    }
    if (el.mention_doc) {
      const title = el.mention_doc.title || "\u6587\u6863\u94FE\u63A5";
      const url = el.mention_doc.url || "";
      return url ? `[${title}](${url})` : title;
    }
    if (el.equation) {
      return `$${el.equation.content || ""}$`;
    }
    return "";
  }).join("");
}
function applyInlineStyles(text, style) {
  if (!text || text.trim() === "") return text;
  if (style.link?.url) {
    let url = style.link.url;
    try {
      url = decodeURIComponent(url);
    } catch {
    }
    text = `[${text}](${url})`;
    return text;
  }
  if (style.inline_code) {
    return `\`${text}\``;
  }
  if (style.bold && style.italic) {
    text = `***${text}***`;
  } else if (style.bold) {
    text = `**${text}**`;
  } else if (style.italic) {
    text = `*${text}*`;
  }
  if (style.strikethrough) {
    text = `~~${text}~~`;
  }
  if (style.underline) {
    text = `<u>${text}</u>`;
  }
  return text;
}
function handlePage(block, ctx) {
  if (!block.children || block.children.length === 0) return "";
  return ctx.renderChildren(block.children, ctx);
}
function handleText(block, _ctx) {
  const data = block.text;
  if (!data) return "";
  const text = renderTextElements(data.elements);
  if (!text.trim()) return "\n";
  return text + "\n\n";
}
function createHeadingHandler(level) {
  return (block, _ctx) => {
    const effectiveLevel = Math.min(level, 6);
    const prefix = "#".repeat(effectiveLevel);
    const dataKey = `heading${level}`;
    const data = block[dataKey];
    if (!data) return "";
    const text = renderTextElements(data.elements);
    return `${prefix} ${text}

`;
  };
}
function handleBullet(block, ctx) {
  const data = block.bullet;
  if (!data) return "";
  const indent = "  ".repeat(ctx.depth);
  const text = renderTextElements(data.elements);
  let result = `${indent}- ${text}
`;
  if (block.children && block.children.length > 0) {
    const childCtx = { ...ctx, depth: ctx.depth + 1 };
    result += ctx.renderChildren(block.children, childCtx);
  }
  return result;
}
function handleOrdered(block, ctx) {
  const data = block.ordered;
  if (!data) return "";
  const indent = "  ".repeat(ctx.depth);
  while (ctx.orderedCounters.length <= ctx.depth) {
    ctx.orderedCounters.push(0);
  }
  ctx.orderedCounters[ctx.depth]++;
  const number = ctx.orderedCounters[ctx.depth];
  const text = renderTextElements(data.elements);
  let result = `${indent}${number}. ${text}
`;
  if (block.children && block.children.length > 0) {
    const childCtx = { ...ctx, depth: ctx.depth + 1 };
    result += ctx.renderChildren(block.children, childCtx);
  }
  return result;
}
function handleTodo(block, ctx) {
  const data = block.todo;
  if (!data) return "";
  const indent = "  ".repeat(ctx.depth);
  const checkbox = data.style?.done ? "[x]" : "[ ]";
  const text = renderTextElements(data.elements);
  let result = `${indent}- ${checkbox} ${text}
`;
  if (block.children && block.children.length > 0) {
    const childCtx = { ...ctx, depth: ctx.depth + 1 };
    result += ctx.renderChildren(block.children, childCtx);
  }
  return result;
}
function handleCode(block, _ctx) {
  const data = block.code;
  if (!data) return "";
  const langEnum = data.style?.language ?? 1;
  const language = CODE_LANGUAGE_MAP[langEnum] || "plaintext";
  const codeText = (data.elements || []).map((el) => el.text_run?.content || "").join("");
  return `\`\`\`${language}
${codeText}\`\`\`

`;
}
function handleQuote(block, ctx) {
  const data = block.quote;
  if (!data) return "";
  const text = renderTextElements(data.elements);
  let result = `> ${text}
`;
  if (block.children && block.children.length > 0) {
    const childContent = ctx.renderChildren(block.children, ctx);
    result += childContent.split("\n").map((line) => line ? `> ${line}` : ">").join("\n") + "\n";
  }
  return result + "\n";
}
function handleQuoteContainer(block, ctx) {
  if (!block.children || block.children.length === 0) return "";
  const childContent = ctx.renderChildren(block.children, ctx);
  const quoted = childContent.split("\n").map((line) => line ? `> ${line}` : ">").join("\n");
  return quoted + "\n\n";
}
function handleCallout(block, ctx) {
  const data = block.callout;
  const emoji = data?.emoji_id ? `${data.emoji_id} ` : "\u{1F4A1} ";
  if (!block.children || block.children.length === 0) return "";
  const childContent = ctx.renderChildren(block.children, ctx);
  const lines = childContent.split("\n").filter((l) => l.trim() !== "");
  let result = `> ${emoji}**\u6CE8\u610F**
>
`;
  result += lines.map((line) => `> ${line}`).join("\n");
  return result + "\n\n";
}
function handleDivider(_block, _ctx) {
  return "---\n\n";
}
function handleImage(block, ctx) {
  const data = block.image;
  if (!data || !data.token) return "";
  const altText = data.alt || "\u56FE\u7247";
  ctx.mediaTokens.push({
    token: data.token,
    name: data.alt,
    type: "image"
  });
  const sanitizedTitle = sanitizeFileName(ctx.docTitle);
  const placeholderPath = `./assets/${sanitizedTitle}/${data.token}.png`;
  return `![${altText}](${placeholderPath})

`;
}
function handleFile(block, ctx) {
  const data = block.file;
  if (!data || !data.token) return "";
  const fileName = data.name || data.token;
  ctx.mediaTokens.push({
    token: data.token,
    name: data.name,
    type: "file"
  });
  const sanitizedTitle = sanitizeFileName(ctx.docTitle);
  const placeholderPath = `./assets/${sanitizedTitle}/${data.name || data.token}`;
  return `\u{1F4CE} [${fileName}](${placeholderPath})

`;
}
function handleTable(block, ctx) {
  if (!block.children || block.children.length === 0) return "";
  const tableData = block.table;
  const rowSize = tableData?.property?.row_size ?? 0;
  const colSize = tableData?.property?.column_size ?? 0;
  if (rowSize === 0 || colSize === 0) return "";
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
        } else {
          row.push("");
        }
      } else {
        row.push("");
      }
    }
    cells.push(row);
  }
  if (ctx.tableRenderMode === "gfm") {
    return renderTableGFM(cells);
  }
  return renderTableHTML(cells);
}
function renderTableGFM(cells) {
  if (cells.length === 0) return "";
  const colCount = cells[0].length;
  const colWidths = [];
  for (let c = 0; c < colCount; c++) {
    let maxWidth = 3;
    for (const row of cells) {
      const cellText = (row[c] || "").replace(/<br>/g, " ");
      maxWidth = Math.max(maxWidth, cellText.length);
    }
    colWidths.push(maxWidth);
  }
  const lines = [];
  const headerCells = cells[0].map((cell, i) => {
    const text = (cell || "").replace(/<br>/g, " ");
    return text.padEnd(colWidths[i]);
  });
  lines.push("| " + headerCells.join(" | ") + " |");
  const separator = colWidths.map((w) => "-".repeat(w));
  lines.push("| " + separator.join(" | ") + " |");
  for (let r = 1; r < cells.length; r++) {
    const rowCells = cells[r].map((cell, i) => {
      const text = (cell || "").replace(/<br>/g, " ");
      return text.padEnd(colWidths[i]);
    });
    lines.push("| " + rowCells.join(" | ") + " |");
  }
  return lines.join("\n") + "\n\n";
}
function renderTableHTML(cells) {
  let html = '\n<table style="border-collapse: collapse; width: 100%;">\n';
  for (let r = 0; r < cells.length; r++) {
    const isHeader = r === 0;
    html += "  <tr>\n";
    for (let c = 0; c < cells[r].length; c++) {
      const tag = isHeader ? "th" : "td";
      const cellContent = cells[r][c] || "&nbsp;";
      const style = "border: 1px solid #ddd; padding: 8px;";
      html += `    <${tag} style="${style}">${cellContent}</${tag}>
`;
    }
    html += "  </tr>\n";
  }
  html += "</table>\n\n";
  return html;
}
function handleTableCell(block, ctx) {
  if (!block.children || block.children.length === 0) return "";
  const parts = [];
  for (const childId of block.children) {
    const childBlock = ctx.blockMap.get(childId);
    if (childBlock) {
      const rendered = ctx.renderBlock(childBlock, ctx);
      parts.push(rendered.replace(/\n+$/, ""));
    }
  }
  return parts.join("<br>");
}
function handleGrid(block, ctx) {
  if (!block.children || block.children.length === 0) return "";
  return ctx.renderChildren(block.children, ctx);
}
function handleGridColumn(block, ctx) {
  if (!block.children || block.children.length === 0) return "";
  return ctx.renderChildren(block.children, ctx);
}
function handleIframe(block, _ctx) {
  const data = block.iframe;
  const url = data?.component?.url;
  if (!url) return "";
  return `\u{1F517} [\u5D4C\u5165\u9875\u9762](${url})

`;
}
function handlePassthrough(block, ctx) {
  if (!block.children || block.children.length === 0) return "";
  return ctx.renderChildren(block.children, ctx);
}
function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim();
}

// src/utils/markdownConverter.ts
var MarkdownConverter = class {
  /**
   * 将飞书 Docx Block 数组转换为 Markdown 字符串
   *
   * @param title 文档标题
   * @param blocks 从飞书 API 获取的扁平 Block 数组
   * @returns ConversionResult 包含 Markdown 文本和媒体 Token 列表
   */
  static convert(title, blocks) {
    if (!blocks || blocks.length === 0) {
      return { markdown: `# ${title}
`, mediaTokens: [] };
    }
    const blockMap = /* @__PURE__ */ new Map();
    for (const block of blocks) {
      blockMap.set(block.block_id, block);
    }
    let rootBlock = blocks.find((b) => b.block_type === 1 /* PAGE */);
    if (!rootBlock) {
      rootBlock = blocks[0];
    }
    const mediaTokens = [];
    const ctx = {
      depth: 0,
      orderedCounters: [0],
      blockMap,
      mediaTokens,
      docTitle: title,
      tableRenderMode: "html",
      renderChildren,
      renderBlock
    };
    let markdown = `# ${title}

`;
    if (rootBlock.block_type === 1 /* PAGE */ && rootBlock.children) {
      markdown += renderChildren(rootBlock.children, ctx);
    } else {
      for (const block of blocks) {
        if (block.block_type === 1 /* PAGE */) continue;
        markdown += renderBlock(block, ctx);
      }
    }
    markdown = cleanupMarkdown(markdown);
    return { markdown, mediaTokens };
  }
  /**
   * 兼容旧版调用签名（所有现有代码使用的入口）
   *
   * @deprecated 请使用 convert() 方法获取完整的 ConversionResult
   */
  static convertBlocksToMarkdown(title, blocks) {
    const result = this.convert(title, blocks);
    return result.markdown;
  }
};
MarkdownConverter.handlerMap = createHandlerMap();
function renderChildren(childIds, ctx) {
  if (!childIds || childIds.length === 0) return "";
  let result = "";
  let prevBlockType = null;
  for (const childId of childIds) {
    const childBlock = ctx.blockMap.get(childId);
    if (!childBlock) continue;
    const currentType = childBlock.block_type;
    const _isCurrentList = isListType(currentType);
    const _isPrevList = prevBlockType !== null && isListType(prevBlockType);
    if (currentType !== 13 /* ORDERED */ && prevBlockType === 13 /* ORDERED */) {
      if (ctx.orderedCounters.length > ctx.depth) {
        ctx.orderedCounters[ctx.depth] = 0;
      }
    }
    result += renderBlock(childBlock, ctx);
    prevBlockType = currentType;
  }
  return result;
}
function renderBlock(block, ctx) {
  const handler = MarkdownConverter["handlerMap"].get(block.block_type);
  if (handler) {
    return handler(block, ctx);
  }
  if (block.children && block.children.length > 0) {
    return renderChildren(block.children, ctx);
  }
  return `<!-- LarkSync: \u672A\u652F\u6301\u7684\u5757\u7C7B\u578B ${block.block_type} (block_id: ${block.block_id}) -->

`;
}
function isListType(blockType) {
  return blockType === 12 /* BULLET */ || blockType === 13 /* ORDERED */ || blockType === 17 /* TODO */;
}
function cleanupMarkdown(md) {
  return md.replace(/\n{3,}/g, "\n\n");
}

// src/markdownWorker.ts
async function convert() {
  const { blocks, title } = import_worker_threads.workerData;
  try {
    const result = MarkdownConverter.convert(title, blocks);
    import_worker_threads.parentPort?.postMessage({
      success: true,
      markdown: result.markdown,
      mediaTokens: result.mediaTokens
    });
  } catch (e) {
    import_worker_threads.parentPort?.postMessage({
      success: false,
      error: e.message
    });
  }
}
convert();
//# sourceMappingURL=markdownWorker.js.map
