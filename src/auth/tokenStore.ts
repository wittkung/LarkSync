/**
 * tokenStore.ts
 * 安全凭证存储 — 基于 VS Code SecretStorage API
 *
 * 职责：
 * - 安全持久化 user_access_token 和 refresh_token
 * - 利用 context.secrets 加密存储，自动随 VS Code 账户同步
 * - 提供 token 读/写/删除接口
 */

import * as vscode from 'vscode';

const KEY_USER_TOKEN = 'larksync.userAccessToken';
const KEY_REFRESH_TOKEN = 'larksync.refreshToken';
const KEY_TOKEN_EXPIRY = 'larksync.tokenExpiryTime';

export class TokenStore {
    private secrets: vscode.SecretStorage;

    constructor(secrets: vscode.SecretStorage) {
        this.secrets = secrets;
    }

    // --- User Access Token ---

    public async getUserToken(): Promise<string | undefined> {
        return this.secrets.get(KEY_USER_TOKEN);
    }

    public async setUserToken(token: string): Promise<void> {
        await this.secrets.store(KEY_USER_TOKEN, token);
    }

    // --- Refresh Token ---

    public async getRefreshToken(): Promise<string | undefined> {
        return this.secrets.get(KEY_REFRESH_TOKEN);
    }

    public async setRefreshToken(token: string): Promise<void> {
        await this.secrets.store(KEY_REFRESH_TOKEN, token);
    }

    // --- Token 过期时间（Unix 时间戳） ---

    public async getTokenExpiry(): Promise<number | undefined> {
        const val = await this.secrets.get(KEY_TOKEN_EXPIRY);
        return val ? parseInt(val, 10) : undefined;
    }

    public async setTokenExpiry(expiryTimestamp: number): Promise<void> {
        await this.secrets.store(KEY_TOKEN_EXPIRY, expiryTimestamp.toString());
    }

    /**
     * 检查当前 token 是否即将过期（提前 5 分钟刷新）
     */
    public async isTokenExpiringSoon(): Promise<boolean> {
        const expiry = await this.getTokenExpiry();
        if (!expiry) return true;
        const marginMs = 5 * 60 * 1000; // 5 分钟提前量
        return Date.now() >= expiry - marginMs;
    }

    // --- 清除所有凭证 ---

    public async clearAll(): Promise<void> {
        await this.secrets.delete(KEY_USER_TOKEN);
        await this.secrets.delete(KEY_REFRESH_TOKEN);
        await this.secrets.delete(KEY_TOKEN_EXPIRY);
    }

    /**
     * 检查是否已登录（存在有效 token）
     */
    public async isLoggedIn(): Promise<boolean> {
        const token = await this.getUserToken();
        return !!token;
    }
}
