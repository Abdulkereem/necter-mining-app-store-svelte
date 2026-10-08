/**
 * Local mode (desktop app / store served by necter-miner) wallet setup, against the local build with the mock
 * miner wallet API (tests/static-server.ts LOCAL_MINER_PORT) under the miner's CSP:
 * create a wallet (recovery phrase shown once + confirmation), import the standard BIP-39 test mnemonic, import a
 * private key, export it from settings — and never offer injected / EIP-6963 / WalletConnect wallets, even when
 * a browser wallet is present.
 */
import { test, expect, type Page } from '@playwright/test';
import { installTestWallet } from './wallet';

const ORIGIN = 'http://127.0.0.1:4520';
const HUB = 'http://127.0.0.1:4517';
const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const ABANDON_0 = '0x9858effd232b4033e47d90003d41ec34ecaeda94';
const ABANDON_1 = '0x6fac4d18c912343bf86fa7049364dd4e424ab9c0';
const HH_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const HH_ADDR = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

test.use({ baseURL: ORIGIN });

async function resetMiner(body: object = {}) {
	expect((await fetch(`${ORIGIN}/api/v1/__mock/reset`, { method: 'POST', body: JSON.stringify(body) })).status).toBe(204);
}

type Watch = { csp: string[]; foreign: string[]; errors: string[] };
async function watch(page: Page): Promise<Watch> {
	const w: Watch = { csp: [], foreign: [], errors: [] };
	page.on('console', (m) => {
		if (/content security policy|refused to (load|execute|apply|connect)/i.test(m.text())) w.csp.push(m.text());
	});
	page.on('pageerror', (e) => w.errors.push(e.message));
	page.on('request', (r) => {
		const u = new URL(r.url());
		if (!['data:', 'blob:'].includes(u.protocol) && u.origin !== ORIGIN && u.origin !== HUB) w.foreign.push(r.url());
	});
	// A browser wallet is present: local mode must still never offer it.
	await installTestWallet(page);
	return w;
}

async function openConnect(page: Page) {
	await page.goto('/discover');
	await page.getByRole('button', { name: 'Connect Wallet' }).first().click();
	const modal = page.getByTestId('connect-modal');
	await expect(modal.getByTestId('local-wallet-setup')).toBeVisible();
	await expectNoBrowserWallets(page);
	return modal;
}

async function expectNoBrowserWallets(page: Page) {
	const modal = page.getByTestId('connect-modal');
	await expect(modal.getByTestId('wallet-option')).toHaveCount(0);
	await expect(modal).not.toContainText(/MetaMask|Test Wallet|Browser wallet|WalletConnect|Rabby/);
}

function clean(w: Watch) {
	expect(w.csp, 'CSP console errors').toEqual([]);
	expect(w.foreign, 'requests to third-party hosts').toEqual([]);
	expect(w.errors, 'uncaught page errors').toEqual([]);
}

test.beforeEach(() => resetMiner());

test('offers create / import only, and never browser wallets', async ({ page }) => {
	const w = await watch(page);
	const modal = await openConnect(page);
	await expect(modal.getByTestId('local-create')).toContainText('Create a new wallet');
	await expect(modal.getByTestId('local-import-phrase')).toContainText('Import with recovery phrase');
	await expect(modal.getByTestId('local-import-key')).toContainText('Import with private key');
	clean(w);
});

test('creates a wallet: phrase shown once, backup confirmed, wallet connected', async ({ page }) => {
	const w = await watch(page);
	const modal = await openConnect(page);
	await modal.getByTestId('local-create').click();
	await modal.getByRole('radio', { name: '24 words' }).click();
	await modal.getByRole('radio', { name: '12 words' }).click();
	await modal.getByTestId('create-wallet').click();
	const phrase = modal.getByTestId('recovery-phrase');
	await expect(phrase.locator('li')).toHaveCount(12);
	await expect(modal.getByTestId('backup-continue')).toBeDisabled();
	// Cannot be dismissed while the phrase is on screen.
	await page.keyboard.press('Escape');
	await expect(modal).toBeVisible();
	await modal.getByTestId('reveal-phrase').click();
	const words = (await phrase.locator('li').allInnerTexts()).map((t) => t.replace(/^\s*\d+\s*/, '').trim());
	expect(words).toHaveLength(12);
	await modal.getByTestId('saved-phrase').check();
	await modal.getByTestId('backup-continue').click();
	// Wrong words are refused.
	const inputs = modal.locator('[data-testid^="confirm-word-"]');
	await expect(inputs).toHaveCount(3);
	for (let i = 0; i < 3; i++) await inputs.nth(i).fill('wrong');
	await modal.getByTestId('confirm-backup').click();
	await expect(modal.getByRole('alert')).toContainText('do not match');
	for (let i = 0; i < 3; i++) {
		const n = Number((await inputs.nth(i).getAttribute('data-testid'))!.replace('confirm-word-', ''));
		await inputs.nth(i).fill(words[n - 1]);
	}
	await modal.getByTestId('confirm-backup').click();
	await expect(modal.getByTestId('wallet-ready')).toBeVisible();
	const address = (await modal.getByTestId('wallet-ready').locator('.font-mono').innerText()).trim();
	expect(address).toMatch(/^0x[0-9a-f]{40}$/);
	// The phrase shown really is this wallet's (checked through the miner's derive).
	const derived = await (await fetch(`${ORIGIN}/api/v1/wallet`, { method: 'POST', body: JSON.stringify({ action: 'derive', recovery_phrase: words.join(' ') }) })).json();
	expect(derived.address).toBe(address);
	await modal.getByTestId('wallet-continue').click();
	await expect(modal).toBeHidden();
	await expect(page.getByTestId('wallet-address')).toContainText(address.slice(0, 6));
	// Next time the dialog offers the existing wallet, still no browser wallets.
	await page.getByTestId('wallet-address').click();
	await page.getByRole('button', { name: 'Disconnect' }).click();
	await page.getByRole('button', { name: 'Connect Wallet' }).first().click();
	await expect(page.getByTestId('use-miner-wallet')).toContainText(address.slice(0, 6));
	await expectNoBrowserWallets(page);
	clean(w);
});

