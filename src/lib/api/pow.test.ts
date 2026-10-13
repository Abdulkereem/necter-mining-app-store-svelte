import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	algorithmLabel,
	auxSummary,
	deviceClassLabel,
	isComputeProject,
	normalizePowApp,
	pow,
	POW_ICONS,
	powHeadline,
	treasuryEarnsLabel,
	versionAtLeast,
	websiteHost
} from './pow';
import { createMockPow } from './mock/pow';
import { createMockHub } from './mock/hub';

const NOW = 1_790_000_000;
const HEADLINE = 'RandomX: Monero (default) · also Zephyr, Salvium, Scash, QRL · Tari merge-mined';

function sampleApps(opts: Parameters<typeof createMockPow>[1] = {}) {
	return createMockPow(() => NOW, opts).apps().map(normalizePowApp);
}

/** Routes the pow client's fetches to an in-memory mock Hub. */
function installHub(opts: Parameters<typeof createMockHub>[0] = {}) {
	const hub = createMockHub({ now: () => NOW, ...opts });
	vi.stubGlobal('fetch', (req: Request) => hub.handle(req));
	return hub;
}
afterEach(() => vi.unstubAllGlobals());

describe('proof-of-work apps', () => {
	it('labels device classes (Android only for phones/tablets)', () => {
		expect(deviceClassLabel(['desktop', 'laptop', 'server'])).toBe('Desktop · Laptop · Server');
		expect(deviceClassLabel(['phone', 'tablet'])).toBe('Android phone · Android tablet');
	});
	it('ships the official Monero symbol locally with its CC BY-SA credit, and no Verus logo', () => {
		expect(POW_ICONS.monero.src).toBe('/apps/monero/monero-symbol.png');
		expect(POW_ICONS.monero.license).toContain('by-sa/4.0');
		expect(POW_ICONS.verus).toBeUndefined();
	});
});

describe('parsing (normalizePowApp)', () => {
	it('keeps the RandomX fields of the Monero item', () => {
		const [monero] = sampleApps();
		expect(monero.family).toBe('randomx');
		expect(monero.family_name).toBe('RandomX');
		expect(monero.workload).toBe('pow.randomx');
		expect(monero.disclosure_version).toBe('pow-randomx-v2');
		expect(monero.min_miner_version).toBeNull();
		expect(monero.randomx?.target).toBe('monero');
		expect(monero.randomx?.targets.map((t) => t.coin)).toEqual(['XMR', 'ZEPH', 'SAL', 'SCASH', 'QRL']);
		expect(monero.randomx?.targets.find((t) => t.active)?.id).toBe('monero');
		expect(monero.randomx?.targets.find((t) => t.default)?.id).toBe('monero');
		expect(monero.merge_mining).toHaveLength(1);
		expect(monero.merge_mining[0]).toMatchObject({ id: 'tari', coin: 'XTM', with: 'monero', active: true, mode: 'simulated' });
		expect(monero.treasury_earns).toEqual(['XMR', 'XTM']);
	});

	it('parses the Verus item', () => {
		const verus = sampleApps().find((a) => a.app_id === 'verus')!;
		expect(verus).toMatchObject({
			coin: 'VRSC',
			algorithm: 'verushash-2.2',
			workload: 'pow.verushash',
			family: 'verushash',
			family_name: 'VerusHash',
			disclosure_version: 'pow-verus-v1',
			min_miner_version: '1.0.4',
			mobile_candidate: true,
			mobile_enabled: false,
			share_difficulty: 500000,
			accent_color: '#3165D4'
		});
		expect(verus.randomx).toBeNull();
		expect(verus.merge_mining).toEqual([]);
		expect(verus.treasury_earns).toEqual(['VRSC']);
		expect(deviceClassLabel(verus.device_classes)).toBe('Desktop · Laptop · Server');
		expect(algorithmLabel(verus)).toBe('VerusHash 2.2');
		expect(websiteHost(verus.website)).toBe('verus.io');
	});

	it('fills defaults for an older (pow-xmr-v1) Monero item', () => {
		const old = normalizePowApp({ app_id: 'monero', name: 'Monero', coin: 'XMR', algorithm: 'rx/0', workload: 'pow.randomx', device_classes: ['desktop'] });
		expect(old.family_name).toBe('RandomX');
		expect(old.merge_mining).toEqual([]);
		expect(old.randomx).toBeNull();
		expect(old.treasury_earns).toEqual(['XMR']);
		expect(old.headline).toBeNull();
		expect(old.min_miner_version).toBeNull();
		expect(powHeadline(old)).toBe('Monero (XMR) · RandomX (rx/0)');
		expect(algorithmLabel(old)).toBe('RandomX (rx/0)');
	});
});

