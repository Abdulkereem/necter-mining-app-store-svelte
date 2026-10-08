/**
 * Both builds under their production CSP (tests/static-server.ts): the local build with exactly the miner's header
 * (PLATFORM.md errata E8: script-src 'self', style-src 'self' 'unsafe-inline', font-src 'self', …) and the web build
 * with deploy/nginx.conf's policy. Every page must boot, render, load its self-hosted fonts and cause zero
 * `securitypolicyviolation` events, zero CSP console errors and zero requests to third-party hosts.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installTestWallet, TEST_ADDRESS } from './wallet';

const HUB = 'http://127.0.0.1:4517';
const ORIGINS = {
	local: 'http://127.0.0.1:4519',
	web: 'http://127.0.0.1:4518'
} as const;
const PAGES = ['/discover', '/explorer', '/mining/hardware-checker', '/develop', '/learn', '/faucet', '/device', '/leaderboards', '/governance'];

type Watch = { violations: string[]; console: string[]; errors: string[]; foreign: string[] };

async function watch(page: Page, origin: string): Promise<Watch> {
	const w: Watch = { violations: [], console: [], errors: [], foreign: [] };
	await page.addInitScript(() => {
		const list: string[] = [];
		(window as unknown as { __csp: string[] }).__csp = list;
		document.addEventListener('securitypolicyviolation', (e) =>
			list.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'} (${e.sourceFile}:${e.lineNumber})`)
		);
	});
	page.on('console', (m) => {
		if (/content security policy|refused to (load|execute|apply|connect)/i.test(m.text())) w.console.push(m.text());
	});
	page.on('pageerror', (e) => w.errors.push(e.message));
	page.on('request', (r) => {
		const u = new URL(r.url());
		if (!['data:', 'blob:'].includes(u.protocol) && u.origin !== origin && u.origin !== HUB) w.foreign.push(r.url());
	});
	return w;
}

async function violations(page: Page): Promise<string[]> {
	return page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
}

async function resetHub() {
	expect((await fetch(`${HUB}/__mock/reset`, { method: 'POST', body: '{}' })).status).toBe(204);
}

for (const mode of ['local', 'web'] as const) {
	test.describe(`${mode} build under its production CSP`, () => {
		const origin = ORIGINS[mode];
		test.use({ baseURL: origin });
		test.beforeEach(resetHub);

		test('sends the expected Content-Security-Policy header', async ({ request }) => {
			const res = await request.get('/discover');
			const csp = res.headers()['content-security-policy'];
			if (mode === 'local') {
				expect(csp).toBe(
					"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; " +
						`connect-src 'self' ${HUB} ${HUB.replace('http', 'ws')}; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`
				);
			} else {
				const nginx = readFileSync(resolve(process.cwd(), 'deploy/security-headers.conf'), 'utf8');
				const prod = /Content-Security-Policy "([^"]+)"/.exec(nginx)![1];
				expect(csp).toBe(prod.replaceAll('https://testnet-rpc.necter.network', HUB).replaceAll('wss://testnet-rpc.necter.network', HUB.replace('http', 'ws')));
			}
			expect(csp).toContain("script-src 'self';");
			const html = await res.text();
			expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
			expect(html).not.toMatch(/fonts\.googleapis|fontshare|gstatic/);
		});

		test('every page boots with zero CSP violations and self-hosted fonts', async ({ page }) => {
			const w = await watch(page, origin);
			for (const path of PAGES) {
				await page.goto(path);
				await expect(page.locator('main').first()).toBeVisible();
				await page.waitForLoadState('networkidle');
				w.violations.push(...(await violations(page)).map((v) => `${path}: ${v}`));
			}
			await page.goto('/discover');
			await expect(page.getByText('Sample Weather Oracle').first()).toBeVisible();
			const fonts = await page.evaluate(async () => {
				await document.fonts.ready;
				const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
				return { loaded, sans: getComputedStyle(document.body).fontFamily };
			});
			expect(fonts.sans).toMatch(/^"?Geist Variable/);
			expect(fonts.loaded).toContain('Geist Variable');
			w.violations.push(...(await violations(page)));
			expect(w.violations, 'securitypolicyviolation events').toEqual([]);
			expect(w.console, 'CSP console errors').toEqual([]);
			expect(w.errors, 'uncaught page errors').toEqual([]);
			expect(w.foreign, 'requests to third-party hosts').toEqual([]);
		});

		test('wallet sign-in works under the CSP', async ({ page }) => {
			// Local mode never offers browser wallets; its miner-wallet setup runs under this CSP in local-wallet.spec.ts.
			test.skip(mode === 'local', 'no browser wallets in local mode');
			const w = await watch(page, origin);
			await installTestWallet(page);
			await page.goto('/faucet');
			await page.getByRole('button', { name: 'Connect Wallet' }).first().click();
			await page.getByTestId('wallet-option').filter({ hasText: 'Test Wallet' }).click();
			await expect(page.getByTestId('wallet-address')).toContainText(TEST_ADDRESS.slice(0, 6));
			await expect(page.getByTestId('faucet-drip')).toBeVisible();
			w.violations.push(...(await violations(page)));
			expect(w.violations).toEqual([]);
			expect(w.console).toEqual([]);
			expect(w.foreign).toEqual([]);
		});
	});
}
