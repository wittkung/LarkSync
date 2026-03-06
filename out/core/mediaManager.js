"use strict";
/**
 * mediaManager.ts
 * 媒体资源（图片/附件）下载管理器
 *
 * 核心职责：
 * 1. 管理待下载的媒体 Token 队列
 * 2. 本地缓存比对（按 file_token 去重）
 * 3. 使用 p-limit 控制并发下载
 * 4. 计算 Markdown 中的相对路径引用
 */
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
exports.MediaManager = void 0;
const vscode = __importStar(require("vscode"));
const p_limit_1 = __importDefault(require("p-limit"));
const feishuClient_1 = require("../api/feishuClient");
const constants_1 = require("../utils/constants");
const logger_1 = require("../logger");
class MediaManager {
    constructor(rootUri) {
        /** 已下载到本地的 Token 集合（用于跨文档去重） */
        this.downloadedTokens = new Set();
        this.rootUri = rootUri;
        this.assetsUri = vscode.Uri.joinPath(rootUri, constants_1.CONSTANTS.ASSETS_DIR_NAME);
    }
    /**
     * 扫描 assets 目录，初始化已下载 Token 缓存
     */
    async initialize() {
        try {
            const entries = await vscode.workspace.fs.readDirectory(this.assetsUri);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory) {
                    // 扫描每个文档的 assets 子目录
                    const subDir = vscode.Uri.joinPath(this.assetsUri, name);
                    const subEntries = await vscode.workspace.fs.readDirectory(subDir);
                    for (const [fileName] of subEntries) {
                        // 文件名格式：<token>.<ext>
                        const tokenPart = fileName.replace(/\.[^.]+$/, '');
                        this.downloadedTokens.add(tokenPart);
                    }
                }
            }
            logger_1.logger.info(`媒体缓存初始化完成，已有 ${this.downloadedTokens.size} 个资源文件。`);
        }
        catch {
            // assets 目录不存在是正常的初始状态
            logger_1.logger.info('assets 目录尚不存在，将在首次下载时创建。');
        }
    }
    /**
     * 处理一批媒体 Token：检查缓存并下载缺失的资源
     *
     * @param tokens 本次文档转换中收集到的媒体 Token 列表
     * @param docTitle 文档标题（用于创建资产子目录）
     */
    async processTokens(tokens, docTitle) {
        if (tokens.length === 0)
            return;
        const sanitizedTitle = this.sanitizeFileName(docTitle);
        const docAssetsUri = vscode.Uri.joinPath(this.assetsUri, sanitizedTitle);
        // 筛选出需要下载的 Token（排除已缓存的）
        const toDownload = tokens.filter(t => !this.downloadedTokens.has(t.token));
        if (toDownload.length === 0) {
            logger_1.logger.info(`[${docTitle}] 所有 ${tokens.length} 个媒体资源已缓存，跳过下载。`);
            return;
        }
        logger_1.logger.info(`[${docTitle}] 需下载 ${toDownload.length}/${tokens.length} 个媒体资源。`);
        // 确保资产目录存在
        await this.ensureDirectory(docAssetsUri);
        // 使用 p-limit 控制并发下载
        const limit = (0, p_limit_1.default)(constants_1.CONSTANTS.MEDIA_DOWNLOAD_CONCURRENCY);
        const tasks = toDownload.map(entry => limit(async () => {
            try {
                const buffer = await feishuClient_1.feishuClient.downloadMedia(entry.token);
                const ext = this.guessExtension(entry);
                const fileName = entry.name || `${entry.token}${ext}`;
                const fileUri = vscode.Uri.joinPath(docAssetsUri, fileName);
                await vscode.workspace.fs.writeFile(fileUri, buffer);
                this.downloadedTokens.add(entry.token);
                logger_1.logger.info(`  已下载: ${fileName}`);
            }
            catch (err) {
                logger_1.logger.error(`  下载失败 [${entry.token}]: ${err.message}`);
            }
        }));
        await Promise.all(tasks);
    }
    /**
     * 获取已下载的 Token 集合（用于持久化到 manifest）
     */
    getDownloadedTokens() {
        return this.downloadedTokens;
    }
    /**
     * 确保目录存在
     */
    async ensureDirectory(uri) {
        try {
            await vscode.workspace.fs.createDirectory(uri);
        }
        catch {
            // 目录已存在
        }
    }
    /**
     * 根据媒体类型猜测文件扩展名
     */
    guessExtension(entry) {
        if (entry.name) {
            const match = entry.name.match(/\.[^.]+$/);
            if (match)
                return match[0];
        }
        return entry.type === 'image' ? '.png' : '';
    }
    sanitizeFileName(name) {
        return name.replace(/[\\/:*?"<>|]/g, '_');
    }
}
exports.MediaManager = MediaManager;
//# sourceMappingURL=mediaManager.js.map