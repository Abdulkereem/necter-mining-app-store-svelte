import { test, expect, type Page } from '@playwright/test';
import { installTestWallet, TEST_ADDRESS } from './wallet';

const HUB = 'http://127.0.0.1:4517';
const WEATHER = 'Sample Weather Oracle';

async function resetHub(empty = false) {
	const r = await fetch(`${HUB}/__mock/reset`, { method: 'POST', body: JSON.stringify({ empty }) });
	expect(r.status).toBe(204);
}

async function signIn(page: Page) {
	await page.goto('/discover');
	await page.getByRole('button', { name: 'Connect Wallet' }).first().click();
	await page.getByTestId('wallet-option').filter({ hasText: 'Test Wallet' }).click();
	await expect(page.getByTestId('wallet-address')).toContainText(TEST_ADDRESS.slice(0, 6));
	await expect(page.getByTestId('connect-modal')).toBeHidden();
}

test.beforeEach(async () => {
	await resetHub(false);
});

test('discover lists only projects from the API, never the old fake networks', async ({ page }) => {
	await page.goto('/discover');
	await expect(page.getByText(WEATHER).first()).toBeVisible();
	const body = await page.locator('main').innerText();
	for (const fake of ['Bitcoin', 'Helium', 'Render Network', 'Filecoin']) expect(body).not.toContain(fake);
});

test('empty network shows the designed empty state', async ({ page }) => {
	await resetHub(true);
	await page.goto('/discover');
	await expect(page.getByRole('heading', { name: 'The first Necter projects are on their way' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Publish a project' })).toBeVisible();
	await page.goto('/mining/hardware-checker');
	await expect(page.getByTestId('empty-state').first()).toBeVisible();
	await expect(page.locator('[data-testid="empty-state"] img').first()).toHaveAttribute('src', /\/brand\/3d\//);
});

test('project detail and economics come from the Hub', async ({ page }) => {
	await page.goto('/discover');
	await page.getByText(WEATHER).first().click();
	await expect(page).toHaveURL(/\/apps\/0x[0-9a-f]{64}$/);
	await expect(page.getByRole('heading', { name: WEATHER }).first()).toBeVisible();
	await page.getByRole('button', { name: /Economics/ }).first().click();
	await expect(page.getByText(/85(\.0)?%/).first()).toBeVisible();
});

test('SIWE sign-in, faucet and gasless subscribe end to end', async ({ page }) => {
	await installTestWallet(page);
	await signIn(page);

	await page.goto('/faucet');
	await expect(page.getByTestId('faucet-drip')).toHaveText(/Request 1,000 NECTA/);
	await page.getByTestId('faucet-drip').click();
	await expect(page.getByText(/Next drip in/)).toBeVisible();

	await page.goto('/discover');
	await page.getByText(WEATHER).first().click();
	await page.waitForURL(/\/apps\/0x[0-9a-f]{64}$/);
	const projectUrl = page.url();
	await page.goto(projectUrl + '/subscribe');
	await expect(page.getByText('Studio Mac')).toBeVisible();
	await page.locator('#terms').check();
	await page.getByTestId('subscribe-submit').click();
	await expect(page).toHaveURL(/\/mining\/0x[0-9a-f]{64}$/, { timeout: 30_000 });
	await expect(page.getByText(/Active/).first()).toBeVisible();

	// Errata E10: gasless payout change from the subscription page.
	const payout = page.getByTestId('payout-address');
	await payout.getByTestId('payout-edit').click();
	await payout.getByTestId('payout-input').fill('0x' + 'ab'.repeat(20));
	await payout.getByTestId('payout-submit').click();
	await expect(page.getByText(/Payout change submitted|Payout address changed/)).toBeVisible();
	await expect(payout).toContainText('0xabab');

	await page.goto('/mining/devices');
	await expect(page.getByText('Pixel 8')).toBeVisible();
});

test('explorer shows network status, rounds and validators', async ({ page }) => {
	await page.goto('/explorer');
	await expect(page.getByTestId('network-status')).toBeVisible();
	await expect(page.getByTestId('explorer-stats')).toBeVisible();
	await expect(page.getByText(/node-eu|eu/).first()).toBeVisible();
});

test('P4 pages show a designed coming-soon page', async ({ page }) => {
	for (const path of ['/governance', '/attestations', '/mining/badges', '/operator/automation']) {
		await page.goto(path);
		await expect(page.getByTestId('coming-soon')).toBeVisible();
	}
});

test('hardware checker (web mode) explains installing the miner and checks compatibility', async ({ page }) => {
	await page.goto('/mining/hardware-checker');
	await expect(page.getByTestId('install-miner')).toBeVisible();
	await expect(page.getByTestId('compat-card').first()).toBeVisible({ timeout: 15_000 });
});

test('pages that need a session show the sign-in gate', async ({ page }) => {
	await page.goto('/mining');
	await expect(page.getByTestId('gate-connect')).toBeVisible();
});
