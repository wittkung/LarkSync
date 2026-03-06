"use strict";
/**
 * fileManager.ts
 * 文件管理器 — 使用 vscode.workspace.fs 实现 Remote Dev 兼容
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../logger");
class FileManager {
    constructor(rootUri, nodes = []) {
        this.nodeMap = new Map();
        this.rootUri = rootUri;
        this.initNodeMap(nodes);
    }
    /**
     * 确保根同步目录存在
     */
    async ensureRootDirectory() {
        try {
            await vscode.workspace.fs.createDirectory(this.rootUri);
            logger_1.logger.info(`同步根目录已就绪: ${this.rootUri.fsPath}`);
        }
        catch {
            // 目录已存在
        }
    }
    setNodes(nodes) {
        this.initNodeMap(nodes);
    }
    initNodeMap(nodes) {
        this.nodeMap.clear();
        nodes.forEach(n => this.nodeMap.set(n.node_token, n));
    }
    /**
     * 为知识库节点创建本地目录
     */
    async buildLocalDirectories(nodes) {
        for (const node of nodes) {
            const dirUri = this.getDirectoryUriForNode(node);
            try {
                await vscode.workspace.fs.createDirectory(dirUri);
            }
            catch {
                // 目录已存在
            }
        }
    }
    /**
     * 获取文档在本地文件系统中的 Uri
     */
    getDocLocalUri(doc) {
        const parts = this.buildPathParts(doc);
        parts[parts.length - 1] = this.sanitizeFileName(doc.title) + '.md';
        return vscode.Uri.joinPath(this.rootUri, ...parts);
    }
    /**
     * 获取文档在本地文件系统中的路径字符串（用于日志等场景）
     */
    getDocLocalPath(doc) {
        return this.getDocLocalUri(doc).fsPath;
    }
    /**
     * 检查文件是否存在
     */
    async fileExists(uri) {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 读取文件内容
     */
    async readFile(uri) {
        const data = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(data).toString('utf-8');
    }
    /**
     * 写入文件内容
     */
    async writeFile(uri, content) {
        const data = Buffer.from(content, 'utf-8');
        await vscode.workspace.fs.writeFile(uri, data);
    }
    // --- 路径计算辅助方法 ---
    buildPathParts(node) {
        const parts = [this.sanitizeFileName(node.title)];
        let current = node;
        while (current.parent_node_token && this.nodeMap.has(current.parent_node_token)) {
            current = this.nodeMap.get(current.parent_node_token);
            parts.unshift(this.sanitizeFileName(current.title));
        }
        return parts;
    }
    getDirectoryUriForNode(node) {
        const parts = this.buildPathParts(node);
        // 去掉最后一个部分（节点本身），只保留父目录路径
        const dirParts = parts.slice(0, -1);
        if (dirParts.length === 0) {
            return this.rootUri;
        }
        return vscode.Uri.joinPath(this.rootUri, ...dirParts);
    }
    sanitizeFileName(name) {
        return name.replace(/[\\/:*?"<>|]/g, '_');
    }
}
exports.FileManager = FileManager;
//# sourceMappingURL=fileManager.js.map