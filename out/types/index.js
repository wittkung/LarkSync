"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CODE_LANGUAGE_MAP = exports.SyncNodeStatus = exports.BlockType = void 0;
// ========================================================
// 飞书 Docx Block 模型 — 完整类型定义
// ========================================================
/**
 * Block Type 枚举值
 * 参考: https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/document-block
 */
var BlockType;
(function (BlockType) {
    BlockType[BlockType["PAGE"] = 1] = "PAGE";
    BlockType[BlockType["TEXT"] = 2] = "TEXT";
    BlockType[BlockType["HEADING1"] = 3] = "HEADING1";
    BlockType[BlockType["HEADING2"] = 4] = "HEADING2";
    BlockType[BlockType["HEADING3"] = 5] = "HEADING3";
    BlockType[BlockType["HEADING4"] = 6] = "HEADING4";
    BlockType[BlockType["HEADING5"] = 7] = "HEADING5";
    BlockType[BlockType["HEADING6"] = 8] = "HEADING6";
    BlockType[BlockType["HEADING7"] = 9] = "HEADING7";
    BlockType[BlockType["HEADING8"] = 10] = "HEADING8";
    BlockType[BlockType["HEADING9"] = 11] = "HEADING9";
    BlockType[BlockType["BULLET"] = 12] = "BULLET";
    BlockType[BlockType["ORDERED"] = 13] = "ORDERED";
    BlockType[BlockType["CODE"] = 14] = "CODE";
    BlockType[BlockType["QUOTE"] = 15] = "QUOTE";
    // 16 预留
    BlockType[BlockType["TODO"] = 17] = "TODO";
    // 18 预留
    BlockType[BlockType["CALLOUT"] = 19] = "CALLOUT";
    BlockType[BlockType["CHAT_CARD"] = 20] = "CHAT_CARD";
    BlockType[BlockType["DIAGRAM"] = 21] = "DIAGRAM";
    BlockType[BlockType["DIVIDER"] = 22] = "DIVIDER";
    BlockType[BlockType["FILE"] = 23] = "FILE";
    BlockType[BlockType["GRID"] = 24] = "GRID";
    BlockType[BlockType["GRID_COLUMN"] = 25] = "GRID_COLUMN";
    BlockType[BlockType["IFRAME"] = 26] = "IFRAME";
    BlockType[BlockType["IMAGE"] = 27] = "IMAGE";
    BlockType[BlockType["ISV"] = 28] = "ISV";
    BlockType[BlockType["MINDNOTE"] = 29] = "MINDNOTE";
    BlockType[BlockType["SHEET"] = 30] = "SHEET";
    BlockType[BlockType["TABLE"] = 31] = "TABLE";
    BlockType[BlockType["TABLE_CELL"] = 32] = "TABLE_CELL";
    BlockType[BlockType["VIEW"] = 33] = "VIEW";
    BlockType[BlockType["QUOTE_CONTAINER"] = 34] = "QUOTE_CONTAINER";
    // 35+ 为飞书扩展类型
    BlockType[BlockType["TASK"] = 35] = "TASK";
    BlockType[BlockType["OKR"] = 36] = "OKR";
    BlockType[BlockType["OKR_OBJECTIVE"] = 37] = "OKR_OBJECTIVE";
    BlockType[BlockType["OKR_KEY_RESULT"] = 38] = "OKR_KEY_RESULT";
    BlockType[BlockType["OKR_PROGRESS"] = 39] = "OKR_PROGRESS";
    BlockType[BlockType["ADD_ONS"] = 40] = "ADD_ONS";
    BlockType[BlockType["JIRA_ISSUE"] = 41] = "JIRA_ISSUE";
    BlockType[BlockType["WIKI_CATALOG"] = 42] = "WIKI_CATALOG";
    BlockType[BlockType["BOARD"] = 43] = "BOARD";
    BlockType[BlockType["UNDEFINED"] = 999] = "UNDEFINED";
})(BlockType || (exports.BlockType = BlockType = {}));
// --- 云端知识树差异状态 ---
var SyncNodeStatus;
(function (SyncNodeStatus) {
    /** 已同步且一致 */
    SyncNodeStatus["SYNCED"] = "synced";
    /** 云端新增，本地尚未同步 */
    SyncNodeStatus["ADDED"] = "added";
    /** 云端 revision_id 大于本地 manifest */
    SyncNodeStatus["MODIFIED"] = "modified";
    /** 本地存在但云端已删除 */
    SyncNodeStatus["DELETED"] = "deleted";
})(SyncNodeStatus || (exports.SyncNodeStatus = SyncNodeStatus = {}));
// --- 代码块语言枚举映射 ---
exports.CODE_LANGUAGE_MAP = {
    1: 'plaintext',
    2: 'abap',
    3: 'ada',
    4: 'apache',
    5: 'apex',
    6: 'assembly',
    7: 'bash',
    8: 'csharp',
    9: 'cpp',
    10: 'c',
    11: 'cobol',
    12: 'css',
    13: 'coffeescript',
    14: 'd',
    15: 'dart',
    16: 'delphi',
    17: 'django',
    18: 'dockerfile',
    19: 'erlang',
    20: 'fortran',
    21: 'foxpro',
    22: 'go',
    23: 'groovy',
    24: 'html',
    25: 'htmlbars',
    26: 'http',
    27: 'haskell',
    28: 'json',
    29: 'java',
    30: 'javascript',
    31: 'julia',
    32: 'kotlin',
    33: 'latex',
    34: 'lisp',
    35: 'logo',
    36: 'lua',
    37: 'matlab',
    38: 'makefile',
    39: 'markdown',
    40: 'nginx',
    41: 'objectivec',
    42: 'openedgeabl',
    43: 'perl',
    44: 'php',
    45: 'pascal',
    46: 'powershell',
    47: 'prolog',
    48: 'protobuf',
    49: 'python',
    50: 'r',
    51: 'rpm',
    52: 'ruby',
    53: 'rust',
    54: 'sas',
    55: 'scala',
    56: 'scheme',
    57: 'scss',
    58: 'shell',
    59: 'sql',
    60: 'swift',
    61: 'thrift',
    62: 'typescript',
    63: 'vbscript',
    64: 'visual_basic',
    65: 'xml',
    66: 'yaml',
    67: 'cmake',
    68: 'diff',
    69: 'gams',
    70: 'gaussl',
    71: 'gherkin',
    72: 'ini',
    73: 'jinja2',
    74: 'json5',
    75: 'lasso',
    76: 'livescript',
    77: 'mipsasm',
    78: 'modelica',
    79: 'octave',
    80: 'pf',
    81: 'pgsql',
    82: 'reasonml',
    83: 'solidity',
    84: 'stata',
    85: 'stylus',
    86: 'tcl',
    87: 'toml',
    88: 'twig',
    89: 'verilog',
    90: 'vue',
};
//# sourceMappingURL=index.js.map