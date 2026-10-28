'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

/** Just enough of the Node-RED runtime to load the node and feed it a message. */
function load() {
    let Ctor;
    const RED = {
        nodes: {
            createNode(node) {
                EventEmitter.call(node);
                Object.assign(node, EventEmitter.prototype, { statuses: [], status: (s) => node.statuses.push(s) });
            },
            registerType(type, ctor) {
                assert.equal(type, 'coworkingview');
                Ctor = ctor;
            },
        },
    };
    require('../nodes/coworkingview')(RED);
    return (config) => new Ctor(config);
}

function input(node, msg) {
    return new Promise((resolve) => {
        const sent = [];
        node.emit('input', msg, (m) => sent.push(m), (error) => resolve({ sent, error }));
    });
}

test('a message flows through to the API and back', async (t) => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ slug: 'a' }], meta: { page: 1 } }) };
    });
    const node = load()({ operation: 'search', city: '', locale: 'en' });
    const { sent, error } = await input(node, { payload: 'berlin' });

    assert.equal(error, undefined);
    assert.match(calls[0].url, /\/v1\/properties\?locale=en&city=berlin/);
    assert.match(calls[0].init.headers['user-agent'], /^node-red-contrib-coworkingview\//);
    assert.deepEqual(sent[0].payload, [{ slug: 'a' }]);
    assert.equal(sent[0].statusCode, 200);
    assert.deepEqual(sent[0].coworkingview.meta, { page: 1 });
    assert.equal(node.statuses.at(-1).text, '1 results');
});

test('an API error goes to done() and nothing is sent', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify({ title: 'Not found' }),
    }));
    const node = load()({ operation: 'space', slug: 'gone' });
    const msg = {};
    const { sent, error } = await input(node, msg);

    assert.equal(sent.length, 0);
    assert.match(error.message, /404/);
    assert.equal(msg.statusCode, 404);
});

test('bad input never calls the API', async (t) => {
    const spy = t.mock.method(globalThis, 'fetch', async () => {
        throw new Error('should not be called');
    });
    const node = load()({ operation: 'search' });
    const { error } = await input(node, {});

    assert.match(error.message, /needs a city/);
    assert.equal(spy.mock.callCount(), 0);
});
