"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.FeishuApiError = exports.FeishuAuthError = exports.LarkSyncError = void 0;
class LarkSyncError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.LarkSyncError = LarkSyncError;
class FeishuAuthError extends LarkSyncError {
    constructor(message) {
        super(`Feishu Auth Error: ${message}`);
    }
}
exports.FeishuAuthError = FeishuAuthError;
class FeishuApiError extends LarkSyncError {
    constructor(message, code = -1, data) {
        super(`Feishu API Error [${code}]: ${message}`);
        this.code = code;
        this.data = data;
    }
}
exports.FeishuApiError = FeishuApiError;
class RateLimitError extends FeishuApiError {
    constructor(message = 'Too Many Requests', code = 429) {
        super(message, code);
    }
}
exports.RateLimitError = RateLimitError;
//# sourceMappingURL=errors.js.map