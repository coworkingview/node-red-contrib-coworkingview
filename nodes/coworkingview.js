'use strict';

const { DEFAULT_API, buildRequest, extractPayload, getJson } = require('../lib/client');
const pkg = require('../package.json');

const USER_AGENT = `${pkg.name}/${pkg.version} (+https://coworkingview.com)`;

module.exports = function (RED) {
    function CoworkingViewNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const apiBase = process.env.COWORKINGVIEW_API || DEFAULT_API;

        node.on('input', async (msg, send, done) => {
            let request;
            try {
                request = buildRequest(config, msg, apiBase);
            } catch (error) {
                node.status({ fill: 'red', shape: 'ring', text: 'bad input' });
                done(error);
                return;
            }

            node.status({ fill: 'blue', shape: 'dot', text: request.operation });
            try {
                const { statusCode, body } = await getJson(request.url, { userAgent: USER_AGENT });
                msg.payload = extractPayload(request.operation, body);
                msg.statusCode = statusCode;
                msg.coworkingview = { operation: request.operation, url: request.url, meta: body.meta };
                const count = Array.isArray(msg.payload) ? `${msg.payload.length} results` : 'ok';
                node.status({ fill: 'green', shape: 'dot', text: count });
                send(msg);
                done();
            } catch (error) {
                msg.statusCode = error.statusCode;
                msg.coworkingview = { operation: request.operation, url: request.url, problem: error.problem };
                node.status({ fill: 'red', shape: 'ring', text: error.statusCode ? String(error.statusCode) : 'error' });
                done(error);
            }
        });

        node.on('close', () => node.status({}));
    }

    RED.nodes.registerType('coworkingview', CoworkingViewNode);
};
