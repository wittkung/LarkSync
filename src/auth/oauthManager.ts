/**
 * oauthManager.ts
 * OAuth 2.0 Authorization Code Flow + PKCE 管理器
 *
 * 流程概述：
 * 1. 生成随机 code_verifier 和 code_challenge (S256)
 * 2. 使用 vscode.env.openExternal 打开飞书授权页面
 * 3. 通过 vscode.window.registerUriHandler 接收回调 code
 * 4. 用 code + code_verifier 交换 user_access_token
 * 5. 安全存储 token 到 TokenStore
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import axios from 'axios';

import { TokenStore } from './tokenStore';
import { logger } from '../logger';
import { CONSTANTS } from '../utils/constants';

/** OAuth 回调等待超时（秒） */
const AUTH_TIMEOUT_SEC = 120;

export class OAuthManager implements vscode.UriHandler {
    private tokenStore: TokenStore;
    /** PKCE code_verifier（登录过程中临时持有） */
    private pendingVerifier: string | null = null;
    /** 授权回调 resolve 函数 */
    private pendingResolve: ((code: string) => void) | null = null;
    private pendingReject: ((err: Error) => void) | null = null;

    constructor(tokenStore: TokenStore) {
        this.tokenStore = tokenStore;
    }

    // ========================================================
    // URI Handler — 接收飞书授权回调
    // ========================================================

    /**
     * 处理 vscode://larksync/callback?code=xxx 回调
     */
    handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
        const query = new URLSearchParams(uri.query);
        const code = query.get('code');

