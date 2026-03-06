// --- API 通用响应 ---
export interface FeishuBaseResponse<T = any> {
    code: number;
    msg: string;
    data: T;
}

// --- 知识库节点树 ---
export type WikiNodeType = 'doc' | 'docx' | 'sheet' | 'mindnote' | 'bitable' | 'file' | 'folder';

export interface WikiNode {
    space_id: string;
    node_token: string;
    obj_token: string;
    obj_type: WikiNodeType;
    parent_node_token: string;
    title: string;
    has_child: boolean;
}

export interface WikiNodeListResponse {
    items: WikiNode[];
    page_token: string;
    has_more: boolean;
}

// --- 文档元数据 ---
export interface DriveMeta {
    doc_token: string;
    doc_type: string;
    title: string;
    latest_modify_time: string; // Unix 时间戳字符串
    // 飞书 API 返回的其他可能字段
    docs_token?: string;
    token?: string;
}

export interface MetaBatchQueryRequest {
    request_docs: {
        doc_token: string;
        doc_type: string;
    }[];
}

export interface MetaBatchQueryResponse {
    metas: any[];
}

// ========================================================
// 飞书 Docx Block 模型 — 完整类型定义
// ========================================================

/**
 * Block Type 枚举值
 * 参考: https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/document-block
 */
export enum BlockType {
    PAGE = 1,
    TEXT = 2,
    HEADING1 = 3,
    HEADING2 = 4,
    HEADING3 = 5,
    HEADING4 = 6,
    HEADING5 = 7,
    HEADING6 = 8,
    HEADING7 = 9,
    HEADING8 = 10,
    HEADING9 = 11,
    BULLET = 12,
    ORDERED = 13,
    CODE = 14,
    QUOTE = 15,
    // 16 预留
    TODO = 17,
    // 18 预留
    CALLOUT = 19,
    CHAT_CARD = 20,
    DIAGRAM = 21,
    DIVIDER = 22,
    FILE = 23,
    GRID = 24,
    GRID_COLUMN = 25,
    IFRAME = 26,
    IMAGE = 27,
    ISV = 28,
    MINDNOTE = 29,
    SHEET = 30,
    TABLE = 31,
    TABLE_CELL = 32,
    VIEW = 33,
    QUOTE_CONTAINER = 34,
    // 35+ 为飞书扩展类型
    TASK = 35,
    OKR = 36,
    OKR_OBJECTIVE = 37,
    OKR_KEY_RESULT = 38,
    OKR_PROGRESS = 39,
    ADD_ONS = 40,
    JIRA_ISSUE = 41,
    WIKI_CATALOG = 42,
    BOARD = 43,
    UNDEFINED = 999,
}

// --- 富文本元素 (TextElement) ---

/** 文本样式属性 */
export interface TextElementStyle {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    inline_code?: boolean;
    /** 超链接 URL */
    link?: {
        url: string;
    };
    /** 文本颜色（飞书预设枚举，如 1~16） */
    text_color?: number;
    /** 背景高亮色 */
    background_color?: number;
}

/** 纯文本运行段 */
export interface TextRun {
    content: string;
    text_element_style?: TextElementStyle;
}

/** @提及用户 */
export interface MentionUser {
    user_id: string;
    text_element_style?: TextElementStyle;
}

/** @提及文档 */
export interface MentionDoc {
    token: string;
    obj_type: number;
    url: string;
    title?: string;
    text_element_style?: TextElementStyle;
}

/** 行内公式 */
export interface Equation {
    content: string;
    text_element_style?: TextElementStyle;
}

/** 文本元素联合体 */
export interface TextElement {
    text_run?: TextRun;
    mention_user?: MentionUser;
    mention_doc?: MentionDoc;
    equation?: Equation;
}

// --- 各 Block 数据子结构 ---

/** 文本类 Block 数据（text, heading, bullet, ordered, quote, todo 共用此结构） */
export interface TextBlockData {
    elements: TextElement[];
    style?: {
        /** 文本对齐方式: 1=左, 2=居中, 3=右 */
        align?: number;
        /** TODO 块的已完成状态 */
        done?: boolean;
        /** 有序列表的折叠状态 */
        folded?: boolean;
        /** 代码块语言枚举 */
        language?: number;
        /** 缩进级别 */
        indent_level?: number;
    };
}

/** 代码块数据 */
export interface CodeBlockData {
    elements: TextElement[];
    style?: {
        language?: number;
        wrap?: boolean;
    };
}

/** 高亮块 (Callout) 数据 */
export interface CalloutBlockData {
    /** Callout 的背景颜色枚举 */
    background_color?: number;
    /** Callout 的边框颜色枚举 */
    border_color?: number;
    /** Callout 的文字颜色枚举 */
    text_color?: number;
    /** Callout 前置的 Emoji */
    emoji_id?: string;
}

/** 图片块数据 */
export interface ImageBlockData {
    width?: number;
    height?: number;
    token: string;
    /** 图片描述/alt 文本 */
    alt?: string;
}

