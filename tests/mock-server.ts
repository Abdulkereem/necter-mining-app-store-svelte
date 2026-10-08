/**
 * Mock Hub HTTP server for Playwright and local UI work: serves the in-memory mock (src/lib/api/mock/hub.ts)
 * that implements a subset of spec/openapi.yaml. Test-only; never deployed.
 *
 *   MOCK_HUB_PORT=4517 STORE_ORIGIN_HOSTS=127.0.0.1:4518 npx tsx tests/mock-server.ts
 *
 * Extra test endpoint: POST /__mock/reset {"empty": true|false} re-seeds the state.
 */
import { createServer } from 'node:http';
import { createMockHub } from '../src/lib/api/mock/hub';

const port = Number(process.env.MOCK_HUB_PORT ?? 4517);
const allowDomains = (process.env.STORE_ORIGIN_HOSTS ?? '127.0.0.1:4518,localhost:4518').split(',');
const hub = createMockHub({ allowDomains, empty: process.env.MOCK_EMPTY === '1' });

const cors = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': 'Authorization, Content-Type, Accept',
	'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
};

createServer(async (req, res) => {
	const chunks: Buffer[] = [];
	for await (const c of req) chunks.push(c as Buffer);
	const body = Buffer.concat(chunks);
	if (req.method === 'OPTIONS') {
		res.writeHead(204, cors).end();
		return;
	}
	if (req.method === 'POST' && req.url === '/__mock/reset') {
		const opts = body.length ? JSON.parse(body.toString()) : {};
		hub.reset({ empty: !!opts.empty });
		res.writeHead(204, cors).end();
		return;
	}
	const headers = new Headers();
	for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
	const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
		method: req.method,
		headers,
		body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : body
	});
	const response = await hub.handle(request);
	const out: Record<string, string> = { ...cors };
	response.headers.forEach((v, k) => (out[k] = v));
	res.writeHead(response.status, out);
	res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, '127.0.0.1', () => console.log(`mock hub on http://127.0.0.1:${port}`));