        if (code && this.pendingResolve) {
            logger.info('收到 OAuth 授权码回调。');
            this.pendingResolve(code);
            this.pendingResolve = null;
            this.pendingReject = null;
        } else if (this.pendingReject) {
            this.pendingReject(new Error('授权回调中未包含 code 参数。'));
            this.pendingResolve = null;
            this.pendingReject = null;
        }
    }

    // ========================================================
    // 登录流程
    // ========================================================

    /**
     * 发起 OAuth 2.0 + PKCE 登录
     */
    public async login(): Promise<boolean> {
        const config = vscode.workspace.getConfiguration('larksync');
        const appId = config.get<string>('appId');

        if (!appId) {
            vscode.window.showErrorMessage('LarkSync: 请先在设置中配置 App ID。');
            return false;
        }

        try {
            // Step 1: 生成 PKCE 参数
            const codeVerifier = this.generateCodeVerifier();
            const codeChallenge = this.generateCodeChallenge(codeVerifier);
            this.pendingVerifier = codeVerifier;

            // Step 2: 构建授权 URL
            const redirectUri = `${vscode.env.uriScheme}://kevintu.larksync/callback`;
            const state = crypto.randomBytes(16).toString('hex');
            const authUrl =
                `${CONSTANTS.FEISHU_API_BASE}/authen/v1/authorize` +
                `?app_id=${appId}` +
                `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                `&response_type=code` +
                `&state=${state}` +
                `&code_challenge=${codeChallenge}` +
                `&code_challenge_method=S256`;

            // Step 3: 打开浏览器
            logger.info('打开飞书授权页面...');
            await vscode.env.openExternal(vscode.Uri.parse(authUrl));

            // Step 4: 等待回调
            const code = await this.waitForAuthCode();

            // Step 5: 用 code 交换 token
            await this.exchangeCodeForToken(code, codeVerifier, redirectUri);

            vscode.window.showInformationMessage('LarkSync: 登录成功！');
            logger.info('OAuth 登录成功。');
            return true;
        } catch (err: any) {
            logger.error(`OAuth 登录失败: ${err.message}`);
            vscode.window.showErrorMessage(`LarkSync 登录失败: ${err.message}`);
            return false;
        } finally {
            this.pendingVerifier = null;
        }
    }

    /**
     * 登出 — 清除所有本地凭证
     */
    public async logout(): Promise<void> {
        await this.tokenStore.clearAll();
        vscode.window.showInformationMessage('LarkSync: 已登出。');
        logger.info('用户已登出，凭证已清除。');
    }

    // ========================================================
    // Token 刷新
    // ========================================================

    /**
     * 获取有效的 user_access_token，如果即将过期则自动刷新
     */
    public async getValidUserToken(): Promise<string | null> {
        const token = await this.tokenStore.getUserToken();
        if (!token) return null;

        // 检查是否即将过期
        if (await this.tokenStore.isTokenExpiringSoon()) {
            logger.info('user_access_token 即将过期，尝试刷新...');
            const refreshed = await this.refreshUserToken();
            if (!refreshed) {
                logger.warn('Token 刷新失败，需要重新登录。');
                return null;
            }
            return (await this.tokenStore.getUserToken()) ?? null;
        }

        return token;
    }

    /**
     * 使用 refresh_token 刷新 user_access_token
     */
    private async refreshUserToken(): Promise<boolean> {
        const refreshToken = await this.tokenStore.getRefreshToken();
        if (!refreshToken) return false;

        const config = vscode.workspace.getConfiguration('larksync');
        const appId = config.get<string>('appId') || '';
        const appSecret = config.get<string>('appSecret') || '';

        try {
            const response = await axios.post(
                `${CONSTANTS.FEISHU_API_BASE}/authen/v1/oidc/refresh_access_token`,
                {
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                },
                {
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        Authorization: `Bearer ${await this.getAppAccessToken(appId, appSecret)}`
                    }
                }
            );

            const data = response.data?.data;
            if (data?.access_token) {
                await this.tokenStore.setUserToken(data.access_token);
                if (data.refresh_token) {
                    await this.tokenStore.setRefreshToken(data.refresh_token);
                }
                const expiresIn = data.expires_in || 7200;
                await this.tokenStore.setTokenExpiry(Date.now() + expiresIn * 1000);
                logger.info('user_access_token 已刷新。');
                return true;
            }
            return false;
        } catch (err: any) {
            logger.error(`Token 刷新请求失败: ${err.message}`);
            return false;
        }
    }

    // ========================================================
    // 内部辅助方法
    // ========================================================

    /**
     * 等待授权回调中的 code（带超时）
     */
    private waitForAuthCode(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.pendingResolve = resolve;
            this.pendingReject = reject;

            setTimeout(() => {
                if (this.pendingReject) {
                    this.pendingReject(new Error(`授权超时（${AUTH_TIMEOUT_SEC}秒内未收到回调）`));
                    this.pendingResolve = null;
                    this.pendingReject = null;
                }
            }, AUTH_TIMEOUT_SEC * 1000);
        });
    }

    /**
     * 用授权码交换 user_access_token
     */
    private async exchangeCodeForToken(
        code: string,
        codeVerifier: string,
        redirectUri: string
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('larksync');
        const appId = config.get<string>('appId') || '';
        const appSecret = config.get<string>('appSecret') || '';

        const response = await axios.post(
            `${CONSTANTS.FEISHU_API_BASE}/authen/v1/oidc/access_token`,
            {
                grant_type: 'authorization_code',
                code,
                code_verifier: codeVerifier,
                redirect_uri: redirectUri
            },
            {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    Authorization: `Bearer ${await this.getAppAccessToken(appId, appSecret)}`
                }
            }
        );

        const data = response.data?.data;
        if (!data?.access_token) {
            throw new Error(`Token 交换失败: ${JSON.stringify(response.data)}`);
        }

        await this.tokenStore.setUserToken(data.access_token);
        if (data.refresh_token) {
            await this.tokenStore.setRefreshToken(data.refresh_token);
        }
        const expiresIn = data.expires_in || 7200;
        await this.tokenStore.setTokenExpiry(Date.now() + expiresIn * 1000);
    }

    /**
     * 获取 app_access_token（用于 OAuth 交换请求的 Authorization header）
     */
    private async getAppAccessToken(appId: string, appSecret: string): Promise<string> {
        const response = await axios.post(CONSTANTS.FEISHU_AUTH_URL, {
            app_id: appId,
            app_secret: appSecret
        });
        return response.data?.tenant_access_token || response.data?.app_access_token || '';
    }

    // ========================================================
    // PKCE 工具方法
    // ========================================================

    /**
     * 生成 128 字节随机 code_verifier
     */
    private generateCodeVerifier(): string {
        return crypto.randomBytes(32).toString('base64url').slice(0, 128);
    }

    /**
     * 基于 code_verifier 生成 S256 code_challenge
     */
    private generateCodeChallenge(verifier: string): string {
        return crypto.createHash('sha256').update(verifier).digest('base64url');
    }
}
