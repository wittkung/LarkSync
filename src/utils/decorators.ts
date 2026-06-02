import { logger } from '../logger';

/**
 * 记录方法执行时间的装饰器 (AOP)
 * @param label 可选的自定义标签
 */
export function LogExecutionTime(label?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const start = Date.now();
            const methodName = label || propertyKey;

            try {
                const result = await originalMethod.apply(this, args);
                const duration = Date.now() - start;
                logger.debug(`[AOP] ${methodName} executed in ${duration}ms`);
                return result;
            } catch (error) {
                const duration = Date.now() - start;
                logger.debug(`[AOP] ${methodName} failed after ${duration}ms`);
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * 捕获并记录错误的装饰器 (AOP)
 * @param defaultReturn 发生错误时的默认返回值
 * @param rethrow 是否重新抛出错误
 */
export function CatchAndLog(defaultReturn: any = null, rethrow: boolean = false) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            try {
                return await originalMethod.apply(this, args);
            } catch (error: any) {
                logger.error(`[AOP] Error in ${propertyKey}: ${error.message}`, error);
                if (rethrow) {
                    throw error;
                }
                return defaultReturn;
            }
        };

        return descriptor;
    };
}

/**
 * 自动重试的装饰器 (AOP)
 * @param maxRetries 最大重试次数
 * @param delayMs 每次重试的延迟时间(ms)
 */
export function Retry(maxRetries: number = 3, delayMs: number = 1000) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            let attempt = 0;
            while (attempt < maxRetries) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error: any) {
                    attempt++;
                    if (attempt >= maxRetries) {
                        logger.error(
                            `[AOP] Method ${propertyKey} failed after ${maxRetries} attempts.`
                        );
                        throw error;
                    }
                    logger.warn(
                        `[AOP] Retry ${attempt}/${maxRetries} for ${propertyKey} due to: ${error.message}`
                    );
                    await new Promise(res => setTimeout(res, delayMs));
                }
            }
        };

        return descriptor;
    };
}
