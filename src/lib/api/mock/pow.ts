/**
 * Sample proof-of-work apps for the mock Hub (`/v1/pow/apps…`): the RandomX app ("monero", target Monero, Tari
 * merge-mined and active) and Verus. Shapes follow the Hub's POW-APPS endpoints; values are sample data.
 *
 * Only relative imports (no `$lib`) so Node can run it through `tsx` (tests/mock-server.ts).
 */

type Json = Record<string, unknown>;

const NECTA_TOKEN = { address: '0x000000000000000000000000000000000000ec7a', decimals: 18, name: 'NECTA (testnet)', symbol: 'NECTA' };
const SETTLEMENT =
	"validators verify each epoch's share ledger and sign its receipt; NECTA is settled through the project vault and claimed from the Withdraw page";
const EPOCH_SECS = 3600;

export const MOCK_POW_PROJECTS = {
	monero: '0x353d3b166bc2965185e7668cfc4af6265d4909e2b169a27cdb47972d830138f7',
	verus: '0x7a1e0c3f5b2d4e6a8c9b0d1f2e3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a'
} as const;

const TARGETS = [
	{ id: 'monero', coin: 'XMR', name: 'Monero', algo: 'rx/0', website: 'https://www.getmonero.org', default: true, merge_mined: ['tari'] },
	{ id: 'zephyr', coin: 'ZEPH', name: 'Zephyr', algo: 'rx/0', website: 'https://www.zephyrprotocol.com', default: false, merge_mined: [] },
	{ id: 'salvium', coin: 'SAL', name: 'Salvium', algo: 'rx/0', website: 'https://salvium.io', default: false, merge_mined: [] },
	{ id: 'scash', coin: 'SCASH', name: 'Scash', algo: 'rx/scash', website: 'https://scash.network', default: false, merge_mined: [] },
	{ id: 'qrl', coin: 'QRL', name: 'QRL', algo: 'rx/0', website: 'https://www.theqrl.org', default: false, merge_mined: [] }
];

function moneroApp(target: string, mergeOn: boolean): Json {
	const t = TARGETS.find((x) => x.id === target) ?? TARGETS[0];
	const tariActive = t.id === 'monero' && mergeOn;
	return {
		app_id: 'monero',
		project_id: MOCK_POW_PROJECTS.monero,
		slug: 'monero-testnet',
		kind: 'proof-of-work',
		workload: 'pow.randomx',
		family: 'randomx',
		family_name: 'RandomX',
		name: 'Monero',
		coin: 'XMR',
		algorithm: t.algo,
		pool_mode: 'test',
		tagline: "Lend your computer's CPU to mine Monero for Necter and get paid in NECTA.",
		description:
			"Your device runs RandomX, Monero's CPU proof-of-work, for Necter. Necter keeps the mined coins and pays you NECTA for every verified share your device finds. Opt-in only, off by default, on desktops, laptops and servers, with a CPU limit you choose.",
		testnet_note:
			'Testnet: mining test mode. Your device does real RandomX work on test jobs; no real Monero (XMR) is mined and testnet NECTA has no value.',
		website: 'https://www.getmonero.org',
		category: 'blockchain',
		accent_color: '#F26822',
		device_classes: ['desktop', 'laptop', 'server'],
		mobile_enabled: false,
		opt_in: true,
		default_cpu_pct: 50,
		disclosure_version: 'pow-randomx-v2',
		min_miner_version: t.algo === 'rx/0' ? null : '1.0.4',
		share_difficulty: 1000,
		units_per_share: 1,
		epoch_secs: EPOCH_SECS,
		randomx: {
			target: t.id,
			target_coin: t.coin,
			target_name: t.name,
			algo: t.algo,
			targets: TARGETS.map((x) => ({ ...x, active: x.id === t.id }))
		},
		merge_mining: [
			{
				id: 'tari',
				coin: 'XTM',
				name: 'Tari',
				website: 'https://www.tari.com',
				with: 'monero',
				active: tariActive,
				mode: 'simulated',
				note: 'Tari is merge-mined with Monero: the same RandomX work also counts toward Tari blocks, at no extra cost to your device. On testnet the Tari side is simulated.'
			}
		],
		treasury_earns: tariActive ? [t.coin, 'XTM'] : [t.coin],
		headline: 'RandomX: Monero (default) · also Zephyr, Salvium, Scash, QRL · Tari merge-mined',
		reward: { token: NECTA_TOKEN, reward_per_unit: '10000000000000000', daily_emission: '10000000000000000000000', vault: '0x15d2f9958831b6e1375590cfc5774df89d29515d', settlement: SETTLEMENT }
	};
}

function verusApp(): Json {
	return {
		app_id: 'verus',
		project_id: MOCK_POW_PROJECTS.verus,
		slug: 'verus-testnet',
		kind: 'proof-of-work',
		workload: 'pow.verushash',
		family: 'verushash',
		family_name: 'VerusHash',
		name: 'Verus',
		coin: 'VRSC',
		algorithm: 'verushash-2.2',
		pool_mode: 'test',
		tagline: "Lend your computer's CPU to mine Verus for Necter and get paid in NECTA.",
		description:
			'Your device runs VerusHash 2.2, the CPU proof-of-work of Verus, for Necter. Necter keeps the mined Verus and pays you NECTA for every verified share. VerusHash needs almost no memory and runs well on ARM, so Verus is the candidate if phone mining is ever turned on.',
		testnet_note:
			'Testnet: mining test mode. Your device does real VerusHash 2.2 work on test jobs; no real Verus (VRSC) is mined and testnet NECTA has no value.',
		website: 'https://verus.io',
		category: 'blockchain',
		accent_color: '#3165D4',
		device_classes: ['desktop', 'laptop', 'server'],
		mobile_enabled: false,
		mobile_candidate: true,
		opt_in: true,
		default_cpu_pct: 50,
		disclosure_version: 'pow-verus-v1',
		min_miner_version: '1.0.4',
		share_difficulty: 500000,
		units_per_share: 1,
		epoch_secs: EPOCH_SECS,
		merge_mining: [],
		treasury_earns: ['VRSC'],
		reward: { token: NECTA_TOKEN, reward_per_unit: '10000000000000000', daily_emission: '10000000000000000000000', vault: '0x25d2f9958831b6e1375590cfc5774df89d29515e', settlement: SETTLEMENT }
	};
}