test('imports the standard test mnemonic, pasted with numbering, at account 1 and 0', async ({ page }) => {
	const w = await watch(page);
	const modal = await openConnect(page);
	await modal.getByTestId('local-import-phrase').click();
	const input = modal.getByTestId('phrase-input');
	// Bad checksum first: clear error, import disabled.
	await input.fill(ABANDON.replace('about', 'abandon'));
	await expect(modal.getByTestId('phrase-error')).toContainText('checksum');
	await expect(modal.getByTestId('import-phrase-submit')).toBeDisabled();
	const pasted = ABANDON.split(' ')
		.map((x, i) => `${i + 1}. ${x}`)
		.join('\n');
	await input.fill(pasted);
	await expect(modal.getByTestId('phrase-preview')).toContainText(ABANDON_0);
	await modal.getByTestId('phrase-advanced').click();
	await modal.getByTestId('account-index').selectOption('1');
	await expect(modal.getByTestId('phrase-preview')).toContainText(ABANDON_1);
	await modal.getByTestId('account-index').selectOption('0');
	await expect(modal.getByTestId('phrase-preview')).toContainText(ABANDON_0);
	await modal.getByTestId('import-phrase-submit').click();
	await expect(modal.getByTestId('wallet-ready')).toContainText(ABANDON_0);
	await modal.getByTestId('wallet-continue').click();
	await expect(page.getByTestId('wallet-address')).toContainText(ABANDON_0.slice(0, 6));
	clean(w);
});

test('imports a private key and exports it again from settings after confirmation', async ({ page }) => {
	const w = await watch(page);
	const modal = await openConnect(page);
	await modal.getByTestId('local-import-key').click();
	await modal.getByTestId('key-input').fill('0x1234');
	await expect(modal.getByTestId('import-key-submit')).toBeDisabled();
	await modal.getByTestId('key-input').fill(HH_KEY);
	await modal.getByTestId('import-key-submit').click();
	await expect(modal.getByTestId('wallet-ready')).toContainText(HH_ADDR);
	await modal.getByTestId('wallet-continue').click();
	await expect(page.getByTestId('wallet-address')).toContainText(HH_ADDR.slice(0, 6));

	await page.goto('/settings');
	await page.getByRole('button', { name: 'Wallet & session' }).click();
	const card = page.getByTestId('miner-wallet-card');
	await expect(card).toContainText(HH_ADDR.slice(0, 6));
	await expect(card).toContainText(HH_ADDR.slice(-4));
	await page.getByTestId('export-key').click();
	await expect(page.getByTestId('export-reveal')).toBeDisabled();
	await page.getByText('I understand and I am alone at this screen.').click();
	await page.getByTestId('export-confirm').fill('show my key');
	await page.getByTestId('export-reveal').click();
	await expect(page.getByTestId('exported-key')).toHaveText(HH_KEY);
	clean(w);
});

test('an existing wallet is used directly; a locked one is unlocked', async ({ page }) => {
	await resetMiner({ wallet: { privateKey: HH_KEY, locked: true } });
	const w = await watch(page);
	const modal = await openConnect(page);
	await expect(modal.getByTestId('local-create')).toHaveCount(0);
	await modal.getByTestId('unlock-miner-wallet').click();
	await expect(modal).toBeHidden();
	await expect(page.getByTestId('wallet-address')).toContainText(HH_ADDR.slice(0, 6));
	clean(w);
});
