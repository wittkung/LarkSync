/**
 * rateLimiter.ts
 * 全局 API 限流器 — 令牌桶算法 + 指数退避 + Jitter
 *
 * 职责：
 * - 控制飞书 API 调用的全局 QPS（默认 5 QPS）
 * - 在遇到 429 / RateLimitError 时自动指数退避重试
 * - 添加随机 Jitter 防止重试雪崩
 */

import { logger } from '../logger';

/** 限流器配置 */
interface RateLimiterConfig {
    /** 每秒最大请求数（令牌桶容量 & 填充速率） */
    maxQPS: number;
    /** 最大重试次数 */
    maxRetries: number;
    /** 初始退避时间（毫秒） */
    baseDelayMs: number;
    /** 最大退避时间（毫秒） */
    maxDelayMs: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
    maxQPS: 3,
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000
};

/**
 * 令牌桶限流器
 *
 * 每秒按 maxQPS 速率补充令牌，调用前先获取令牌。
 * 桶空时等待至下一个令牌可用。
 */
export class RateLimiter {
    private config: RateLimiterConfig;
    /** 当前可用令牌数 */
    private tokens: number;
    /** 上次补充令牌的时间戳 */
    private lastRefillTime: number;
    /** 等待队列 */
    private waitQueue: Array<() => void> = [];

    constructor(config?: Partial<RateLimiterConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.tokens = this.config.maxQPS;
        this.lastRefillTime = Date.now();
    }

    /**
     * 获取一个令牌（可能需要等待）
     */
    public async acquire(): Promise<void> {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }

        // 令牌不足，计算等待时间
        const waitMs = (1 / this.config.maxQPS) * 1000;
        await this.delay(waitMs);
        this.refill();
        this.tokens = Math.max(0, this.tokens - 1);
    }

    /**
     * 带限流和自动退避重试的执行器
     *
     * @param fn 要执行的异步操作
     * @param retryOnError 判断错误是否应该重试的谓词
     * @returns 操作结果
     */
    public async executeWithRetry<T>(
        fn: () => Promise<T>,
        retryOnError?: (err: any) => boolean
    ): Promise<T> {
        let lastError: any;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            // 获取限流令牌
            await this.acquire();

            try {
                return await fn();
            } catch (err: any) {
                lastError = err;

                // 判断是否应该重试
                const shouldRetry = retryOnError ? retryOnError(err) : this.isRetryableError(err);

                if (!shouldRetry || attempt >= this.config.maxRetries) {
                    throw err;
                }

                // 计算退避时间
                const delayMs = this.calculateBackoff(attempt, err);
                logger.warn(
                    `请求失败 (attempt ${attempt + 1}/${this.config.maxRetries + 1}), ` +
                        `${delayMs}ms 后重试: ${err.message}`
                );
                await this.delay(delayMs);
            }
        }

        throw lastError;
    }

    /**
     * 补充令牌
     */
    private refill(): void {
        const now = Date.now();
        const elapsedSec = (now - this.lastRefillTime) / 1000;
        const newTokens = elapsedSec * this.config.maxQPS;
        this.tokens = Math.min(this.config.maxQPS, this.tokens + newTokens);
        this.lastRefillTime = now;
    }

    /**
     * 判断错误是否可重试
     */
    private isRetryableError(err: any): boolean {
        // 飞书 RateLimitError
        if (err.code === 99991400 || err.name === 'RateLimitError') return true;
        // HTTP 429
        if (err.response?.status === 429) return true;
        // HTTP 5xx 服务端错误
        if (err.response?.status >= 500) return true;
        // 网络超时
        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return true;
        return false;
    }

    /**
     * 计算指数退避 + Jitter
     *
     * 如果响应头包含 retry-after，优先使用。
     */
    private calculateBackoff(attempt: number, err: any): number {
        // 优先检查 retry-after header
        const retryAfter = err.response?.headers?.['retry-after'];
        if (retryAfter) {
            const retryAfterMs = parseInt(retryAfter, 10) * 1000;
            if (!isNaN(retryAfterMs) && retryAfterMs > 0) {
                return retryAfterMs;
            }
        }

        // 指数退避: baseDelay * 2^attempt
        const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt);
        // 加上随机 Jitter（0~50% 的基础延迟）
        const jitter = Math.random() * this.config.baseDelayMs * 0.5;
        // 不超过最大延迟
        return Math.min(exponentialDelay + jitter, this.config.maxDelayMs);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/** 全局限流器单例 */
export const globalRateLimiter = new RateLimiter();
