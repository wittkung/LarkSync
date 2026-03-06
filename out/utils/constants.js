"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSTANTS = void 0;
exports.CONSTANTS = {
    // API 配置
    FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
    FEISHU_AUTH_URL: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    FEISHU_META_BATCH_QUERY_URL: 'https://open.feishu.cn/open-apis/drive/v1/metas/batch_query',
    // 同步设置
    DEFAULT_SYNC_DIR: 'LarkDocs',
    ASSETS_DIR_NAME: 'assets',
    MAX_META_BATCH_SIZE: 200,
    CONCURRENCY_LIMIT: 3, // 文档同步并发数
    MEDIA_DOWNLOAD_CONCURRENCY: 3, // 图片下载并发数
    // 重试与超时
    MAX_API_RETRIES: 5,
    RETRY_BASE_DELAY_MS: 1500,
    TOKEN_REFRESH_MARGIN_SEC: 300,
    FALLBACK_CACHE_TTL_MS: 43200 * 1000,
    // 文件名与路径
    STATE_FILE_NAME: '.larksync_state.json',
    TREE_CACHE_FILE_NAME: '.larksync_tree.json',
};
//# sourceMappingURL=constants.js.map