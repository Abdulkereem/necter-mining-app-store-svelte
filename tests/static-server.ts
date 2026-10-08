/**
 * Test-only static server for the built store, sending the production Content-Security-Policy on every response.
 *
 *   web   build/web   on WEB_PORT   with deploy/csp.mjs webCsp(HUB)   (what nginx sends)
 *   local build/local on LOCAL_PORT with deploy/csp.mjs localCsp(HUB) (exactly what the miner sends, errata E8)
 *
 * Local mode mirrors the miner (miner-core.md §7): `/rpc/*` proxies to the Hub, `/api/v1/*` is the local miner API
 * (answered with 404 here: "no miner session"), everything else is the SPA with an index.html fallback.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
// @ts-expect-error plain ESM module without type declarations
import { localCsp, webCsp } from '../deploy/csp.mjs';

const HUB = process.env.HUB_URL ?? 'http://127.0.0.1:4517';
const TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.webp': 'image/webp',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.txt': 'text/plain; charset=utf-8',
	'.ico': 'image/x-icon'
};

function serveFile(root: string, path: string, res: ServerResponse, headers: Record<string, string>) {
	const rel = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '');
	let file = join(root, rel);
	if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
	res.writeHead(200, { ...headers, 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
	res.end(readFileSync(file));
}

async function proxy(req: IncomingMessage, res: ServerResponse, target: string, headers: Record<string, string>) {
	const chunks: Buffer[] = [];
	for await (const c of req) chunks.push(c as Buffer);
	const h = new Headers();
	for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string' && k !== 'host') h.set(k, v);
	const r = await fetch(target, {
		method: req.method,
		headers: h,
		body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : Buffer.concat(chunks)
	});
	const out: Record<string, string> = { ...headers };
	r.headers.forEach((v, k) => {
		if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) out[k] = v;
	});
	res.writeHead(r.status, out);
	res.end(Buffer.from(await r.arrayBuffer()));
}

function start(mode: 'web' | 'local', port: number) {
	const root = resolve(process.cwd(), `build/${mode}`);
	if (!existsSync(join(root, 'index.html'))) throw new Error(`${root} is not built`);
	const csp = mode === 'local' ? localCsp(HUB) : webCsp(HUB);
	const headers = { 'content-security-policy': csp, 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' };
	createServer(async (req, res) => {
		const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
		try {
			if (mode === 'local' && (url.pathname === '/rpc' || url.pathname.startsWith('/rpc/'))) {
				return await proxy(req, res, HUB + (url.pathname.slice(4) || '/') + url.search, headers);
			}
			if (mode === 'local' && url.pathname.startsWith('/api/v1/')) {
				res.writeHead(404, { ...headers, 'content-type': 'application/json' });
				return res.end(JSON.stringify({ error: 'not_found', message: 'no miner in this test server' }));
			}
			serveFile(root, url.pathname, res, headers);
		} catch (e) {
			res.writeHead(502, { 'content-type': 'text/plain' });
			res.end(String(e));
		}
	}).listen(port, '127.0.0.1', () => console.log(`${mode} build on http://127.0.0.1:${port}`));
}

if (process.env.WEB_PORT) start('web', Number(process.env.WEB_PORT));
if (process.env.LOCAL_PORT) start('local', Number(process.env.LOCAL_PORT));
