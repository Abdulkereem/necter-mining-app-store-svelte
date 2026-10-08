import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
// @ts-expect-error plain ESM helpers without type declarations
import { localCsp, webCsp } from '../../deploy/csp.mjs';
// @ts-expect-error plain ESM helpers without type declarations
import { externalizeBoot } from '../../scripts/externalize-boot.js';

const root = process.cwd();

describe('content security policy', () => {
	it('local policy is PLATFORM.md errata E8 verbatim', () => {
		expect(localCsp('https://testnet-rpc.necter.network')).toBe(
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; " +
				"connect-src 'self' https://testnet-rpc.necter.network wss://testnet-rpc.necter.network; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
		);
	});

	it('nginx serves webCsp() and never allows inline scripts or external fonts/styles', () => {
		const conf = readFileSync(resolve(root, 'deploy/security-headers.conf'), 'utf8');
		const m = /add_header Content-Security-Policy "([^"]+)" always;/.exec(conf);
		expect(m?.[1]).toBe(webCsp());
		const directives = Object.fromEntries(
			m![1].split(';').map((d) => {
				const [k, ...v] = d.trim().split(/\s+/);
				return [k, v];
			})
		);
		expect(directives['script-src']).toEqual(["'self'"]);
		expect(directives['font-src']).toEqual(["'self'"]);
		expect(directives['style-src']).toEqual(["'self'", "'unsafe-inline'"]);
		// Every location includes the headers (a location with its own add_header drops server-level ones).
		const nginx = readFileSync(resolve(root, 'deploy/nginx.conf'), 'utf8');
		const locations = nginx.match(/location [^{]+\{[^}]*\}/g) ?? [];
		expect(locations.length).toBeGreaterThan(0);
		for (const l of locations) expect(l).toContain('include /etc/nginx/snippets/security-headers.conf;');
	});

	it('app.html loads nothing from third-party hosts', () => {
		const html = readFileSync(resolve(root, 'src/app.html'), 'utf8');
		expect(html).not.toMatch(/https?:\/\//);
		expect(html).not.toMatch(/<script/);
	});
});

describe('externalizeBoot', () => {
	const boot = `
			<script>
				{
					__sveltekit_x = { base: "" };
					const element = document.currentScript.parentElement;
					Promise.all([import("/_app/immutable/entry/start.js"), import("/_app/immutable/entry/app.js")]).then(([kit, app]) => kit.start(app, element));
				}
			</script>`;

	it('moves the inline boot script to a hashed file and leaves no inline script', () => {
		const dir = mkdtempSync(join(tmpdir(), 'boot-'));
		mkdirSync(join(dir, 'a'));
		writeFileSync(join(dir, 'index.html'), `<html><body><div>${boot}</div></body></html>`);
		writeFileSync(join(dir, 'a', 'page.html'), `<html><body><div>${boot}</div></body></html>`);
		expect(externalizeBoot(dir)).toBe(2);
		const html = readFileSync(join(dir, 'index.html'), 'utf8');
		expect(html).toMatch(/<script src="\/_app\/immutable\/boot\.[0-9a-f]{12}\.js"><\/script>/);
		expect(html).not.toContain('__sveltekit_x');
		const files = readdirSync(join(dir, '_app/immutable')).filter((f) => f.startsWith('boot.'));
		expect(files).toHaveLength(1); // identical scripts share one file
		expect(readFileSync(join(dir, '_app/immutable', files[0]), 'utf8')).toContain('document.currentScript.parentElement');
	});

	it('refuses page-relative imports', () => {
		const dir = mkdtempSync(join(tmpdir(), 'boot-'));
		writeFileSync(join(dir, 'index.html'), `<div><script>import("./_app/x.js")</script></div>`);
		expect(() => externalizeBoot(dir)).toThrow(/relative imports/);
	});
});
