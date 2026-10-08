/**
 * Captures screenshots of key pages against the mock Hub (for reviews). Expects the mock Hub on :4517 and the
 * web build served on :4518 (same setup as playwright.config.ts). Usage:
 *   SHOTS_DIR=/tmp/shots npx tsx tests/scripts/screenshots.ts
 */
import { chromium, type Page } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { mkdirSync } from 'node:fs';

const STORE = 'http://127.0.0.1:4518';
const HUB = 'http://127.0.0.1:4517';
const OUT = process.env.SHOTS_DIR ?? 'screenshots';
mkdirSync(OUT, { recursive: true });

async function wallet(page: Page, key: `0x${string}`) {
	const acct = privateKeyToAccount(key);
	await page.exposeFunction('__pwPersonalSign', (hex: string) => acct.signMessage({ message: { raw: hex as `0x${string}` } }));
	await page.exposeFunction('__pwSignTypedData', (json: string) => {
		const td = JSON.parse(json);
		delete td.types.EIP712Domain;
		return acct.signTypedData(td);
	});
	// Passed as a string: tsx/esbuild helpers would not exist inside the page.
	await page.addInitScript(`(() => {
		const address = ${JSON.stringify(acct.address.toLowerCase())};
		const provider = {
			async request({ method, params }) {
				if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [address];
				if (method === 'eth_chainId') return '0xaa36a7';
				if (method === 'personal_sign') return window.__pwPersonalSign(params[0]);
				if (method === 'eth_signTypedData_v4') return window.__pwSignTypedData(params[1]);
				return null;
			},
			on() {},
			removeListener() {}
		};
		const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info: { uuid: '0', name: 'Test Wallet', icon: '', rdns: 'test.wallet' }, provider }) }));
		window.addEventListener('eip6963:requestProvider', announce);
		announce();
	})();`);
}

async function signIn(page: Page) {
	await page.goto(`${STORE}/discover`);
	await page.getByRole('button', { name: 'Connect Wallet' }).first().click();
	await page.getByTestId('wallet-option').first().click();
	await page.getByTestId('wallet-address').waitFor();
	await page.waitForTimeout(500);
}

async function shot(page: Page, name: string, path: string, wait = 1200) {
	await page.goto(STORE + path);
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page.waitForTimeout(wait);
	await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
	console.log('saved', name);
}

const reset = (empty = false) => fetch(`${HUB}/__mock/reset`, { method: 'POST', body: JSON.stringify({ empty }) });

const browser = await chromium.launch();
try {
	await reset(true);
	let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	let page = await ctx.newPage();
	await shot(page, '02-discover-empty', '/discover');
	await reset(false);
	await shot(page, '01-discover', '/discover');
	await shot(page, '04-explorer', '/explorer');
	await shot(page, '09-hardware-checker-web', '/mining/hardware-checker', 2500);
	await shot(page, '12-governance-coming-soon', '/governance');
	await page.goto(`${STORE}/discover`);
	await page.getByText('Sample Weather Oracle').first().click();
	await page.waitForURL(/\/apps\/0x/);
	const projectPath = new URL(page.url()).pathname;
	await shot(page, '03-project-detail', projectPath);

	// Miner flow (owner key)
	await ctx.close();
	ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	page = await ctx.newPage();
	await wallet(page, ('0x' + '00'.repeat(31) + '02') as `0x${string}`);
	await signIn(page);
	await shot(page, '05-faucet', '/faucet');
	await page.getByTestId('faucet-drip').click();
	await page.waitForTimeout(1200);
	await shot(page, '06-subscribe', projectPath + '/subscribe', 2500);
	await page.locator('#terms').check();
	await page.getByTestId('subscribe-submit').click();
	await page.waitForURL(/\/mining\/0x/, { timeout: 30000 });
	await page.waitForTimeout(1500);
	await page.screenshot({ path: `${OUT}/07-subscription-detail.png`, fullPage: true });
	await shot(page, '08-my-mining', '/mining', 2500);
	await shot(page, '10-devices', '/mining/devices');
	await shot(page, '11-withdraw', '/withdraw');
	await shot(page, '13-activity', '/notifications');

	// Developer (sample developer key owns the sample projects)
	await ctx.close();
	ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	page = await ctx.newPage();
	await wallet(page, ('0x' + '00'.repeat(31) + '01') as `0x${string}`);
	await signIn(page);
	const token = await page.evaluate(() => JSON.parse(localStorage.getItem('necter_session_v1') ?? '{}').token as string);
	await fetch(`${HUB}/v1/developers/me/enrollment`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ developer_type: 'organization', display_name: 'Sample Labs', agreements_accepted: true })
	});
	await shot(page, '14-developer-portal', '/develop', 2000);
	await shot(page, '15-create-project', '/develop/create', 2000);
	await shot(page, '16-dev-project-dashboard', `/develop${projectPath}`.replace('/develop/apps/', '/develop/apps/'), 2500);
	await shot(page, '17-dev-listing-settings', `/develop${projectPath}/settings`, 2000);

	// Mobile
	await ctx.close();
	ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	page = await ctx.newPage();
	await shot(page, '18-discover-mobile', '/discover');
} finally {
	await browser.close();
}
