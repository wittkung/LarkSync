export class LarkSyncError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class FeishuAuthError extends LarkSyncError {
    constructor(message: string) {
        super(`Feishu Auth Error: ${message}`);
    }
}

export class FeishuApiError extends LarkSyncError {
    public readonly code: number;
    public readonly data?: any;

    constructor(message: string, code: number = -1, data?: any) {
        super(`Feishu API Error [${code}]: ${message}`);
        this.code = code;
        this.data = data;
    }
}

export class RateLimitError extends FeishuApiError {
    constructor(message: string = 'Too Many Requests', code: number = 429) {
        super(message, code);
    }
}
