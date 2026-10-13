import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockMiner, MOCK_POW_DISCLOSURES, type MockMiner } from './mock/miner';
import { minerApi, powDisclosureFor, powEnableBody, powMiningApp, type MinerPowStatus } from './miner';

let miner: MockMiner;

beforeEach(() => {
	miner = createMockMiner();
	vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
		const u = new URL(String(input));
		const path = u.pathname.replace(/^\/api\/v1/, '');
		const body = init?.body ? JSON.parse(String(init.body)) : undefined;
		const r = miner.handle(init?.method ?? 'GET', path, body) ?? { status: 404, body: { error: 'not_found', message: 'unknown endpoint' } };
		return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
	});
});
afterEach(() => vi.unstubAllGlobals());

const legacy = (app: string, version: string): Pick<MinerPowStatus, 'app' | 'disclosure' | 'disclosures' | 'settings'> => ({
	app,
	disclosure: { version, text: 'old text' },
	settings: { app, enabled: false } as MinerPowStatus['settings']
});

describe('per-app PoW disclosures', () => {
	it('picks the disclosure of the page app from `disclosures`', async () => {
		const s = await minerApi.powStatus();
		expect(s.app).toBe('monero');
		expect(s.disclosure.version).toBe('pow-randomx-v2');
		expect(powDisclosureFor(s, 'verus')?.version).toBe('pow-verus-v1');
		expect(powDisclosureFor(s, 'verus')?.text).toBe(MOCK_POW_DISCLOSURES.verus.text);
		expect(powDisclosureFor(s, 'monero')?.version).toBe('pow-randomx-v2');
	});

	it('falls back to `disclosure` for the current app on older miners, null for other apps', () => {
		expect(powDisclosureFor(legacy('monero', 'pow-xmr-v1'), 'monero')?.version).toBe('pow-xmr-v1');
		expect(powDisclosureFor(legacy('monero', 'pow-xmr-v1'), 'verus')).toBeNull();
		expect(powEnableBody(legacy('monero', 'pow-xmr-v1'), 'verus', 50)).toBeNull();
	});

	it('switches a device from Monero to Verus with the Verus disclosure (one app at a time)', async () => {
		let s = await minerApi.powStatus();
		s = await minerApi.powSet(powEnableBody(s, 'monero', 40)!);
		expect(powMiningApp(s, 'monero')).toBe(true);
		expect(powMiningApp(s, 'verus')).toBe(false);

		const body = powEnableBody(s, 'verus', 60)!;
		expect(body).toEqual({ app: 'verus', enabled: true, accepted_disclosure: 'pow-verus-v1', max_cpu_pct: 60 });
		s = await minerApi.powSet(body);
		expect(powMiningApp(s, 'verus')).toBe(true);
		expect(powMiningApp(s, 'monero')).toBe(false);
		expect(s.workload).toBe('pow.verushash');
		expect(s.disclosure.version).toBe('pow-verus-v1');
		expect(s.stats?.job).toMatchObject({ algo: 'verushash-2.2', coin: 'VRSC' });
	});

	it('refuses to enable Verus with the Monero disclosure version', async () => {
		await expect(minerApi.powSet({ app: 'verus', enabled: true, accepted_disclosure: 'pow-randomx-v2' })).rejects.toMatchObject({ status: 400 });
		expect(miner.pow.enabled).toBe(false);
	});
});
