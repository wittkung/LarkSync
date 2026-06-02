import * as assert from 'assert';
import { suite, test } from 'mocha';
import { LogExecutionTime, CatchAndLog, Retry } from '../../utils/decorators';

class TestClass {
    @LogExecutionTime('Test Method')
    public testMethod() {
        return 'success';
    }

    @CatchAndLog('Error Method')
    public errorMethod() {
        throw new Error('Test Error');
    }

    public retryCount = 0;
    @Retry(3, 10)
    public async retryMethod() {
        this.retryCount++;
        if (this.retryCount < 3) {
            throw new Error('Temporary Error');
        }
        return 'success';
    }
}

suite('Decorators Test Suite', () => {
    test('LogExecutionTime should not alter return value', async () => {
        const instance = new TestClass();
        assert.strictEqual(await instance.testMethod(), 'success');
    });

    test('CatchAndLog should swallow error', () => {
        const instance = new TestClass();
        assert.doesNotThrow(() => {
            instance.errorMethod();
        });
    });

    test('Retry should eventually succeed', async () => {
        const instance = new TestClass();
        const result = await instance.retryMethod();
        assert.strictEqual(result, 'success');
        assert.strictEqual(instance.retryCount, 3);
    });
});