describe('headline and treasury labels', () => {
	it('uses the Hub headline when present', () => {
		const [monero] = sampleApps();
		expect(powHeadline(monero)).toBe(HEADLINE);
	});
	it('builds the same headline from randomx.targets when the Hub sends none', () => {
		const [monero] = sampleApps();
		expect(powHeadline({ ...monero, headline: null })).toBe(HEADLINE);
		// Merge-mined chains are also read from targets[].merge_mined when merge_mining is empty.
		expect(powHeadline({ ...monero, headline: null, merge_mining: [] })).toBe(HEADLINE);
		const noMerge = { ...monero, headline: null, merge_mining: [], randomx: { ...monero.randomx!, targets: monero.randomx!.targets.map((t) => ({ ...t, merge_mined: [] })) } };
		expect(powHeadline(noMerge)).toBe('RandomX: Monero (default) · also Zephyr, Salvium, Scash, QRL');
	});
	it('falls back to "<name> (<coin>) · <algorithm>" for Verus', () => {
		const verus = sampleApps().find((a) => a.app_id === 'verus')!;
		expect(powHeadline(verus)).toBe('Verus (VRSC) · VerusHash 2.2');
	});
	it('joins treasury_earns', () => {
		const [monero, verus] = sampleApps();
		expect(treasuryEarnsLabel(monero)).toBe('XMR + XTM');
		expect(treasuryEarnsLabel(verus)).toBe('VRSC');
		expect(treasuryEarnsLabel({ treasury_earns: [], coin: 'XMR' })).toBe('XMR');
	});
	it('follows the treasury target: Zephyr earns ZEPH only, Tari inactive; Scash needs miner 1.0.4', () => {
		const [zeph] = sampleApps({ target: 'zephyr' });
		expect(zeph.treasury_earns).toEqual(['ZEPH']);
		expect(zeph.merge_mining[0].active).toBe(false);
		expect(zeph.randomx?.targets.find((t) => t.active)?.id).toBe('zephyr');
		const [scash] = sampleApps({ target: 'scash' });
		expect(scash.algorithm).toBe('rx/scash');
		expect(scash.min_miner_version).toBe('1.0.4');
	});
});

describe('helpers', () => {
	it('compares miner versions', () => {
		expect(versionAtLeast('1.0.4', '1.0.4')).toBe(true);
		expect(versionAtLeast('1.0.10', '1.0.4')).toBe(true);
		expect(versionAtLeast('v1.1.0', '1.0.4')).toBe(true);
		expect(versionAtLeast('1.0.3', '1.0.4')).toBe(false);
		expect(versionAtLeast('0.9', '1.0.4')).toBe(false);
	});
	it('keeps proof-of-work projects (Monero and Verus) out of the compute lists', () => {
		expect(isComputeProject({ kind: 'proof-of-work' })).toBe(false);
		expect(isComputeProject({ kind: 'task' })).toBe(true);
		expect(isComputeProject({})).toBe(true);
	});
});

describe('Hub client against the mock Hub', () => {
	it('lists both apps, or only the ones the Hub enables', async () => {
		installHub();
		expect((await pow.apps()).map((a) => a.app_id)).toEqual(['monero', 'verus']);
		installHub({ pow: { apps: ['monero'] } });
		expect((await pow.apps()).map((a) => a.app_id)).toEqual(['monero']);
		installHub({ pow: { apps: ['verus'] } });
		expect((await pow.apps()).map((a) => a.app_id)).toEqual(['verus']);
	});

	it('loads the Verus page data and 404s unknown apps', async () => {
		installHub();
		const verus = await pow.app('verus');
		expect(verus.name).toBe('Verus');
		expect(verus.testnet_note).toContain('no real Verus (VRSC) is mined');
		await expect(pow.app('dogecoin')).rejects.toMatchObject({ status: 404 });
		installHub({ pow: { apps: ['monero'] } });
		await expect(pow.app('verus')).rejects.toMatchObject({ status: 404 });
	});

	it('reads the treasury: 48 epochs, Tari blocks summed', async () => {
		installHub();
		const t = await pow.treasury('monero');
		expect(t.epochs).toHaveLength(48);
		expect(t.epochs[0].epoch).toBeGreaterThan(t.epochs[1].epoch);
		expect(t.treasury_earns).toEqual(['XMR', 'XTM']);
		const blocks = t.epochs.reduce((n, e) => n + (e.aux.tari?.blocks ?? 0), 0);
		const s = auxSummary(t, 'tari')!;
		expect(s.blocks).toBe(blocks);
		expect(s.blocks).toBeGreaterThan(0);
		expect(s.epochs).toBe(48);
		expect(s.mode).toBe('simulated');
		expect(t.epochs[0].aux.tari).toMatchObject({ coin: 'XTM', with: 'XMR', reward_unit: 'micro-XTM (test)' });
		const verusT = await pow.treasury('verus');
		expect(auxSummary(verusT, 'tari')).toBeNull();
	});
});
