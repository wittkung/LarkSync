"use strict";
/**
 * stateManager.ts
 * 同步状态管理器 — 使用 vscode.workspace.fs 实现 Remote Dev 兼容
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
exports.StateManager = void 0;
const vscode = __importStar(require("vscode"));
const constants_1 = require("../utils/constants");
class StateManager {
    constructor(rootUri) {
        this.state = {};
        this.stateUri = vscode.Uri.joinPath(rootUri, constants_1.CONSTANTS.STATE_FILE_NAME);
    }
    /**
     * 从工作区文件系统加载同步状态
     */
    async loadState() {
        try {
            const data = await vscode.workspace.fs.readFile(this.stateUri);
            const text = Buffer.from(data).toString('utf-8');
            this.state = JSON.parse(text);
        }
        catch {
            // 状态文件不存在或损坏，使用空状态
            this.state = {};
        }
    }
    /**
     * 将当前状态持久化写入工作区文件系统
     */
    async saveState() {
        const content = JSON.stringify(this.state, null, 2);
        const data = Buffer.from(content, 'utf-8');
        await vscode.workspace.fs.writeFile(this.stateUri, data);
    }
    getDocState(documentId) {
        return this.state[documentId];
    }
    updateDocState(documentId, timestamp, cloudEditTime) {
        this.state[documentId] = {
            lastSyncTime: timestamp,
            cloudEditTime: cloudEditTime,
        };
    }
    isDocUnchanged(documentId, cloudEditTime) {
        const docState = this.getDocState(documentId);
        if (!docState)
            return false;
        if (cloudEditTime && docState.cloudEditTime === cloudEditTime) {
            return true;
        }
        if (!cloudEditTime && (Date.now() - docState.lastSyncTime < constants_1.CONSTANTS.FALLBACK_CACHE_TTL_MS)) {
            return true;
        }
        return false;
    }
}
exports.StateManager = StateManager;
//# sourceMappingURL=stateManager.js.map