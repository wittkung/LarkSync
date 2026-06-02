import * as assert from 'assert';
import { suite, test, setup, teardown } from 'mocha';
import * as sinon from 'sinon';
import { TreeDiffEngine } from '../../core/treeDiffEngine';
import { FeishuClient } from '../../api/feishuClient';
import { WikiNode } from '../../types';

suite('TreeDiffEngine Test Suite', () => {
    let client: FeishuClient;
    let diffEngine: TreeDiffEngine;

    setup(() => {
        client = new FeishuClient();
        diffEngine = new TreeDiffEngine(client, 'space123');
    });

    teardown(() => {
        sinon.restore();
    });

    test('should fetch full tree when cache is empty', async () => {
        const cachedNodes: WikiNode[] = [];

        sinon.stub(client, 'fetchWikiNodes').resolves({
            items: [
                {
                    node_token: 'n1',
                    obj_token: 'o1',
                    obj_type: 'doc',
                    title: 'New Doc',
                    parent_node_token: '',
                    has_child: false
                } as any
            ],
            has_more: false,
            page_token: ''
        });

        const result = await diffEngine.diffAndMerge(cachedNodes);

        assert.strictEqual(result.addedNodes.length, 1);
        assert.strictEqual(result.addedNodes[0].obj_token, 'o1');
        assert.strictEqual(result.deletedNodeTokens.length, 0);
        assert.strictEqual(result.isTreeComplete, true);
    });

    test('should handle tree diff correctly', async () => {
        const cachedNodes: WikiNode[] = [
            {
                node_token: 'n1',
                obj_token: 'o1',
                obj_type: 'doc',
                title: 'Old Doc',
                parent_node_token: '',
                has_child: false
            }
        ] as any;

        sinon.stub(client, 'fetchWikiNodes').resolves({
            items: [
                {
                    node_token: 'n2',
                    obj_token: 'o2',
                    obj_type: 'doc',
                    title: 'New Doc',
                    parent_node_token: '',
                    has_child: false
                } as any
            ],
            has_more: false,
            page_token: ''
        });

        const result = await diffEngine.diffAndMerge(cachedNodes);

        assert.strictEqual(result.addedNodes.length, 1);
        assert.strictEqual(result.addedNodes[0].node_token, 'n2');
        assert.strictEqual(result.deletedNodeTokens.length, 1);
        assert.strictEqual(result.deletedNodeTokens[0], 'n1');
    });
});
