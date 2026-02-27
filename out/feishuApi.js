"use strict";
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
exports.getTenantAccessToken = getTenantAccessToken;
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
let tenantAccessToken = '';
let tokenExpirationTime = 0;
async function getTenantAccessToken() {
    const now = Date.now();
    if (tenantAccessToken && now < tokenExpirationTime) {
        return tenantAccessToken;
    }
    const config = vscode.workspace.getConfiguration('larksync');
    const appId = config.get('appId');
    const appSecret = config.get('appSecret');
    if (!appId || !appSecret) {
        throw new Error('Feishu App ID or App Secret is not configured. Please set them in VS Code settings (LarkSync).');
    }
    try {
        const response = await axios_1.default.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            app_id: appId,
            app_secret: appSecret
        });
        if (response.data.code === 0) {
            tenantAccessToken = response.data.tenant_access_token;
            // Token usually expires in 2 hours (7200 seconds). We refresh 5 minutes earlier.
            tokenExpirationTime = now + (response.data.expire - 300) * 1000;
            return tenantAccessToken;
        }
        else {
            throw new Error(`Failed to get tenant access token: ${response.data.msg}`);
        }
    }
    catch (error) {
        throw new Error(`Feishu Auth API Error: ${error.message}`);
    }
}
//# sourceMappingURL=feishuApi.js.map