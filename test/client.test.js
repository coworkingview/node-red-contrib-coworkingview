'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRequest, extractPayload, getJson, UsageError } = require('../lib/client');

const API = 'https://api.example.test';

test('search builds the properties query with defaults', () => {
    const { url } = buildRequest({ operation: 'search', city: 'berlin' }, {}, API);
    assert.equal(url, `${API}/v1/properties?locale=en&city=berlin&pageSize=10&page=1`);
});

test('message properties override the node fields', () => {
    const { url } = buildRequest(
        { operation: 'search', city: 'berlin', locale: 'en', limit: '5' },
        { city: 'madrid', locale: 'es', pricingOptionType: 'private_office', limit: 3 },
        API,
    );
    assert.equal(url, `${API}/v1/properties?locale=es&city=madrid&pageSize=3&page=1&pricingOptionType=private_office`);
});

test('a string payload fills the empty city, and the slug for space', () => {
    assert.match(buildRequest({ operation: 'rates' }, { payload: 'london' }, API).url, /city=london/);
    assert.equal(
        buildRequest({ operation: 'space' }, { payload: 'some-space' }, API).url,
        `${API}/v1/properties/some-space?locale=en`,
    );
});

test('the node field beats the payload', () => {
    assert.match(buildRequest({ operation: 'search', city: 'berlin' }, { payload: 'paris' }, API).url, /city=berlin/);
});

test('rates uppercases the currency, rankings caps the limit at 25', () => {
    assert.match(buildRequest({ operation: 'rates', city: 'berlin', currency: 'usd' }, {}, API).url, /currency=USD/);
    assert.match(buildRequest({ operation: 'rankings', city: 'berlin', limit: '25' }, {}, API).url, /\/v1\/rankings\?.*limit=25/);
    assert.throws(() => buildRequest({ operation: 'rankings', city: 'berlin', limit: '26' }, {}, API), UsageError);
});

test('cities needs nothing but a locale', () => {
    assert.equal(buildRequest({ operation: 'cities', locale: 'de' }, {}, API).url, `${API}/v1/geo/bootstrap?locale=de`);
});

test('bad input fails before any request', () => {
    assert.throws(() => buildRequest({ operation: 'search' }, {}, API), /needs a city/);
    assert.throws(() => buildRequest({ operation: 'nope' }, {}, API), /Unknown operation/);
    assert.throws(() => buildRequest({ operation: 'search', city: 'berlin', locale: 'fr' }, {}, API), /Unknown locale/);
    assert.throws(() => buildRequest({ operation: 'search', city: 'berlin', pricingOptionType: 'desk' }, {}, API), /pricing option/);
    assert.throws(() => buildRequest({ operation: 'search', city: 'new york' }, {}, API), /not a slug/);
    assert.throws(() => buildRequest({ operation: 'rates', city: 'berlin', currency: 'euro' }, {}, API), /ISO 4217/);
});

test('extractPayload unwraps data, and the cities list', () => {
    assert.deepEqual(extractPayload('search', { data: [1, 2], meta: {} }), [1, 2]);
    assert.deepEqual(extractPayload('cities', { data: { cities: [{ slug: 'berlin' }] } }), [{ slug: 'berlin' }]);
    assert.deepEqual(extractPayload('cities', { data: {} }), []);
});

function fakeFetch(status, body) {
    return async () => ({ ok: status < 400, status, statusText: 'x', text: async () => JSON.stringify(body) });
}

test('getJson returns the body and surfaces API problems', async () => {
    const ok = await getJson('u', { fetchImpl: fakeFetch(200, { data: [] }) });
    assert.deepEqual(ok, { statusCode: 200, body: { data: [] } });

    await assert.rejects(getJson('u', { fetchImpl: fakeFetch(404, { title: 'Not found', detail: 'No such city' }) }), (error) => {
        assert.equal(error.statusCode, 404);
        assert.match(error.message, /404: No such city/);
        return true;
    });
});

test('getJson names a network failure', async () => {
    const boom = async () => {
        throw new Error('ECONNREFUSED');
    };
    await assert.rejects(getJson('u', { fetchImpl: boom }), /Could not reach the CoworkingView API: ECONNREFUSED/);
});
