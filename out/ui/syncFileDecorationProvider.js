"use strict";
/**
 * syncFileDecorationProvider.ts
 * 文件装饰器 — 为统一知识树中的节点渲染 A/M/D 差异状态徽标
 *
 * 设计灵感类似 VS Code Git SCM 侧边栏的版本状态标记。
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
exports.SyncFileDecorationProvider = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
/** 为 TreeView 中的节点提供视觉装饰（颜色 + 徽标字母） */
class SyncFileDecorationProvider {
    constructor() {
        this._onDidChangeFileDecorations = new vscode.EventEmitter();
        this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
        /** 存储每个节点 URI 对应的同步状态 */
        this.statusMap = new Map();
    }
    /**
     * 更新节点的同步状态
     */
    setStatus(uri, status) {
        this.statusMap.set(uri.toString(), status);
        this._onDidChangeFileDecorations.fire(uri);
    }
    /**
     * 批量更新多个节点的状态
     */
    setStatuses(entries) {
        const uris = [];
        for (const { uri, status } of entries) {
            this.statusMap.set(uri.toString(), status);
            uris.push(uri);
        }
        this._onDidChangeFileDecorations.fire(uris);
    }
    /**
     * 清空所有状态
     */
    clear() {
        this.statusMap.clear();
    }
    provideFileDecoration(uri) {
        const status = this.statusMap.get(uri.toString());
        if (!status || status === types_1.SyncNodeStatus.SYNCED) {
            return undefined;
        }
        switch (status) {
            case types_1.SyncNodeStatus.ADDED:
                return {
                    badge: 'A',
                    color: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
                    tooltip: '云端新增，尚未同步到本地',
                };
            case types_1.SyncNodeStatus.MODIFIED:
                return {
                    badge: 'M',
                    color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
                    tooltip: '云端已更新，本地版本落后',
                };
            case types_1.SyncNodeStatus.DELETED:
                return {
                    badge: 'D',
                    color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
                    tooltip: '云端已删除，本地仍保留',
                };
            default:
                return undefined;
        }
    }
}
exports.SyncFileDecorationProvider = SyncFileDecorationProvider;
//# sourceMappingURL=syncFileDecorationProvider.js.map