/** Deterministic per-epoch sample numbers (no Math.random so screenshots and tests are stable). */
function sample(epoch: number, salt: number, mod: number): number {
	let x = (epoch * 2654435761 + salt * 40503) >>> 0;
	x ^= x >>> 13;
	x = Math.imul(x, 0x5bd1e995) >>> 0;
	return x % mod;
}

function epochTreasury(app: 'monero' | 'verus', epoch: number, tari: boolean): Json {
	const shares = 900 + sample(epoch, 1, 600);
	const coin = app === 'monero' ? 'XMR' : 'VRSC';
	const diff = app === 'monero' ? 1000 : 500000;
	const out: Json = {
		v: 1,
		app,
		project_id: MOCK_POW_PROJECTS[app],
		epoch,
		targets: { [coin]: { shares, work: String(shares * diff) } },
		aux: {}
	};
	if (tari) {
		const blocks = sample(epoch, 2, 5) === 0 ? 1 : 0;
		const perBlock = '13125000000';
		out.aux = {
			tari: {
				coin: 'XTM',
				name: 'Tari',
				with: 'XMR',
				mode: 'simulated',
				shares,
				work: String(shares * diff),
				aux_difficulty: 4_800_000,
				blocks,
				expected_blocks: Number(((shares * diff) / 4_800_000).toFixed(3)),
				reward_per_block: perBlock,
				reward_unit: 'micro-XTM (test)',
				reward: String(BigInt(perBlock) * BigInt(blocks))
			}
		};
	}
	return out;
}

export interface MockPowOptions {
	/** Apps the Hub enables (default both). */
	apps?: ('monero' | 'verus')[];
	/** RandomX treasury target (default monero). */
	target?: string;
	mergeMining?: boolean;
}

/** Route table for the mock Hub: returns null when the path is not a PoW route. */
export function createMockPow(now: () => number, opts: MockPowOptions = {}) {
	const enabled = opts.apps ?? ['monero', 'verus'];
	const target = opts.target ?? 'monero';
	const merge = opts.mergeMining ?? true;
	const apps = (): Json[] => enabled.map((id) => (id === 'monero' ? moneroApp(target, merge) : verusApp()));
	const find = (id: string) => apps().find((a) => a.app_id === id) ?? null;
	const tariOn = (id: string) => id === 'monero' && target === 'monero' && merge;
	const currentEpoch = () => Math.floor(now() / EPOCH_SECS);

	function treasury(id: 'monero' | 'verus'): Json {
		const last = currentEpoch() - 1;
		const epochs = Array.from({ length: 48 }, (_, i) => epochTreasury(id, last - i, tariOn(id)));
		const aux_totals: Json = {};
		if (tariOn(id)) {
			let blocks = 0;
			let reward = 0n;
			let shares = 0;
			for (const e of epochs) {
				const t = (e.aux as Record<string, { blocks: number; reward: string; shares: number }>).tari;
				blocks += t.blocks;
				reward += BigInt(t.reward);
				shares += t.shares;
			}
			aux_totals.tari = { coin: 'XTM', mode: 'simulated', blocks, reward: reward.toString(), shares };
		}
		const app = find(id)!;
		return {
			app: id,
			project_id: MOCK_POW_PROJECTS[id],
			target: id === 'monero' ? target : 'verus',
			treasury_earns: app.treasury_earns,
			merge_mining: app.merge_mining,
			aux_totals,
			epochs
		};
	}

	/** `path` without query string. */
	function handle(method: string, path: string): { status: number; body: unknown } | null {
		if (method !== 'GET' || !path.startsWith('/v1/pow/apps')) return null;
		const notFound = { status: 404, body: { error: 'not_found', message: 'unknown proof-of-work app' } };
		if (path === '/v1/pow/apps') return { status: 200, body: { items: apps() } };
		const m = /^\/v1\/pow\/apps\/([^/]+)(\/.*)?$/.exec(path);
		if (!m) return null;
		const id = decodeURIComponent(m[1]);
		const app = find(id);
		if (!app) return notFound;
		const rest = m[2] ?? '';
		if (rest === '') return { status: 200, body: app };
		if (rest === '/treasury') return { status: 200, body: treasury(id as 'monero' | 'verus') };
		const ep = /^\/epochs\/(\d+)$/.exec(rest);
		if (ep) {
			const e = Number(ep[1]);
			if (e >= currentEpoch()) return { status: 404, body: { error: 'not_found', message: 'epoch not closed' } };
			const t = epochTreasury(id as 'monero' | 'verus', e, tariOn(id));
			const shares = (Object.values(t.targets as Record<string, { shares: number }>)[0] ?? { shares: 0 }).shares;
			return {
				status: 200,
				body: { app: id, project_id: app.project_id, epoch: e, closed: true, shares, units: shares, workers: 12 + (e % 7), treasury: t }
			};
		}
		const w = /^\/workers\/([^/]+)$/.exec(rest);
		if (w) return { status: 200, body: { units_credited: 0, units_pending: 0, strikes: 0, suspended_until: null, epoch: currentEpoch() } };
		return notFound;
	}

	return { handle, apps };
}
