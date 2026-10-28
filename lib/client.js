'use strict';

/**
 * Pure request builder + fetch wrapper for the CoworkingView /v1 catalogue API.
 * Kept free of Node-RED so it can be tested without a runtime. No API key is
 * needed for reads. Never invent a price the API did not return.
 */

const DEFAULT_API = 'https://api.coworkingview.com';
const DEFAULT_TIMEOUT_MS = 15000;

/** Mirror of LocaleSchema in the API contract. */
const LOCALES = ['en', 'de', 'es'];

/** Mirror of the API's pricing option types (`pricingOptionType` on /v1/properties). */
const PRICING_OPTION_TYPES = [
    'private_office',
    'exclusive_bereich',
    'fix_desk',
    'flex_desk',
    'day_pass',
    'meeting_room',
    'virtual_office',
    'event_space',
    'membership',
];

/**
 * `rankings` is not here: /v1/rankings answers 410 Gone in production since
 * before 0.1.0 shipped, so 0.1.0 offered an operation that could never work.
 */
const OPERATIONS = ['search', 'space', 'rates', 'cities'];

const SLUG = /^[a-z0-9-]{1,200}$/;
const CURRENCY = /^[A-Z]{3}$/;

class UsageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UsageError';
    }
}

/** Empty strings, `null` and `undefined` all mean "not set". */
function pick(...values) {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && value.trim() === '') continue;
        return typeof value === 'string' ? value.trim() : value;
    }
    return undefined;
}

function wholeNumber(raw, name, min, max, fallback) {
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new UsageError(`${name} must be a whole number between ${min} and ${max}`);
    }
    return value;
}

function slug(raw, name) {
    const value = String(raw).toLowerCase();
    if (!SLUG.test(value)) {
        throw new UsageError(`${name} "${raw}" is not a slug (e.g. berlin, signature-potsdamer-platz)`);
    }
    return value;
}

/**
 * Resolve the node's settings plus the message's overrides into one request.
 * A message property wins over the node's own field, so one node can serve
 * many cities. A plain-string payload fills the one required field when it is
 * empty: the city for search/rates, the slug for space.
 */
function buildRequest(config, msg = {}, apiBase = DEFAULT_API) {
    const operation = pick(msg.operation, config.operation, 'search');
    if (!OPERATIONS.includes(operation)) {
        throw new UsageError(`Unknown operation "${operation}". One of: ${OPERATIONS.join(', ')}`);
    }

    const locale = pick(msg.locale, config.locale, 'en');
    if (!LOCALES.includes(locale)) {
        throw new UsageError(`Unknown locale "${locale}". One of: ${LOCALES.join(', ')}`);
    }

    const fromPayload = typeof msg.payload === 'string' ? msg.payload : undefined;
    const params = new URLSearchParams({ locale });
    const base = apiBase.replace(/\/$/, '');
    let path;

    if (operation === 'space') {
        const raw = pick(msg.slug, config.slug, fromPayload);
        if (!raw) throw new UsageError('space needs a slug (node field, msg.slug or a string msg.payload)');
        path = `/v1/properties/${encodeURIComponent(slug(raw, 'slug'))}`;
    } else if (operation === 'cities') {
        path = '/v1/geo/bootstrap';
    } else {
        const raw = pick(msg.city, config.city, fromPayload);
        if (!raw) throw new UsageError(`${operation} needs a city (node field, msg.city or a string msg.payload)`);
        params.set('city', slug(raw, 'city'));

        if (operation === 'search') {
            path = '/v1/properties';
            // The API caps pageSize at 50 and answers 400 above it.
            params.set('pageSize', String(wholeNumber(pick(msg.limit, config.limit), 'limit', 1, 50, 10)));
            params.set('page', String(wholeNumber(pick(msg.page, config.page), 'page', 1, 500, 1)));
            const type = pick(msg.pricingOptionType, msg.type, config.pricingOptionType);
            if (type !== undefined) {
                if (!PRICING_OPTION_TYPES.includes(type)) {
                    throw new UsageError(`Unknown pricing option type "${type}". One of: ${PRICING_OPTION_TYPES.join(', ')}`);
                }
                params.set('pricingOptionType', type);
            }
        } else {
            path = '/v1/market/rates';
            const currency = pick(msg.currency, config.currency);
            if (currency !== undefined) {
                const upper = String(currency).toUpperCase();
                if (!CURRENCY.test(upper)) throw new UsageError(`currency "${currency}" is not an ISO 4217 code`);
                params.set('currency', upper);
            }
        }
    }

    return { operation, url: `${base}${path}?${params}` };
}

/** The list endpoints wrap their data; `cities` nests it one level deeper. */
function extractPayload(operation, body) {
    const data = body && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
    if (operation === 'cities') {
        return Array.isArray(data?.cities) ? data.cities : [];
    }
    return data;
}

async function getJson(url, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, userAgent } = {}) {
    let res;
    try {
        res = await fetchImpl(url, {
            headers: { accept: 'application/json', ...(userAgent ? { 'user-agent': userAgent } : {}) },
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
            throw new Error(`CoworkingView API did not answer within ${timeoutMs}ms`);
        }
        throw new Error(`Could not reach the CoworkingView API: ${error?.message ?? error}`);
    }
    const text = await res.text();
    let body;
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`CoworkingView API returned non-JSON (${res.status})`);
    }
    if (!res.ok) {
        const detail = body.detail || body.title || res.statusText;
        const error = new Error(`CoworkingView API ${res.status}: ${detail}`);
        error.statusCode = res.status;
        error.problem = body;
        throw error;
    }
    return { statusCode: res.status, body };
}

module.exports = {
    DEFAULT_API,
    DEFAULT_TIMEOUT_MS,
    LOCALES,
    PRICING_OPTION_TYPES,
    OPERATIONS,
    UsageError,
    buildRequest,
    extractPayload,
    getJson,
};