/** 附件文件块数据 */
export interface FileBlockData {
    token: string;
    name?: string;
    /** 文件 MIME 类型 */
    mime_type?: string;
}

/** 表格块数据 */
export interface TableBlockData {
    /** 表格属性 */
    property?: {
        row_size: number;
        column_size: number;
        column_width?: number[];
        /** 合并信息 */
        merge_info?: TableMergeInfo[];
        /** 表头行数 */
        header_row_count?: number;
    };
    cells?: string[]; // 子 Block ID 列表
}

/** 表格合并信息 */
export interface TableMergeInfo {
    row_span: number;
    col_span: number;
}

/** 表格单元格数据 */
export interface TableCellBlockData {
    // 单元格本身通过 children 来持有内部块
    /** 合并信息 */
    merge_info?: {
        row_span: number;
        col_span: number;
    };
}

/** 分栏块数据 */
export interface GridBlockData {
    column_size: number;
}

/** 分栏列数据 */
export interface GridColumnBlockData {
    width_ratio?: number;
}

/** 嵌入页面块数据 */
export interface IframeBlockData {
    component?: {
        url?: string;
        type?: number;
    };
}

/** 分割线块数据（无额外字段） */
export interface DividerBlockData { }

// --- 飞书 Docx Block 核心结构 ---

export interface DocxBlock {
    block_id: string;
    parent_id: string;
    children: string[];
    block_type: number;

    // 各 block_type 对应的数据字段（仅存在于对应类型的块上）
    page?: TextBlockData;
    text?: TextBlockData;
    heading1?: TextBlockData;
    heading2?: TextBlockData;
    heading3?: TextBlockData;
    heading4?: TextBlockData;
    heading5?: TextBlockData;
    heading6?: TextBlockData;
    heading7?: TextBlockData;
    heading8?: TextBlockData;
    heading9?: TextBlockData;
    bullet?: TextBlockData;
    ordered?: TextBlockData;
    code?: CodeBlockData;
    quote?: TextBlockData;
    todo?: TextBlockData;
    callout?: CalloutBlockData;
    divider?: DividerBlockData;
    image?: ImageBlockData;
    file?: FileBlockData;
    table?: TableBlockData;
    table_cell?: TableCellBlockData;
    grid?: GridBlockData;
    grid_column?: GridColumnBlockData;
    iframe?: IframeBlockData;
    quote_container?: {};

    // 扩展属性 — 允许索引访问以兼容未定义的块类型
    [key: string]: any;
}

export interface DocxBlockListResponse {
    items: DocxBlock[];
    page_token: string;
    has_more: boolean;
}

// --- 同步状态 (旧版，保留兼容) ---
export interface SyncStateEntry {
    lastSyncTime: number;
    cloudEditTime?: string;
    revisionId?: number;
    localRelativePath?: string;
}

export interface SyncState {
    [documentId: string]: SyncStateEntry;
}

// --- 同步 Manifest (v2 增强版) ---

/** 单个文档的同步清单条目 */
export interface SyncManifestDocEntry {
    /** 文档 ID */
    documentId: string;
    /** 上次同步时记录的远端 revision_id */
    revisionId?: number;
    /** 上次同步时的云端编辑时间 */
    cloudEditTime?: string;
    /** 上次成功同步的本地时间戳 */
    lastSyncTime: number;
    /** 文档在本地文件系统中映射的相对路径 */
    localRelativePath?: string;
    /** 文档标题 */
    title?: string;
}

/** 同步 Manifest 顶层结构 */
export interface SyncManifest {
    /** 文档清单 (key: document_id) */
    documents: Record<string, SyncManifestDocEntry>;
    /** 已成功下载到本地的媒体 file_token 集合 */
    downloadedMediaTokens: string[];
    /** Manifest 版本号 */
    version: number;
    /** 上次全局同步时间 */
    lastGlobalSyncTime: number;
}

// --- 云端知识树差异状态 ---
export enum SyncNodeStatus {
    /** 已同步且一致 */
    SYNCED = 'synced',
    /** 云端新增，本地尚未同步 */
    ADDED = 'added',
    /** 云端 revision_id 大于本地 manifest */
    MODIFIED = 'modified',
    /** 本地存在但云端已删除 */
    DELETED = 'deleted',
}

// --- 配置 ---
export interface LarkSyncConfig {
    appId: string;
    appSecret: string;
    spaceId: string;
    syncDirectory: string;
    pollingIntervalMinutes: number;
}

// --- AST 转换引擎辅助类型 ---

/** 媒体 Token 收集结果（Worker 返回给主线程） */
export interface MediaTokenEntry {
    token: string;
    /** 文件原始名称（用于 alt 文本或本地文件名） */
    name?: string;
    /** 块类型：image 或 file */
    type: 'image' | 'file';
}

/** Worker 转换结果 */
export interface ConversionResult {
    markdown: string;
    mediaTokens: MediaTokenEntry[];
}

// --- 代码块语言枚举映射 ---
export const CODE_LANGUAGE_MAP: Record<number, string> = {
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
