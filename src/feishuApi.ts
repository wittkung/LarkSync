import axios from 'axios';
import * as vscode from 'vscode';

let tenantAccessToken = '';
let tokenExpirationTime = 0;

export async function getTenantAccessToken(): Promise<string> {
    const now = Date.now();
    if (tenantAccessToken && now < tokenExpirationTime) {
        return tenantAccessToken;
    }

    const config = vscode.workspace.getConfiguration('larksync');
    const appId = config.get<string>('appId');
    const appSecret = config.get<string>('appSecret');

    if (!appId || !appSecret) {
        throw new Error('Feishu App ID or App Secret is not configured. Please set them in VS Code settings (LarkSync).');
    }

    try {
        const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            app_id: appId,
            app_secret: appSecret
        });

        if (response.data.code === 0) {
            tenantAccessToken = response.data.tenant_access_token;
            // Token usually expires in 2 hours (7200 seconds). We refresh 5 minutes earlier.
            tokenExpirationTime = now + (response.data.expire - 300) * 1000;
            return tenantAccessToken;
        } else {
            throw new Error(`Failed to get tenant access token: ${response.data.msg}`);
        }
    } catch (error: any) {
        throw new Error(`Feishu Auth API Error: ${error.message}`);
    }
}
