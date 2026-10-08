/**
 * In-memory mock of a subset of the Hub API (spec/openapi.yaml) for local UI work and the Playwright smoke test.
 *
 * NEVER shipped as live data: the app only loads it from `vite dev` with PUBLIC_MOCK_API=1 (the import sits
 * behind `import.meta.env.DEV`, which production builds compile out), and the Playwright mock server.
 *
 * It verifies what matters for the client flows it serves: SIWE messages and signatures, bearer sessions,
 * manifest signatures (EIP-191 over canonical JSON), EIP-712 bond/unbond/withdraw signatures. Everything else is
 * deterministic sample data clearly named as such ("Sample …").
 *
 * Only relative imports (no `$lib`) so Node can run it through `tsx` (tests/mock-server.ts).
 */
import { recoverMessageAddress, recoverTypedDataAddress, keccak256, stringToHex, type Hex } from 'viem';
import { parseSiweMessage } from 'viem/siwe';
import type { components } from '../schema';
import { buildSiweMessage } from '../../protocol/siwe';
import { projectId as deriveProjectId, subscriptionId as deriveSubscriptionId, vaultAddress } from '../../protocol/ids';
import { canonicalJson } from '../../protocol/canonical';
import { digestManifest, validateManifest } from '../../protocol/manifest';

type S = components['schemas'];
type Json = Record<string, unknown>;

export const MOCK_CONTRACTS = {
	necta: '0x000000000000000000000000000000000000ec7a',
	faucet: '0x000000000000000000000000000000000000fa0c',
	project_registry: '0x000000000000000000000000000000000000c0de',
	vault_factory: '0x000000000000000000000000000000000000fac7',
	vault_implementation: '0x0000000000000000000000000000000000001111',
	staking: '0x0000000000000000000000000000000000005a4e',
	treasury: '0x00000000000000000000000000000000000071ea'
} as const;

const CHAIN_ID = 11155111;
const NECTA: S['Token'] = { address: MOCK_CONTRACTS.necta, symbol: 'NECTA', name: 'Necter (testnet)', decimals: 18 };
const SAMPLE_DEV = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';
const E18 = 10n ** 18n;
const ALLOWED_DOMAINS = ['testnet.necter.network', '127.0.0.1:7878', 'localhost:7878', 'necter-miner.app'];

export interface MockHubOptions {
	/** Persist state in localStorage (browser dev mode). */
	persist?: boolean;
	/** Extra SIWE domains to allow (dev server host, Playwright host). */
	allowDomains?: string[];
	/** Clock override (unix seconds) for tests. */
	now?: () => number;
	/** Start with no listed projects (empty-state screenshots). */
	empty?: boolean;
}

interface Account {
	address: string;
	devices: S['Device'][];
	subscriptions: S['Subscription'][];
	proofs: S['Proof'][];
	leases: S['Lease'][];
	payouts: S['EpochPayout'][];
	withdrawals: S['Withdrawal'][];
	notifications: S['Notification'][];
	preferences: S['Preferences'];
	developer: S['Developer'] | null;
	drafts: S['Draft'][];
	apiKeys: S['ApiKey'][];
	faucetNext: number | null;
	necta: bigint;
	nonce: number;
}

interface MockProject {
	project: S['Project'];
	manifest: S['Manifest'];
	versions: S['ProjectVersion'][];
	reviews: S['Review'][];
	announcements: S['Announcement'][];
	simulations: S['Simulation'][];
}

interface State {
	projects: MockProject[];
	accounts: Record<string, Account>;
	sessions: Record<string, { address: string; expires_at: number }>;
	nonces: Record<string, { address: string; domain: string; expires_at: number; message: string }>;
	modules: S['Module'][];
	collections: S['Collection'][];
	seq: number;
}

function fakeHash(seed: string): Hex {
	return keccak256(stringToHex(seed));
}

function nodeIdFor(seed: string) {
	return 'ndsr-' + fakeHash('node:' + seed).slice(2, 18);
}

const SAMPLE_ICON = (letter: string, color: string) =>
	'data:image/svg+xml;utf8,' +
	encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#141416"/><path d="M32 8l20 12v24L32 56 12 44V20z" fill="${color}" opacity="0.9"/><text x="32" y="40" font-family="sans-serif" font-size="20" font-weight="700" text-anchor="middle" fill="#0C0C0E">${letter}</text></svg>`
	);

function sampleManifest(slug: string, name: string, category: S['Category'], color: string, opts: Partial<{ tagline: string; description: string; tags: string[]; features: string[]; classes: S['DeviceClass'][]; model: 'per-unit' | 'epoch-pool'; minCollateral: string; cores: number; ram: number }> = {}): S['Manifest'] {
	const pid = deriveProjectId(SAMPLE_DEV, slug);
	const model = opts.model ?? 'per-unit';
	return {
		v: 1,
		network: 'necter-testnet',
		chain_id: CHAIN_ID,
		developer: SAMPLE_DEV,
		slug,
		version: 1,
		previous: null,
		consensus: {
			modules: { worker: fakeHash('module:' + slug), verifier: null },
			work: {
				class: 'deterministic',
				verification: 'redundant-execution',
				execution: 'committee',
				functions: ['score'],
				task_source: { kind: 'api' },
				max_gas_limit: 50_000_000,
				committee: { size: 5, backups: 3, min_size: 3, selection: 'collateral-reputation-sortition-v1', weight_cap_multiple: 10 },
				round_secs: 60,
				lease_secs: 30,
				epoch_secs: 3600,
				dispute_window_secs: 86400
			},
			economics: {
				reward_token: MOCK_CONTRACTS.necta,
				vault: vaultAddress(MOCK_CONTRACTS.vault_factory, MOCK_CONTRACTS.vault_implementation, pid),
				reward_model: model,
				reward_per_unit: model === 'per-unit' ? '1000000000000000' : '0',
				daily_emission: (1000n * E18).toString(),
				fee_split_bp: { miner: 8500, developer: 1000, treasury: 500 },
				max_units_per_epoch: 1_000_000,
				max_recipients_per_epoch: 2000,
				min_collateral: opts.minCollateral ?? (10n * E18).toString(),
				slashing_bp: { invalid_result: 1000, missed_sla: 100 }
			}
		},
		scheduling: {
			requirements: {
				device_classes: opts.classes ?? ['desktop', 'laptop', 'phone', 'server'],
				cpu_cores: opts.cores ?? 2,
				ram_mb: opts.ram ?? 2048,
				storage_mb: 512,
				gpu: null,
				min_benchmark: 0,
				engines: ['native', 'pulley32', 'pulley64'],
				attestation: []
			},
			sla: { max_latency_ms: 2000, min_uptime_bp: 9500 },
			public_tasks: false
		},
		listing: {
			name,
			tagline: opts.tagline ?? '',
			description: opts.description ?? '',
			category,
			tags: opts.tags ?? [],
			icon: SAMPLE_ICON(name[7] ?? name[0], color),
			banner: null,
			screenshots: [],
			video: null,
			website: null,
			docs: null,
			support: null,
			features: opts.features ?? [],
			accent_color: color
		}
	};
}

function projectFromManifest(m: S['Manifest'], now: number, extra: Partial<S['Project']> = {}): S['Project'] {
	const d = digestManifest(m);
	const e = m.consensus.economics;
	return {
		project_id: d.project_id,
		slug: m.slug,
		developer: m.developer,
		developer_name: 'Sample Labs',
		developer_verified: true,
		name: m.listing.name,
		tagline: m.listing.tagline || null,
		category: m.listing.category,
		tags: m.listing.tags,
		icon: m.listing.icon,
		accent_color: m.listing.accent_color,
		listing_status: 'listed',
		device_classes: m.scheduling.requirements.device_classes,
		token: NECTA,
		reward_model: e.reward_model,
		min_collateral: e.min_collateral,
		miners: 0,
		avg_daily_reward_per_miner: '0',
		average_rating_x100: null,
		review_count: 0,
		trending: false,
		featured: false,
		listed_at: now - 86400 * 3,
		version: m.version,
		manifest_hash: d.manifest_hash,
		consensus_hash: d.consensus_hash,
		pending_version: null,
		consensus: m.consensus,
		scheduling: m.scheduling,
		listing: m.listing,
		vault: e.vault,
		registry_tx: fakeHash('tx:' + m.slug),
		created_at: now - 86400 * 5,
		...extra
	};
}

function seed(now: number, empty: boolean): State {
	const st: State = { projects: [], accounts: {}, sessions: {}, nonces: {}, modules: [], collections: [], seq: 1 };
	if (empty) return st;
	const defs: [string, string, S['Category'], string, Parameters<typeof sampleManifest>[4], Partial<S['Project']>][] = [
		[
			'sample-weather-oracle',
			'Sample Weather Oracle',
			'data-sovereignty',
			'#FFC933',
			{
				tagline: 'Verified weather scores computed by a miner committee',
				description:
					'Sample project for local development. Each task scores a weather observation with a deterministic model; five miners run it and the committee result is finalized by validators.',
				tags: ['oracle', 'weather'],
				features: ['Runs on phones and laptops', 'Hourly epochs', 'Gasless collateral']
			},
			{ miners: 42, avg_daily_reward_per_miner: (12n * E18).toString(), average_rating_x100: 460, review_count: 2, trending: true, featured: true }
		],
		[
			'sample-image-hash',
			'Sample Perceptual Hash',
			'machine-learning',
			'#7DD3A8',
			{
				tagline: 'Deterministic perceptual hashing for content provenance',
				description: 'Sample project: computes perceptual hashes for submitted images so dapps can detect near-duplicates.',
				tags: ['ml', 'images'],
				features: ['Desktop and server class', 'Per-task rewards'],
				classes: ['desktop', 'server'],
				cores: 4,
				ram: 8192,
				minCollateral: (50n * E18).toString()
			},
			{ miners: 17, avg_daily_reward_per_miner: (31n * E18).toString(), average_rating_x100: 420, review_count: 1 }
		],
		[
			'sample-route-scorer',
			'Sample Route Scorer',
			'depin',
			'#8AB4FF',
			{
				tagline: 'Score delivery routes for a logistics network',
				description: 'Sample project: scores candidate routes with a fixed cost model. Epoch-pool rewards.',
				tags: ['logistics', 'routing'],
				features: ['Epoch-pool rewards', 'Phones welcome'],
				model: 'epoch-pool'
			},
			{ miners: 9, avg_daily_reward_per_miner: (8n * E18).toString() }
		]
	];
	for (const [slug, name, cat, color, opts, extra] of defs) {
		const m = sampleManifest(slug, name, cat, color, opts);
		const project = projectFromManifest(m, now, extra);
		project.stats = {
			period: '7d',
			miners_subscribed: project.miners,
			miners_active: Math.max(0, (project.miners ?? 0) - 3),
			devices_by_class: { phone: 12, laptop: 14, desktop: 10, server: 6 },
			rounds: 5040,
			rounds_finalized: 5011,
			rounds_fallback: 21,
			units: 25200,
			paid_to_miners: (2100n * E18).toString(),
			avg_daily_reward_per_miner: project.avg_daily_reward_per_miner,
			median_finality_ms: 1840,
			uptime_bp: 9870,
			slashes: 1,
			growth_bp: 1250
		};
		project.economics = economicsOf(m);
		st.projects.push({
			project,
			manifest: m,
			versions: [
				{
					version: 1,
					manifest_hash: project.manifest_hash,
					consensus_hash: project.consensus_hash,
					tiers_changed: ['consensus', 'scheduling', 'listing'],
					status: 'active',
					publish_tx: project.registry_tx ?? null,
					published_at: now - 86400 * 5,
					effective_epoch: 0,
					submitted_at: now - 86400 * 5
				}
			],
			reviews: [],
			announcements: [],
			simulations: []
		});
		st.modules.push({
			manifest_address: m.consensus.modules.worker,
			name: slug + '-worker',
			language: 'rust',
			functions: ['score'],
			hbc_size: 48213,
			stateless: true,
			uploader: SAMPLE_DEV,
			exec_count: 5040,
			deployed_at: now - 86400 * 6
		});
	}
	const wo = st.projects[0];
	wo.reviews.push(
		{ review_id: 'rv_1', project_id: wo.project.project_id, author: '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf', rating: 5, comment: 'Runs fine on my laptop overnight; payouts arrive every hour.', helpful: 3, verified_miner: true, created_at: now - 7200 },
		{ review_id: 'rv_2', project_id: wo.project.project_id, author: '0x6813eb9362372eef6200f3b1dbc3f819671cba69', rating: 4, comment: 'Good docs. Phone mining drains battery unless you set the charging-only policy.', helpful: 1, verified_miner: true, created_at: now - 86400 }
	);
	wo.announcements.push({ announcement_id: 'an_1', project_id: wo.project.project_id, title: 'Committee size raised to 5', content: 'Version 1 runs 5-miner committees with 3 backups.', type: 'update', author: SAMPLE_DEV, created_at: now - 3600 * 5 });
	st.collections.push({ id: 'editors-picks', kind: 'editors_picks', title: "Editors' picks", description: 'Projects the operator recommends for new miners.', project_ids: [wo.project.project_id], updated_at: now - 3600 });
	return st;
}

function economicsOf(m: S['Manifest']): S['ProjectEconomics'] {
	const e = m.consensus.economics;
	const epochCap = (BigInt(e.daily_emission) * BigInt(m.consensus.work.epoch_secs)) / 86400n;
	return {
		token: NECTA,
		reward_model: e.reward_model,
		reward_per_unit: e.reward_per_unit,
		daily_emission: e.daily_emission,
		epoch_secs: m.consensus.work.epoch_secs,
		epoch_cap: epochCap.toString(),
		fee_split_bp: e.fee_split_bp,
		min_collateral: e.min_collateral,
		slashing_bp: e.slashing_bp,
		dispute_window_secs: m.consensus.work.dispute_window_secs,
		vault: { address: e.vault, deployed: true, config_matches_manifest: true, balance: (25000n * E18).toString(), reserved: (1200n * E18).toString() }
	} as S['ProjectEconomics'];
}

function newAccount(address: string): Account {
	return {
		address,
		devices: [],
		subscriptions: [],
		proofs: [],
		leases: [],
		payouts: [],
		withdrawals: [],
		notifications: [],
		preferences: { watchlist: [], recent_searches: [], saved_addresses: [], earnings_goal: null, notifications: {}, display_name: null },
		developer: null,
		drafts: [],
		apiKeys: [],
		faucetNext: null,
		necta: 0n,
		nonce: 0
	};
}

/** Sample devices for a freshly signed-in wallet (so My Mining has something to show in dev). */
function seedDevices(acc: Account, now: number) {
	if (acc.devices.length) return;
	const mk = (label: string, cls: S['DeviceClass'], platform: S['Platform'], status: S['DeviceStatus'], hw: S['HardwareProfile']): S['Device'] => {
		const pk = fakeHash('pk:' + acc.address + label);
		return {
			node_id: 'ndsr-' + keccak256(pk).slice(2, 18),
			public_key: pk,
			owner: acc.address,
			binding_hash: fakeHash('binding:' + label + acc.address),
			label,
			group_id: null,
			class: cls,
			platform,
			os_version: hw.os ?? '',
			arch: hw.arch ?? '',
			engine: platform === 'ios' ? 'pulley64' : 'native',
			miner_version: '1.0.0',
			ndsr_version: '1.0.0',
			status,
			status_reason: null,
			last_seen_at: now - (status === 'online' ? 20 : 7200),
			connected_since: status === 'online' ? now - 3600 * 9 : null,
			hardware: hw,
			benchmark: { suite: 'bench-v1', ran_at: now - 86400, engine: 'native', cases: [], mgas_per_s: [249, 45, 300, 120], score: 179 },
			attestation: null,
			subscriptions: [],
			region: 'eu',
			uptime_bp_7d: status === 'online' ? 9910 : 6200,
			units_7d: status === 'online' ? 1840 : 220,
			created_at: now - 86400 * 4
		};
	};
	acc.devices.push(
		mk('Studio Mac', 'laptop', 'macos', 'online', { cpu_model: 'Apple M2', cpu_cores: 8, cpu_threads: 8, ram_mb: 16384, storage_free_mb: 120000, gpu: null, network: 'wifi', battery: true, os: 'macos 15.1', arch: 'aarch64' }),
		mk('Pixel 8', 'phone', 'android', 'idle', { cpu_model: 'Tensor G3', cpu_cores: 9, cpu_threads: 9, ram_mb: 8192, storage_free_mb: 40000, gpu: null, network: 'wifi', battery: true, os: 'android 15', arch: 'aarch64' })
	);
}

export interface MockHub {
	handle(req: Request): Promise<Response>;
	state(): State;
	reset(opts?: { empty?: boolean }): void;
}

const STORAGE_KEY = 'necter_mock_hub_v1';

export function createMockHub(opts: MockHubOptions = {}): MockHub {
	const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
	let st: State = load() ?? seed(now(), !!opts.empty);

	function load(): State | null {
		if (!opts.persist || typeof localStorage === 'undefined') return null;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			return raw ? (JSON.parse(raw, (_k, v) => (typeof v === 'string' && v.startsWith('bigint:') ? BigInt(v.slice(7)) : v)) as State) : null;
		} catch {
			return null;
		}
	}
	function save() {
		if (!opts.persist || typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(st, (_k, v) => (typeof v === 'bigint' ? 'bigint:' + v.toString() : v)));
		} catch {
			/* ignore */
		}
	}

	const reqId = () => 'req_' + (st.seq++).toString(36);
	const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
		new Response(status === 204 ? null : JSON.stringify(body), {
			status,
			headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', ...headers }
		});
	const err = (status: number, code: string, message: string, details?: Json) =>
		json(status, { error: code, message, details: details ?? {}, request_id: reqId() });
	const page = <T>(items: T[], url: URL) => {
		const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
		const start = Number(url.searchParams.get('cursor') ?? 0) || 0;
		const slice = items.slice(start, start + limit);
		return { items: slice, next_cursor: start + limit < items.length ? String(start + limit) : null };
	};

	function auth(req: Request): Account | null {
		const h = req.headers.get('Authorization') ?? '';
		const m = /^Bearer (\S+)$/.exec(h);
		if (!m) return null;
		const s = st.sessions[m[1]];
		if (!s || s.expires_at <= now()) return null;
		return (st.accounts[s.address] ??= newAccount(s.address));
	}

	function listed() {
		return st.projects.filter((p) => p.project.listing_status === 'listed');
	}
	function findProject(id: string) {
		return st.projects.find((p) => p.project.project_id === id);
	}
	function summary(p: MockProject): S['ProjectSummary'] {
		const { project } = p;
		return {
			project_id: project.project_id,
			slug: project.slug,
			developer: project.developer,
			developer_name: project.developer_name,
			developer_verified: project.developer_verified,
			name: project.name,
			tagline: project.tagline,
			category: project.category,
			tags: project.tags,
			icon: project.icon,
			accent_color: project.accent_color,
			listing_status: project.listing_status,
			device_classes: project.device_classes,
			token: project.token,
			reward_model: project.reward_model,
			min_collateral: project.min_collateral,
			miners: project.miners,
			avg_daily_reward_per_miner: project.avg_daily_reward_per_miner,
			average_rating_x100: project.average_rating_x100,
			review_count: project.review_count,
			trending: project.trending,
			featured: project.featured,
			listed_at: project.listed_at
		};
	}

	function bondPayload(acc: Account, sub: S['Subscription'], amount: string, devicePk: string): S['GaslessPayload'] {
		const deadline = now() + 3600;
		return {
			action: 'bond',
			typed_data: {
				domain: { name: 'Necter Staking', version: '1', chainId: CHAIN_ID, verifyingContract: MOCK_CONTRACTS.staking },
				types: {
					Bond: [
						{ name: 'owner', type: 'address' },
						{ name: 'projectId', type: 'bytes32' },
						{ name: 'nodeKey', type: 'bytes32' },
						{ name: 'amount', type: 'uint256' },
						{ name: 'nonce', type: 'uint256' },
						{ name: 'deadline', type: 'uint256' }
					]
				},
				primaryType: 'Bond',
				message: { owner: acc.address, projectId: sub.project_id, nodeKey: devicePk, amount, nonce: String(acc.nonce), deadline: String(deadline) }
			},
			permit: {
				domain: { name: 'NECTA (testnet)', version: '1', chainId: CHAIN_ID, verifyingContract: MOCK_CONTRACTS.necta },
				types: {
					Permit: [
						{ name: 'owner', type: 'address' },
						{ name: 'spender', type: 'address' },
						{ name: 'value', type: 'uint256' },
						{ name: 'nonce', type: 'uint256' },
						{ name: 'deadline', type: 'uint256' }
					]
				},
				primaryType: 'Permit',
				message: { owner: acc.address, spender: MOCK_CONTRACTS.staking, value: amount, nonce: String(acc.nonce), deadline: String(deadline) }
			},
			expires_at: deadline
		};
	}

	function simplePayload(acc: Account, action: 'unbond' | 'withdraw', subId: string): S['GaslessPayload'] {
		const deadline = now() + 3600;
		const primary = action === 'unbond' ? 'Unbond' : 'Withdraw';
		return {
			action,
			typed_data: {
				domain: { name: 'Necter Staking', version: '1', chainId: CHAIN_ID, verifyingContract: MOCK_CONTRACTS.staking },
				types: {
					[primary]: [
						{ name: 'owner', type: 'address' },
						{ name: 'subscriptionId', type: 'bytes32' },
						{ name: 'nonce', type: 'uint256' },
						{ name: 'deadline', type: 'uint256' }
					]
				},
				primaryType: primary,
				message: { owner: acc.address, subscriptionId: subId, nonce: String(acc.nonce), deadline: String(deadline) }
			},
			permit: null,
			expires_at: deadline
		};
	}

	async function verifyTyped(td: S['Eip712TypedData'], signature: string, expected: string): Promise<boolean> {
		try {
			const types = { ...(td.types as Record<string, { name: string; type: string }[]>) };
			delete (types as Record<string, unknown>).EIP712Domain;
			const signer = await (recoverTypedDataAddress as (a: unknown) => Promise<string>)({
				domain: td.domain,
				types,
				primaryType: td.primaryType,
				message: td.message,
				signature: signature as Hex
			});
			return signer.toLowerCase() === expected;
		} catch {
			return false;
		}
	}

	function notify(acc: Account, type: string, message: string, extra: Partial<S['Notification']> = {}) {
		acc.notifications.unshift({ id: 'ev_' + (st.seq++).toString(36), type, created_at: now(), message, read: false, severity: 'info', ...extra });
	}

	type Handler = (ctx: { req: Request; url: URL; params: Record<string, string>; body: () => Promise<Json> }) => Promise<Response> | Response;
	const routes: [string, RegExp, string[], Handler][] = [];
	function route(method: string, path: string, h: Handler) {
		const names: string[] = [];
		const re = new RegExp('^' + path.replace(/\{(\w+)\}/g, (_m, n) => (names.push(n), '([^/]+)')) + '$');
		routes.push([method, re, names, h]);
	}

	const needAuthEarly = (h: (acc: Account, ctx: Parameters<Handler>[0]) => Promise<Response> | Response): Handler => (ctx) => {
		const acc = auth(ctx.req);
		return acc ? h(acc, ctx) : err(401, 'unauthorized', 'sign in first');
	};

	// ── network ──
	const descriptor = (): S['NetworkDescriptor'] => ({
		network: 'necter-testnet',
		protocol: 'necter/1',
		api: 'v1',
		runtime: 'hive-wasm-v1',
		chain: {
			id: CHAIN_ID,
			name: 'Ethereum Sepolia',
			registry: MOCK_CONTRACTS.project_registry,
			token: MOCK_CONTRACTS.necta,
			contracts: {
				necta: MOCK_CONTRACTS.necta,
				faucet: MOCK_CONTRACTS.faucet,
				project_registry: MOCK_CONTRACTS.project_registry,
				vault_factory: MOCK_CONTRACTS.vault_factory,
				staking: MOCK_CONTRACTS.staking,
				treasury: MOCK_CONTRACTS.treasury
			},
			explorer: 'https://sepolia.etherscan.io'
		},
		hosts: { store: 'https://testnet.necter.network', rpc: 'https://testnet-rpc.necter.network', relay: 'wss://testnet-rpc.necter.network/v1/relay' },
		endpoints: { status: '/v1/status', params: '/v1/network/params', projects: '/v1/projects' },
		validators: { count: 4, quorum: 3 },
		params_hash: fakeHash('params'),
		versions: { hub: '1.0.0-mock', ndsr_min: '1.0.0', miner_min: '1.0.0', miner_latest: '1.0.0' },
		features: { committees: true, faucet: true, receipts_v2: true, governance: false },
		status: 'ok',
		time: now()
	});
	const validators: S['Validator'][] = ['us', 'eu', 'asia', 'africa'].map((r, i) => ({
		node_id: nodeIdFor('val' + i),
		public_key: fakeHash('valpk' + i),
		url: `https://node-${r}.testnet.necter.network`,
		region: r
	}));
	route('GET', '/', () => json(200, descriptor()));
	route('GET', '/v1/status', () =>
		json(200, {
			status: 'ok',
			time: now(),
			hub_version: '1.0.0-mock',
			validators: validators.map((v) => ({ ...v, reachable: true, capabilities: { committee: true } })),
			chain: { indexed_block: 7_000_000, head_block: 7_000_002, lag_secs: 24 },
			relay: { connected_devices: 68, available_slots: 212 },
			committees_enabled: true
		})
	);
	route('GET', '/v1/network/params', () =>
		json(200, {
			params: {
				gas_per_unit: 1_000_000,
				committee_min_size: 3,
				committee_max_size: 31,
				committee_max_backups: 16,
				dispute_window_secs_min: 3600,
				dispute_window_secs_max: 604800,
				slash_invalid_result_bp_max: 5000,
				slash_missed_sla_bp_max: 500,
				treasury_bp_min: 0,
				min_collateral_floor: E18.toString(),
				activation_delay_secs: 3600,
				unbonding_secs: 86400
			},
			params_hash: fakeHash('params')
		})
	);
	route('GET', '/v1/validators', () => json(200, { validators, count: validators.length, quorum: 3 }));
	route('GET', '/v1/network/treasury', () => json(200, { address: MOCK_CONTRACTS.treasury, balances: [{ token: NECTA, amount: (1234n * E18).toString() }] }));
	route('GET', '/v1/categories', () => {
		const counts = new Map<string, number>();
		for (const p of listed()) counts.set(p.project.category, (counts.get(p.project.category) ?? 0) + 1);
		return json(200, { items: [...counts.entries()].map(([slug, n]) => ({ slug, name: slug, projects: n })) });
	});
	route('GET', '/v1/collections', () => json(200, { items: st.collections }));
	route('GET', '/v1/collections/{id}', ({ params }) => {
		const c = st.collections.find((x) => x.id === params.id);
		return c ? json(200, c) : err(404, 'not_found', 'collection not found');
	});
	route('GET', '/v1/benchmarks/current', () => json(200, { suite: 'bench-v1', cases: [] }));
	route('GET', '/v1/events', ({ url }) => json(200, { items: [], next_cursor: null, ...(url.searchParams.get('after') ? {} : {}) }));

	// ── explorer ──
	function rounds(): S['RoundSummary'][] {
		const out: S['RoundSummary'][] = [];
		const t = now();
		listed().forEach((p, pi) => {
			for (let i = 0; i < 12; i++) {
				const epoch = Math.floor((t - i * 300) / 3600);
				const seq = 400 - i;
				const rid = 'task:' + fakeHash(`round:${p.project.project_id}:${i}`);
				out.push({
					round_id: rid,
					kind: 'task',
					state: i === 0 ? 'pending' : i === 5 ? 'fallback' : 'finalized',
					project_id: p.project.project_id,
					module_address: p.manifest.consensus.modules.worker,
					function: 'score',
					epoch,
					seq,
					receipt_hash: fakeHash('rcpt:' + rid),
					gas_used: 182_000 + i * 1000,
					committee_size: 5,
					votes: i === 0 ? 2 : 5,
					agreeing: i === 0 ? 2 : 5,
					audited: i % 7 === 3,
					created_at: t - i * 300 - pi * 40,
					finalized_at: i === 0 ? undefined : t - i * 300 - pi * 40 + 2
				});
			}
		});
		return out.sort((a, b) => b.created_at - a.created_at);
	}
	function epochs(projectFilter?: string | null): S['EpochSummary'][] {
		const out: S['EpochSummary'][] = [];
		const t = now();
		for (const p of listed()) {
			if (projectFilter && p.project.project_id !== projectFilter) continue;
			const cur = Math.floor(t / 3600);
			for (let i = 0; i < 6; i++) {
				const e = cur - i;
				const gross = (BigInt(40 + i) * E18) / 1n;
				out.push({
					project_id: p.project.project_id,
					epoch: e,
					epoch_secs: 3600,
					starts_at: e * 3600,
					ends_at: (e + 1) * 3600,
					status: i === 0 ? 'open' : i === 1 ? 'attested' : i === 2 ? 'settled' : 'released',
					rounds: 420,
					fallback_rounds: 2,
					miners: p.project.miners,
					token: NECTA,
					totals: {
						units: 2100,
						gross: gross.toString(),
						miner: ((gross * 8500n) / 10000n).toString(),
						developer: ((gross * 1000n) / 10000n).toString(),
						treasury: (gross - (gross * 8500n) / 10000n - (gross * 1000n) / 10000n).toString()
					},
					receipt_hash: i === 0 ? undefined : fakeHash(`epoch:${p.project.project_id}:${e}`),
					merkle_root: i === 0 ? undefined : fakeHash(`root:${p.project.project_id}:${e}`),
					settlement: i < 2 ? undefined : { status: i === 2 ? 'settled' : 'released', tx_hash: fakeHash(`settle:${e}`), block_number: 7_000_000 - i * 300, claimable_at: (e + 2) * 3600 }
				});
			}
		}
		return out.sort((a, b) => b.epoch - a.epoch);
	}
	route('GET', '/v1/explorer/stats', () => {
		let miners = 0;
		for (const p of listed()) miners += p.project.miners ?? 0;
		return json(200, {
			projects_listed: listed().length,
			miners_online: miners,
			devices_online: miners + 7,
			rounds_24h: listed().length ? 12096 : 0,
			rounds_finalized_24h: listed().length ? 12031 : 0,
			units_24h: listed().length ? 60480 : 0,
			validators: validators.length,
			collateral_bonded: (18_500n * E18).toString(),
			updated_at: now()
		});
	});
	route('GET', '/v1/explorer/rounds', ({ url }) => {
		let r = rounds();
		const p = url.searchParams.get('project_id');
		if (p) r = r.filter((x) => x.project_id === p);
		const s = url.searchParams.get('state');
		if (s) r = r.filter((x) => x.state === s);
		return json(200, page(r, url));
	});
	route('GET', '/v1/explorer/rounds/{id}', ({ params }) => {
		const r = rounds().find((x) => x.round_id === decodeURIComponent(params.id));
		return r ? json(200, { ...r, finality: { v: 1, round_id: r.round_id, project_id: r.project_id, epoch: r.epoch, set_hash: fakeHash('set'), receipt_hash: r.receipt_hash, gas_used: r.gas_used, audited: r.audited, voters: [] } }) : err(404, 'not_found', 'round not found');
	});
	route('GET', '/v1/explorer/receipts/{h}', ({ params }) => {
		const r = rounds().find((x) => x.receipt_hash === params.h);
		if (r) return json(200, { kind: 'execution', receipt: { v: 1, module_address: r.module_address, function: r.function, gas_used: r.gas_used, success: true }, rounds: [r.round_id] });
		const e = epochs().find((x) => x.receipt_hash === params.h);
		if (e) return json(200, { kind: 'reward_v2', receipt: { v: 2, project_id: e.project_id, round: e.epoch, totals: e.totals, merkle_root: e.merkle_root }, settlement: e.settlement });
		return err(404, 'not_found', 'receipt not found');
	});
	route('GET', '/v1/explorer/epochs', ({ url }) => json(200, page(epochs(url.searchParams.get('project_id')), url)));
	route('GET', '/v1/explorer/epochs/{p}/{e}', ({ params }) => {
		const e = epochs(params.p).find((x) => x.epoch === Number(params.e));
		return e ? json(200, e) : err(404, 'not_found', 'epoch not found');
	});
	route('GET', '/v1/explorer/slashes', ({ url }) => json(200, page([] as S['Slash'][], url)));
	route('GET', '/v1/explorer/search', ({ url }) => {
		const q = (url.searchParams.get('q') ?? '').toLowerCase();
		const items: { type: string; id: string; label: string }[] = [];
		for (const p of listed()) if (p.project.name.toLowerCase().includes(q) || p.project.project_id === q) items.push({ type: 'project', id: p.project.project_id, label: p.project.name });
		for (const r of rounds()) if (r.round_id.includes(q) || r.receipt_hash === q) items.push({ type: 'round', id: r.round_id, label: `Round ${r.seq}` });
		if (/^0x[0-9a-f]{40}$/.test(q)) items.push({ type: 'account', id: q, label: q });
		return json(200, { items: items.slice(0, 20) });
	});
	route('GET', '/v1/modules', ({ url }) => json(200, page(st.modules, url)));
	route('GET', '/v1/modules/{a}', ({ params }) => {
		const m = st.modules.find((x) => x.manifest_address === params.a);
		return m ? json(200, m) : err(404, 'not_found', 'module not found');
	});

	// ── projects ──
	route('GET', '/v1/projects', ({ url, req }) => {
		const acc = auth(req);
		const status = url.searchParams.get('status');
		const developer = url.searchParams.get('developer');
		let ps = st.projects.filter((p) => (status ? p.project.listing_status === status && (acc?.address === p.project.developer) : p.project.listing_status === 'listed'));
		const q = url.searchParams.get('q')?.toLowerCase();
		if (q) ps = ps.filter((p) => [p.project.name, p.project.tagline ?? '', ...(p.project.tags ?? [])].join(' ').toLowerCase().includes(q));
		const cat = url.searchParams.get('category');
		if (cat) ps = ps.filter((p) => p.project.category === cat);
		const tag = url.searchParams.get('tag');
		if (tag) ps = ps.filter((p) => p.project.tags?.includes(tag));
		const dc = url.searchParams.get('device_class');
		if (dc) ps = ps.filter((p) => p.project.device_classes?.includes(dc as S['DeviceClass']));
		if (developer) ps = ps.filter((p) => p.project.developer === developer);
		const sort = url.searchParams.get('sort') ?? 'trending';
		const key: Record<string, (p: MockProject) => number | string> = {
			trending: (p) => -(p.project.miners ?? 0) - (p.project.trending ? 1000 : 0),
			newest: (p) => -(p.project.listed_at ?? 0),
			miners: (p) => -(p.project.miners ?? 0),
			earnings: (p) => -Number(BigInt(p.project.avg_daily_reward_per_miner ?? '0') / 10n ** 15n),
			rating: (p) => -(p.project.average_rating_x100 ?? 0),
			name: (p) => p.project.name.toLowerCase()
		};
		const k = key[sort] ?? key.trending;
		ps = [...ps].sort((a, b) => (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0));
		return json(200, page(ps.map(summary), url));
	});
	route('GET', '/v1/projects/{id}', ({ params, req }) => {
		const p = findProject(params.id);
		const acc = auth(req);
		if (!p || (p.project.listing_status !== 'listed' && p.project.listing_status !== 'paused' && acc?.address !== p.project.developer)) return err(404, 'not_found', 'project not found');
		return json(200, p.project);
	});
	route('GET', '/v1/projects/{id}/manifest', ({ params }) => {
		const p = findProject(params.id);
		if (!p) return err(404, 'not_found', 'project not found');
		const d = digestManifest(p.manifest);
		return json(200, { manifest: p.manifest, manifest_hash: d.manifest_hash, consensus_hash: d.consensus_hash, project_id: d.project_id, sig_type: 'eip191', signature: '0x' + '00'.repeat(65) });
	});
	route('GET', '/v1/projects/{id}/versions', ({ params, url }) => {
		const p = findProject(params.id);
		return p ? json(200, page([...p.versions].reverse(), url)) : err(404, 'not_found', 'project not found');
	});
	route('GET', '/v1/projects/{id}/economics', ({ params }) => {
		const p = findProject(params.id);
		return p ? json(200, economicsOf(p.manifest)) : err(404, 'not_found', 'project not found');
	});
	route('GET', '/v1/projects/{id}/stats', ({ params, url }) => {
		const p = findProject(params.id);
		return p ? json(200, { ...(p.project.stats ?? {}), period: url.searchParams.get('period') ?? '7d' }) : err(404, 'not_found', 'project not found');
	});
	route('GET', '/v1/projects/{id}/miners', ({ params, url }) => {
		const p = findProject(params.id);
		if (!p) return err(404, 'not_found', 'project not found');
		const classes: S['DeviceClass'][] = ['laptop', 'phone', 'desktop', 'server'];
		const miners: S['ProjectMiner'][] = Array.from({ length: Math.min(p.project.miners ?? 0, 25) }, (_, i) => ({
			node_id: nodeIdFor(p.project.slug + i),
			owner: ('0x' + fakeHash('owner' + i).slice(26)) as string,
			class: classes[i % 4],
			status: i % 6 === 5 ? 'offline' : 'online',
			units: 2000 - i * 61,
			reputation: 9000 - i * 90,
			uptime_bp: 9950 - i * 20,
			since: now() - 86400 * (i + 1)
		}));
		return json(200, page(miners, url));
	});
	route('GET', '/v1/projects/{id}/epochs', ({ params, url }) => json(200, page(epochs(params.id), url)));
	route('GET', '/v1/projects/{id}/rounds', ({ params, url }) => json(200, page(rounds().filter((r) => r.project_id === params.id), url)));
	route('POST', '/v1/projects/{id}/compatibility', async ({ params, body, req }) => {
		const p = findProject(params.id);
		if (!p) return err(404, 'not_found', 'project not found');
		const b = await body();
		let hw = b.hardware as S['HardwareProfile'] | undefined;
		let cls = b.class as S['DeviceClass'] | undefined;
		if (b.node_id) {
			const acc = auth(req);
			const d = acc?.devices.find((x) => x.node_id === b.node_id);
			if (!d) return err(404, 'not_found', 'device not found');
			hw = d.hardware;
			cls = d.class;
		}
		const r = p.manifest.scheduling.requirements;
		const missing: string[] = [];
		const warnings: string[] = [];
		if (cls && !r.device_classes.includes(cls)) missing.push(`device class ${cls} not accepted`);
		if ((hw?.cpu_cores ?? 0) < r.cpu_cores) missing.push(`needs ${r.cpu_cores} CPU cores`);
		if ((hw?.ram_mb ?? 0) < r.ram_mb) missing.push(`needs ${r.ram_mb} MB RAM`);
		if ((hw?.storage_free_mb ?? 0) < r.storage_mb) missing.push(`needs ${r.storage_mb} MB free storage`);
		if (hw?.battery) warnings.push('Battery device: mining pauses when unplugged unless you change the policy');
		const compatible = missing.length === 0;
		return json(200, {
			compatible,
			tier: compatible ? (warnings.length ? 'marginal' : 'compatible') : 'incompatible',
			match_bp: compatible ? 10000 - warnings.length * 1500 : 3000,
			missing,
			warnings,
			performance: compatible ? 'good' : 'poor',
			est_monthly_reward: compatible ? (BigInt(p.project.avg_daily_reward_per_miner ?? '0') * 30n).toString() : '0'
		});
	});
	route('GET', '/v1/projects/{id}/reviews', ({ params, url }) => {
		const p = findProject(params.id);
		if (!p) return err(404, 'not_found', 'project not found');
		const avg = p.reviews.length ? Math.round((p.reviews.reduce((s, r) => s + r.rating, 0) * 100) / p.reviews.length) : null;
		return json(200, { ...page([...p.reviews].sort((a, b) => b.created_at - a.created_at), url), average_rating_x100: avg, count: p.reviews.length });
	});
	route('PUT', '/v1/projects/{id}/reviews', async ({ params, req, body }) => {
		const acc = auth(req);
		if (!acc) return err(401, 'unauthorized', 'sign in first');
		const p = findProject(params.id);
		if (!p) return err(404, 'not_found', 'project not found');
		if (!acc.subscriptions.some((s) => s.project_id === params.id)) return err(403, 'forbidden', 'Only miners with a credited round on this project can review it');
		const b = await body();
		const existing = p.reviews.find((r) => r.author === acc.address);
		const rev: S['Review'] = { review_id: existing?.review_id ?? 'rv_' + (st.seq++).toString(36), project_id: params.id, author: acc.address, rating: Number(b.rating), comment: String(b.comment ?? ''), helpful: existing?.helpful ?? 0, verified_miner: true, created_at: existing?.created_at ?? now(), updated_at: now() };
		p.reviews = [rev, ...p.reviews.filter((r) => r.author !== acc.address)];
		p.project.review_count = p.reviews.length;
		p.project.average_rating_x100 = Math.round((p.reviews.reduce((s, r) => s + r.rating, 0) * 100) / p.reviews.length);
		save();
		return json(200, rev);
	});
	route('DELETE', '/v1/projects/{id}/reviews', needAuthEarly((acc, { params }) => {
		const p = findProject(params.id);
		if (!p) return err(404, 'not_found', 'project not found');
		p.reviews = p.reviews.filter((r) => r.author !== acc.address);
		p.project.review_count = p.reviews.length;
		p.project.average_rating_x100 = p.reviews.length ? Math.round((p.reviews.reduce((x, r) => x + r.rating, 0) * 100) / p.reviews.length) : null;
		save();
		return json(204, null);
	}));
	route('POST', '/v1/projects/{id}/reviews/{rid}/helpful', ({ params }) => {
		const p = findProject(params.id);
		const r = p?.reviews.find((x) => x.review_id === params.rid);
		if (!r) return err(404, 'not_found', 'review not found');
		r.helpful = (r.helpful ?? 0) + 1;
		save();
		return json(200, { helpful: r.helpful });
	});
	route('GET', '/v1/projects/{id}/announcements', ({ params, url }) => {
		const p = findProject(params.id);
		return p ? json(200, page(p.announcements, url)) : err(404, 'not_found', 'project not found');
	});
	route('POST', '/v1/projects/{id}/reports', ({ req }) => (auth(req) ? json(201, { report_id: 'rep_' + (st.seq++).toString(36) }) : err(401, 'unauthorized', 'sign in first')));

	// ── auth ──
	route('POST', '/v1/auth/nonce', async ({ body }) => {
		const b = await body();
		const address = String(b.address ?? '');
		const domain = String(b.domain ?? '');
		if (!/^0x[0-9a-f]{40}$/.test(address)) return err(400, 'invalid_field', 'address must be lowercase hex');
		if (![...ALLOWED_DOMAINS, ...(opts.allowDomains ?? [])].includes(domain)) return err(400, 'invalid_field', `domain ${domain} not allowed`);
		const nonce = Array.from({ length: 17 }, (_, i) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[(st.seq * 7 + i * 13 + now()) % 57]).join('');
		st.seq++;
		const issued = now();
		const uri = domain.includes(':') ? `http://${domain}` : `https://${domain}`;
		const message = buildSiweMessage({ domain, address, statement: 'Sign in to Necter testnet.', uri, chainId: CHAIN_ID, nonce, issuedAt: issued, expirationTime: issued + 12 * 3600 });
		st.nonces[nonce] = { address, domain, expires_at: issued + 300, message };
		return json(200, { nonce, issued_at: issued, expires_at: issued + 300, message });
	});
	route('POST', '/v1/auth/siwe', async ({ body }) => {
		const b = await body();
		const message = String(b.message ?? '');
		const signature = String(b.signature ?? '');
		const parsed = parseSiweMessage(message);
		const n = parsed.nonce ? st.nonces[parsed.nonce] : undefined;
		if (!n || n.expires_at < now() || n.message !== message) return err(401, 'unauthorized', 'unknown or expired nonce');
		delete st.nonces[parsed.nonce!];
		if (parsed.chainId !== CHAIN_ID) return err(401, 'unauthorized', 'wrong chain id');
		if (parsed.statement !== 'Sign in to Necter testnet.') return err(401, 'unauthorized', 'statement mismatch');
		if (!/^0x[0-9a-f]{130}$/.test(signature)) return err(400, 'invalid_field', 'signature must be lowercase hex');
		let signer: string;
		try {
			signer = (await recoverMessageAddress({ message, signature: signature as Hex })).toLowerCase();
		} catch {
			return err(401, 'bad_signature', 'signature does not recover');
		}
		if (signer !== n.address) return err(401, 'bad_signature', 'signer does not match the address');
		const token = 'nsess_' + fakeHash('sess:' + signer + st.seq++).slice(2, 45);
		const expires_at = now() + 12 * 3600;
		st.sessions[token] = { address: signer, expires_at };
		const acc = (st.accounts[signer] ??= newAccount(signer));
		seedDevices(acc, now());
		save();
		return json(200, { token, address: signer, expires_at, roles: roles(acc) });
	});
	function roles(acc: Account): ('miner' | 'developer' | 'operator')[] {
		const r: ('miner' | 'developer' | 'operator')[] = [];
		if (acc.devices.length || acc.subscriptions.length) r.push('miner');
		if (acc.developer?.enrollment?.status === 'active') r.push('developer');
		return r;
	}
	route('GET', '/v1/auth/session', ({ req }) => {
		const acc = auth(req);
		if (!acc) return err(401, 'unauthorized', 'no session');
		const token = /^Bearer (\S+)$/.exec(req.headers.get('Authorization') ?? '')![1];
		return json(200, { address: acc.address, expires_at: st.sessions[token].expires_at, roles: roles(acc) });
	});
	route('POST', '/v1/auth/logout', ({ req }) => {
		const m = /^Bearer (\S+)$/.exec(req.headers.get('Authorization') ?? '');
		if (m) delete st.sessions[m[1]];
		save();
		return json(204, null);
	});

	// ── me / accounts ──
	const needAuth = (h: (acc: Account, ctx: Parameters<Handler>[0]) => Promise<Response> | Response): Handler => (ctx) => {
		const acc = auth(ctx.req);
		return acc ? h(acc, ctx) : err(401, 'unauthorized', 'sign in first');
	};
	route('GET', '/v1/me', needAuth((acc) => json(200, { address: acc.address, roles: roles(acc), devices: acc.devices.length, subscriptions: acc.subscriptions.length, developer: acc.developer, unread_notifications: acc.notifications.filter((n) => !n.read).length, faucet_next_eligible_at: acc.faucetNext ?? undefined })));
	route('GET', '/v1/me/preferences', needAuth((acc) => json(200, acc.preferences)));
	route('PUT', '/v1/me/preferences', needAuth(async (acc, { body }) => {
		const b = await body();
		const allowed = ['watchlist', 'recent_searches', 'saved_addresses', 'earnings_goal', 'notifications', 'display_name'];
		for (const k of Object.keys(b)) if (!allowed.includes(k)) return err(400, 'invalid_field', `unknown key ${k}`);
		acc.preferences = { ...acc.preferences, ...b } as S['Preferences'];
		save();
		return json(200, acc.preferences);
	}));
	route('GET', '/v1/me/events', needAuth((acc) => json(200, { items: acc.notifications, next_cursor: null })));
	route('GET', '/v1/me/notifications', needAuth((acc, { url }) => {
		const unreadOnly = url.searchParams.get('unread') === 'true';
		const items = unreadOnly ? acc.notifications.filter((n) => !n.read) : acc.notifications;
		return json(200, { ...page(items, url), unread: acc.notifications.filter((n) => !n.read).length });
	}));
	route('POST', '/v1/me/notifications/read', needAuth(async (acc, { body }) => {
		const b = await body();
		const ids = Array.isArray(b.ids) ? (b.ids as string[]) : [];
		for (const n of acc.notifications) if (b.all || ids.includes(n.id)) n.read = true;
		save();
		return json(204, null);
	}));
	route('GET', '/v1/me/alerts', needAuth((acc) => {
		const items = acc.devices.filter((d) => d.status === 'offline').map((d) => ({ id: 'al_' + d.node_id, type: 'offline', severity: 'warning', message: `${d.label ?? d.node_id} is offline`, node_id: d.node_id, created_at: now() - 600 }));
		return json(200, { items });
	}));
	route('GET', '/v1/accounts/{a}', ({ params }) => {
		const acc = st.accounts[params.a];
		const dev = st.projects.filter((p) => p.project.developer === params.a);
		if (!acc && !dev.length) return err(404, 'not_found', 'unknown account');
		return json(200, {
			address: params.a,
			display_name: acc?.preferences.display_name ?? null,
			devices_online: acc?.devices.filter((d) => d.status === 'online').length ?? 0,
			devices_total: acc?.devices.length ?? 0,
			projects: [...new Set(acc?.subscriptions.map((s) => s.project_id) ?? [])],
			units_30d: acc?.devices.reduce((s, d) => s + (d.units_7d ?? 0) * 4, 0) ?? 0,
			reputation_avg: 8200,
			first_seen_at: now() - 86400 * 4,
			developer: acc?.developer ?? (dev.length ? { address: params.a, display_name: 'Sample Labs', enrollment: { status: 'active' }, verification: { status: 'verified' }, projects: dev.length } : null)
		});
	});
	route('GET', '/v1/accounts/{a}/balances', ({ params }) => {
		const acc = st.accounts[params.a];
		const bonded = acc?.subscriptions.reduce((s, x) => s + BigInt(x.collateral), 0n) ?? 0n;
		const unclaimed = acc?.payouts.filter((p) => p.status === 'claimable').reduce((s, p) => s + BigInt(p.amount), 0n) ?? 0n;
		return json(200, {
			address: params.a,
			balances: [
				{ token: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Sepolia Ether', decimals: 18 }, amount: '0' },
				{ token: NECTA, amount: (acc?.necta ?? 0n).toString() }
			],
			unclaimed: unclaimed > 0n ? [{ token: NECTA, amount: unclaimed.toString() }] : [],
			collateral_bonded: bonded.toString(),
			block_number: 7_000_000
		});
	});
	route('GET', '/v1/leaderboards', ({ url }) => {
		const metric = url.searchParams.get('metric') ?? 'units';
		const items = Array.from({ length: 15 }, (_, i) => ({
			rank: i + 1,
			address: '0x' + fakeHash('lb' + i).slice(26),
			value: metric === 'earnings' ? ((BigInt(400 - i * 20) * E18) / 1n).toString() : metric === 'uptime' || metric === 'reputation' ? String(9990 - i * 37) : String(9800 - i * 410),
			devices: 1 + (i % 4)
		}));
		return json(200, { items });
	});

	// ── devices ──
	route('GET', '/v1/me/devices', needAuth((acc, { url }) => {
		let d = acc.devices;
		const g = url.searchParams.get('group_id');
		if (g) d = d.filter((x) => x.group_id === g);
		const s = url.searchParams.get('status');
		if (s) d = d.filter((x) => x.status === s);
		return json(200, page(d, url));
	}));
	route('GET', '/v1/devices/{id}', ({ params, req }) => {
		for (const acc of Object.values(st.accounts)) {
			const d = acc.devices.find((x) => x.node_id === params.id);
			if (d) {
				const me = auth(req);
				if (me?.address === acc.address) return json(200, d);
				const { label: _l, hardware: _h, ...pub } = d;
				return json(200, pub);
			}
		}
		return err(404, 'not_found', 'device not found');
	});
	route('PATCH', '/v1/devices/{id}', needAuth(async (acc, { params, body }) => {
		const d = acc.devices.find((x) => x.node_id === params.id);
		if (!d) return err(403, 'not_owner', 'not your device');
		const b = await body();
		if (typeof b.label === 'string') d.label = b.label.slice(0, 64);
		if ('group_id' in b) d.group_id = (b.group_id as string | null) ?? null;
		save();
		return json(200, d);
	}));
	route('POST', '/v1/devices/unbind', async ({ body, req }) => {
		const b = await body();
		const acc = auth(req);
		if (!acc) return err(422, 'invalid_binding', 'unsigned unbind');
		acc.devices = acc.devices.filter((d) => d.node_id !== b.node_id);
		save();
		return json(200, {});
	});
	route('GET', '/v1/me/device-groups', needAuth((acc) => {
		const groups = new Map<string, S['DeviceGroup']>();
		for (const d of acc.devices) if (d.group_id) {
			const g = groups.get(d.group_id) ?? { group_id: d.group_id, name: d.group_id, node_ids: [] };
			g.node_ids.push(d.node_id);
			groups.set(d.group_id, g);
		}
		return json(200, { items: [...groups.values()] });
	}));
	route('POST', '/v1/me/device-groups', needAuth(async (acc, { body }) => {
		const b = await body();
		const id = 'grp_' + (st.seq++).toString(36);
		for (const d of acc.devices) if ((b.node_ids as string[] | undefined)?.includes(d.node_id)) d.group_id = id;
		save();
		return json(201, { group_id: id, name: String(b.name), node_ids: (b.node_ids as string[]) ?? [], updated_at: now() });
	}));

	// ── subscriptions ──
	function findSub(id: string): [Account, S['Subscription']] | null {
		for (const acc of Object.values(st.accounts)) {
			const s = acc.subscriptions.find((x) => x.subscription_id === id);
			if (s) return [acc, s];
		}
		return null;
	}
	route('POST', '/v1/subscriptions', needAuth(async (acc, { body }) => {
		const b = await body();
		const p = findProject(String(b.project_id));
		if (!p || p.project.listing_status !== 'listed') return err(404, 'not_found', 'project not found');
		const d = acc.devices.find((x) => x.node_id === b.node_id);
		if (!d) return err(403, 'not_owner', 'device is not bound to this wallet');
		const collateral = String(b.collateral ?? '');
		if (!/^(0|[1-9][0-9]{0,77})$/.test(collateral)) return err(400, 'invalid_field', 'collateral must be a wei string');
		if (BigInt(collateral) < BigInt(p.manifest.consensus.economics.min_collateral)) return err(422, 'insufficient_collateral', 'below the project minimum');
		const subId = deriveSubscriptionId(p.project.project_id, acc.address, d.public_key);
		if (acc.subscriptions.some((s) => s.subscription_id === subId && s.status !== 'closed')) return err(409, 'already_exists', 'this device already mines this project');
		const sub: S['Subscription'] = {
			subscription_id: subId,
			project_id: p.project.project_id,
			project_name: p.project.name,
			node_id: d.node_id,
			owner: acc.address,
			payout_address: acc.address,
			status: 'pending_collateral',
			collateral: '0',
			min_collateral: p.manifest.consensus.economics.min_collateral,
			collateral_health: 'healthy',
			release_at: null,
			pending_slashes: 0,
			slashed_total: '0',
			reputation: 5000,
			uptime_bp: 0,
			leases_completed: 0,
			units_total: 0,
			earned_total: '0',
			token: NECTA,
			last_proof_at: null,
			started_at: null,
			created_at: now()
		};
		acc.subscriptions = [sub, ...acc.subscriptions.filter((s) => s.subscription_id !== subId)];
		save();
		return json(201, { subscription: sub, bond: bondPayload(acc, sub, collateral, d.public_key) });
	}));
	route('GET', '/v1/me/subscriptions', needAuth((acc, { url }) => {
		let s = acc.subscriptions;
		for (const k of ['project_id', 'node_id', 'status'] as const) {
			const v = url.searchParams.get(k);
			if (v) s = s.filter((x) => x[k] === v);
		}
		return json(200, page(s, url));
	}));
	route('GET', '/v1/me/collateral', needAuth((acc) => {
		const sum = (f: (s: S['Subscription']) => boolean) => acc.subscriptions.filter(f).reduce((t, s) => t + BigInt(s.collateral), 0n).toString();
		return json(200, {
			bonded: sum((s) => ['active', 'paused', 'jailed', 'pending_collateral'].includes(s.status)),
			unbonding: sum((s) => s.status === 'unbonding'),
			withdrawable: sum((s) => s.status === 'withdrawable'),
			slashed_total: '0',
			pending_slashes: 0,
			necta_balance: acc.necta.toString(),
			subscriptions: acc.subscriptions
		});
	}));
	route('GET', '/v1/subscriptions/{id}', ({ params }) => {
		const f = findSub(params.id);
		return f ? json(200, f[1]) : err(404, 'not_found', 'subscription not found');
	});
	route('POST', '/v1/subscriptions/{id}/bond-payload', needAuth(async (acc, { params, body }) => {
		const s = acc.subscriptions.find((x) => x.subscription_id === params.id);
		const d = acc.devices.find((x) => x.node_id === s?.node_id);
		if (!s || !d) return err(404, 'not_found', 'subscription not found');
		const b = await body();
		return json(200, bondPayload(acc, s, String(b.amount), d.public_key));
	}));
	route('POST', '/v1/subscriptions/{id}/bond', needAuth(async (acc, { params, body }) => {
		const s = acc.subscriptions.find((x) => x.subscription_id === params.id);
		if (!s) return err(404, 'not_found', 'subscription not found');
		const b = await body();
		const td = b.typed_data as S['Eip712TypedData'];
		if (!td || td.primaryType !== 'Bond') return err(400, 'invalid_field', 'Bond typed data required');
		if (!(await verifyTyped(td, String(b.signature), acc.address))) return err(422, 'bad_signature', 'Bond signature does not recover to the owner');
		if (b.permit && !(await verifyTyped(b.permit as S['Eip712TypedData'], String(b.permit_signature), acc.address))) return err(422, 'bad_signature', 'Permit signature does not recover to the owner');
		const amount = BigInt(String((td.message as Json).amount));
		if (acc.necta < amount) return err(422, 'insufficient_collateral', 'not enough NECTA — use the faucet');
		acc.necta -= amount;
		acc.nonce++;
		s.collateral = (BigInt(s.collateral) + amount).toString();
		s.status = 'active';
		s.started_at ??= now();
		const d = acc.devices.find((x) => x.node_id === s.node_id);
		if (d && !d.subscriptions?.includes(s.subscription_id)) d.subscriptions = [...(d.subscriptions ?? []), s.subscription_id];
		notify(acc, 'subscription.active', `Collateral bonded — ${s.project_name} starts with the next snapshot`, { subscription_id: s.subscription_id, project_id: s.project_id });
		save();
		return json(202, { status: 'confirmed', tx_hash: fakeHash('bondtx' + st.seq++), error: null });
	}));
	for (const action of ['pause', 'resume'] as const) {
		route('POST', `/v1/subscriptions/{id}/${action}`, needAuth((acc, { params }) => {
			const s = acc.subscriptions.find((x) => x.subscription_id === params.id);
			if (!s) return err(403, 'not_owner', 'not your subscription');
			if (action === 'pause' && s.status !== 'active') return err(409, 'invalid_state', `cannot pause a ${s.status} subscription`);
			if (action === 'resume' && s.status !== 'paused') return err(409, 'invalid_state', `cannot resume a ${s.status} subscription`);
			s.status = action === 'pause' ? 'paused' : 'active';
			save();
			return json(200, s);
		}));
	}
	for (const action of ['unbond', 'withdraw'] as const) {
		route('POST', `/v1/subscriptions/{id}/${action}`, needAuth(async (acc, { params, req }) => {
			const s = acc.subscriptions.find((x) => x.subscription_id === params.id);
			if (!s) return err(404, 'not_found', 'subscription not found');
			const text = await req.text();
			if (action === 'unbond' && !['active', 'paused', 'jailed'].includes(s.status)) return err(409, 'invalid_state', `cannot unbond a ${s.status} subscription`);
			if (action === 'withdraw' && s.status !== 'withdrawable' && !(s.status === 'unbonding' && (s.release_at ?? Infinity) <= now()))
				return err(409, 'invalid_state', 'collateral is not withdrawable yet');
			if (!text) return json(200, simplePayload(acc, action, s.subscription_id));
			const b = JSON.parse(text) as Json;
			if (!(await verifyTyped(b.typed_data as S['Eip712TypedData'], String(b.signature), acc.address))) return err(422, 'bad_signature', 'signature does not recover to the owner');
			acc.nonce++;
			if (action === 'unbond') {
				s.status = 'unbonding';
				s.release_at = now() + 86400;
			} else {
				acc.necta += BigInt(s.collateral);
				acc.withdrawals.unshift({ withdrawal_id: 'wd_' + (st.seq++).toString(36), kind: 'collateral', status: 'completed', amount: s.collateral, token: NECTA, recipient: acc.address, subscription_id: s.subscription_id, fee: '0', tx_hash: fakeHash('wd' + st.seq), requested_at: now(), completed_at: now(), error: null });
				s.collateral = '0';
				s.status = 'closed';
			}
			save();
			return json(202, { status: 'confirmed', tx_hash: fakeHash(action + st.seq++), error: null });
		}));
	}

	// ── earnings / proofs ──
	function ensureActivity(acc: Account) {
		if (acc.proofs.length || !acc.subscriptions.some((s) => s.status === 'active')) return;
		const t = now();
		const active = acc.subscriptions.filter((s) => s.status === 'active');
		active.forEach((s, si) => {
			for (let i = 0; i < 8; i++) {
				const rid = 'task:' + fakeHash(`myround:${s.subscription_id}:${i}`);
				const status: S['ProofStatus'] = i === 0 ? 'pending' : i === 4 ? 'missed' : 'verified';
				acc.proofs.push({ proof_id: fakeHash('proof:' + rid), round_id: rid, project_id: s.project_id, subscription_id: s.subscription_id, node_id: s.node_id, epoch: Math.floor((t - i * 600) / 3600), status, receipt_hash: status === 'missed' ? null : fakeHash('r:' + rid), final_receipt_hash: status === 'verified' ? fakeHash('r:' + rid) : null, units: status === 'verified' ? 1 : 0, expected_amount: status === 'verified' ? (85n * 10n ** 15n).toString() : '0', rejection_reason: status === 'missed' ? 'missed' : null, audited: i === 2, finality_ms: status === 'verified' ? 1700 + i * 40 : null, slash_id: null, submitted_at: t - i * 600 - si * 30, verified_at: status === 'verified' ? t - i * 600 + 2 : null });
				acc.leases.push({ lease_id: 'ls_' + i + '_' + si, round_id: rid, project_id: s.project_id, node_id: s.node_id, position: i % 5, role: i % 5 < 4 ? 'primary' : 'backup', state: status === 'missed' ? 'missed' : status === 'pending' ? 'voted' : 'finalized', function: 'score', deadline: t - i * 600 + 30, units: status === 'verified' ? 1 : null, created_at: t - i * 600, completed_at: status === 'verified' ? t - i * 600 + 3 : null });
			}
			for (let e = 1; e <= 3; e++) {
				const ep = Math.floor(t / 3600) - e;
				acc.payouts.push({ project_id: s.project_id, epoch: ep, miner: acc.address, units: 6, amount: (510n * 10n ** 15n).toString(), token: NECTA, status: e === 1 ? 'settled' : 'claimable', claim_tx: null, claimable_at: (ep + 2) * 3600 });
			}
		});
	}
	route('GET', '/v1/me/leases', needAuth((acc, { url }) => {
		ensureActivity(acc);
		let l = acc.leases;
		for (const k of ['state', 'node_id', 'project_id'] as const) {
			const v = url.searchParams.get(k);
			if (v) l = l.filter((x) => x[k] === v);
		}
		return json(200, page(l, url));
	}));
	route('GET', '/v1/me/proofs', needAuth((acc, { url }) => {
		ensureActivity(acc);
		let p = acc.proofs;
		for (const k of ['status', 'project_id', 'node_id'] as const) {
			const v = url.searchParams.get(k);
			if (v) p = p.filter((x) => x[k] === v);
		}
		return json(200, page(p, url));
	}));
	route('GET', '/v1/me/proofs/stats', needAuth((acc) => {
		ensureActivity(acc);
		const c = (s: string) => acc.proofs.filter((p) => p.status === s).length;
		const total = acc.proofs.length;
		return json(200, { submitted: total, verified: c('verified'), rejected: c('rejected'), missed: c('missed'), success_bp: total ? Math.round((c('verified') * 10000) / total) : 0, avg_finality_ms: 1820, rejection_reasons: { missed: c('missed') } });
	}));
	route('GET', '/v1/proofs/{id}', ({ params }) => {
		for (const acc of Object.values(st.accounts)) {
			const p = acc.proofs.find((x) => x.proof_id === params.id);
			if (p) return json(200, { ...p, finality_validators: validators.slice(0, 3).map((v) => v.node_id) });
		}
		return err(404, 'not_found', 'proof not found');
	});
	route('GET', '/v1/me/earnings', needAuth((acc, { url }) => {
		ensureActivity(acc);
		const groupBy = url.searchParams.get('group_by') ?? 'project';
		const rows = new Map<string, { units: number; amount: bigint }>();
		for (const p of acc.payouts) {
			const key = groupBy === 'day' ? new Date(p.epoch * 3600 * 1000).toISOString().slice(0, 10) : groupBy === 'device' ? acc.subscriptions.find((s) => s.project_id === p.project_id)?.node_id ?? '' : p.project_id;
			const r = rows.get(key) ?? { units: 0, amount: 0n };
			r.units += p.units;
			r.amount += BigInt(p.amount);
			rows.set(key, r);
		}
		const total = acc.payouts.reduce((s, p) => s + BigInt(p.amount), 0n);
		return json(200, {
			period: url.searchParams.get('period') ?? '7d',
			totals: total > 0n ? [{ token: NECTA, amount: total.toString() }] : [],
			units: acc.payouts.reduce((s, p) => s + p.units, 0),
			rows: [...rows.entries()].map(([key, r]) => ({ key, units: r.units, amounts: [{ token: NECTA, amount: r.amount.toString() }] }))
		});
	}));
	route('GET', '/v1/me/earnings/epochs', needAuth((acc, { url }) => {
		ensureActivity(acc);
		return json(200, page(acc.payouts, url));
	}));
	route('GET', '/v1/me/claims', needAuth((acc) => {
		ensureActivity(acc);
		const items = acc.payouts.filter((p) => p.status === 'claimable').map((p) => ({ project_id: p.project_id, vault: findProject(p.project_id)?.project.vault ?? MOCK_CONTRACTS.vault_factory, epoch: p.epoch, account: acc.address, amount: p.amount, proof: [fakeHash('leaf' + p.epoch)], token: p.token }));
		return json(200, { items });
	}));
	route('GET', '/v1/me/withdrawals', needAuth((acc, { url }) => json(200, page(acc.withdrawals, url))));
	route('POST', '/v1/me/withdrawals/claims', needAuth((acc) => {
		const claimable = acc.payouts.filter((p) => p.status === 'claimable');
		if (!claimable.length) return err(409, 'conflict', 'nothing to claim');
		const byProject = new Map<string, S['EpochPayout'][]>();
		for (const p of claimable) byProject.set(p.project_id, [...(byProject.get(p.project_id) ?? []), p]);
		const items: S['Withdrawal'][] = [];
		for (const [pid, ps] of byProject) {
			const amount = ps.reduce((s, p) => s + BigInt(p.amount), 0n);
			const tx = fakeHash('claim' + pid + st.seq++);
			for (const p of ps) {
				p.status = 'claimed';
				p.claim_tx = tx;
			}
			acc.necta += amount;
			const w: S['Withdrawal'] = { withdrawal_id: 'wd_' + (st.seq++).toString(36), kind: 'claim', status: 'processing', amount: amount.toString(), token: NECTA, recipient: acc.address, epochs: ps.map((p) => ({ project_id: pid, epoch: p.epoch })), subscription_id: null, fee: '0', tx_hash: tx, requested_at: now(), completed_at: null, error: null };
			items.push(w);
			acc.withdrawals.unshift(w);
		}
		save();
		return json(202, { items });
	}));
	route('GET', '/v1/me/slashes', needAuth((_acc, { url }) => json(200, page([] as S['Slash'][], url))));
	route('GET', '/v1/slashes/{h}', () => err(404, 'not_found', 'slash not found'));

	// ── faucet ──
	route('GET', '/v1/faucet', ({ req }) => {
		const acc = auth(req);
		const next = acc?.faucetNext ?? null;
		return json(200, { enabled: true, token: NECTA, amount: (1000n * E18).toString(), eth_amount: '0', cooldown_secs: 86400, eligible: !!acc && (!next || next <= now()), next_eligible_at: next });
	});
	route('POST', '/v1/faucet/drip', needAuth((acc) => {
		if (acc.faucetNext && acc.faucetNext > now()) return err(429, 'rate_limited', 'one drip per 24 h', { next_eligible_at: acc.faucetNext });
		acc.necta += 1000n * E18;
		acc.faucetNext = now() + 86400;
		notify(acc, 'faucet.dripped', 'Received 1,000 testnet NECTA');
		save();
		return json(202, { tx_hash: fakeHash('drip' + st.seq++), amount: (1000n * E18).toString(), eth_tx_hash: null, eth_amount: '0', next_eligible_at: acc.faucetNext });
	}));

	// ── developers ──
	route('GET', '/v1/developers/me', needAuth((acc) => (acc.developer ? json(200, acc.developer) : err(404, 'not_found', 'not enrolled'))));
	route('PUT', '/v1/developers/me', needAuth(async (acc, { body }) => {
		const b = await body();
		acc.developer = { ...(acc.developer ?? { address: acc.address, enrollment: { status: 'none' }, verification: { status: 'unverified' }, joined_at: now() }), ...b } as S['Developer'];
		save();
		return json(200, acc.developer);
	}));
	route('POST', '/v1/developers/me/enrollment', needAuth(async (acc, { body }) => {
		const b = await body();
		if (b.agreements_accepted !== true) return err(400, 'invalid_field', 'agreements must be accepted');
		const draft = !!b.draft;
		acc.developer = {
			...(acc.developer ?? { address: acc.address, joined_at: now(), projects: 0, miners: 0 }),
			address: acc.address,
			display_name: String(b.display_name ?? ''),
			developer_type: (b.developer_type as 'individual' | 'organization') ?? 'individual',
			email: (b.email as string) ?? null,
			website: (b.website as string) ?? null,
			// Testnet decision: verification is automatic on enrollment.
			enrollment: { status: draft ? 'draft' : 'active', submitted_at: draft ? null : now(), reviewed_at: draft ? null : now(), notes: null },
			verification: { status: draft ? 'unverified' : 'verified', requested_at: draft ? null : now(), reviewed_at: draft ? null : now() }
		} as S['Developer'];
		if (!draft) notify(acc, 'developer.verified', 'Developer account active and verified');
		save();
		return json(200, acc.developer);
	}));
	route('POST', '/v1/developers/me/verification', needAuth((acc) => (acc.developer ? json(200, acc.developer) : err(409, 'invalid_state', 'enroll first'))));
	route('GET', '/v1/developers/me/drafts', needAuth((acc) => json(200, { items: acc.drafts })));
	route('POST', '/v1/developers/me/drafts', needAuth(async (acc, { body }) => {
		const b = await body();
		const d: S['Draft'] = { draft_id: 'dr_' + (st.seq++).toString(36), current_step: Number(b.current_step ?? 0), project_id: (b.project_id as string) ?? null, data: (b.data as Json) ?? {}, created_at: now(), updated_at: now() };
		acc.drafts.unshift(d);
		save();
		return json(201, d);
	}));
	route('GET', '/v1/developers/me/drafts/{id}', needAuth((acc, { params }) => {
		const d = acc.drafts.find((x) => x.draft_id === params.id);
		return d ? json(200, d) : err(404, 'not_found', 'draft not found');
	}));
	route('PUT', '/v1/developers/me/drafts/{id}', needAuth(async (acc, { params, body }) => {
		const d = acc.drafts.find((x) => x.draft_id === params.id);
		if (!d) return err(404, 'not_found', 'draft not found');
		const b = await body();
		d.current_step = Number(b.current_step ?? d.current_step);
		d.data = (b.data as Json) ?? d.data;
		d.updated_at = now();
		save();
		return json(200, d);
	}));
	route('DELETE', '/v1/developers/me/drafts/{id}', needAuth((acc, { params }) => {
		acc.drafts = acc.drafts.filter((x) => x.draft_id !== params.id);
		save();
		return json(204, null);
	}));
	route('POST', '/v1/developers/assets', needAuth(async (_acc, { body }) => {
		const b = await body();
		const data = String(b.data_b64 ?? '');
		if (data.length > 2.8 * 1024 * 1024) return err(413, 'too_large', 'image exceeds 2 MiB');
		const sha = fakeHash(data).slice(2);
		return json(201, { sha256: sha, url: `data:${b.content_type};base64,${data}` });
	}));
	route('GET', '/v1/developers/me/projects', needAuth((acc) => json(200, { items: st.projects.filter((p) => p.project.developer === acc.address).map(summary) })));
	route('GET', '/v1/developers/{a}', ({ params }) => {
		const acc = st.accounts[params.a];
		if (acc?.developer) return json(200, { ...acc.developer, email: null });
		if (params.a === SAMPLE_DEV) return json(200, { address: SAMPLE_DEV, display_name: 'Sample Labs', developer_type: 'organization', bio: 'Sample developer used by the mock Hub.', enrollment: { status: 'active' }, verification: { status: 'verified' }, projects: 3, miners: 68, joined_at: now() - 86400 * 30 });
		return err(404, 'not_found', 'developer not found');
	});
	route('POST', '/v1/developers/projects/prepare', needAuth(async (_acc, { body }) => {
		const b = await body();
		const m = b.manifest as S['Manifest'];
		const problems = validateManifest(m);
		if (problems.length) return json(200, { valid: false, problems });
		const d = digestManifest(m);
		const vault = vaultAddress(MOCK_CONTRACTS.vault_factory, MOCK_CONTRACTS.vault_implementation, d.project_id);
		if (m.consensus.economics.vault !== vault) return json(200, { valid: false, problems: [{ path: 'consensus.economics.vault', code: 'invalid_value', message: `must be ${vault}` }] });
		const existing = findProject(d.project_id);
		const tiers = existing ? (['consensus', 'scheduling', 'listing'] as const).filter((t) => canonicalJson(existing.manifest[t]) !== canonicalJson(m[t])) : ['consensus', 'scheduling', 'listing'];
		return json(200, { valid: true, problems: [], canonical: d.canonical, manifest_hash: d.manifest_hash, consensus_hash: d.consensus_hash, project_id: d.project_id, vault, tier_changes: tiers });
	}));
	async function verifyEnvelope(acc: Account, env: S['SignedManifest']): Promise<Response | null> {
		if (!acc.developer || acc.developer.enrollment?.status !== 'active') return err(403, 'not_enrolled', 'complete developer enrollment first');
		const problems = validateManifest(env.manifest);
		if (problems.length) return err(422, 'invalid_manifest', 'manifest is invalid', { problems });
		if (env.manifest.developer !== acc.address) return err(403, 'not_owner', 'manifest developer is not the session wallet');
		const d = digestManifest(env.manifest);
		let signer = '';
		try {
			signer = (await recoverMessageAddress({ message: { raw: stringToHex(d.canonical) }, signature: env.signature as Hex })).toLowerCase();
		} catch {
			return err(422, 'bad_signature', 'signature does not recover');
		}
		if (signer !== env.manifest.developer) return err(422, 'bad_signature', 'signer is not the developer');
		return null;
	}
	route('POST', '/v1/developers/projects', needAuth(async (acc, { body }) => {
		const env = (await body()) as unknown as S['SignedManifest'];
		const bad = await verifyEnvelope(acc, env);
		if (bad) return bad;
		if (env.manifest.version !== 1) return err(422, 'invalid_manifest', 'use the versions endpoint for version > 1');
		const d = digestManifest(env.manifest);
		if (findProject(d.project_id)) return err(409, 'already_exists', 'slug already registered');
		const project = projectFromManifest(env.manifest, now(), { listing_status: 'pending_review', developer_name: acc.developer?.display_name ?? null, listed_at: null, miners: 0 });
		project.economics = economicsOf(env.manifest);
		project.review = { status: 'pending', reason: null, conditions: [], decided_at: null };
		st.projects.push({ project, manifest: env.manifest, versions: [{ version: 1, manifest_hash: d.manifest_hash, consensus_hash: d.consensus_hash, tiers_changed: ['consensus', 'scheduling', 'listing'], status: 'submitted', publish_tx: null, published_at: null, effective_epoch: null, submitted_at: now() }], reviews: [], announcements: [], simulations: [] });
		save();
		return json(201, {
			project,
			register_tx: { chain_id: CHAIN_ID, to: MOCK_CONTRACTS.project_registry, data: '0x' + '00'.repeat(4), value: '0', description: `ProjectRegistry.register("${env.manifest.slug}")` }
		});
	}));
	route('POST', '/v1/developers/projects/{id}/versions', needAuth(async (acc, { params, body }) => {
		const p = findProject(params.id);
		if (!p || p.project.developer !== acc.address) return err(403, 'not_owner', 'not your project');
		const env = (await body()) as unknown as S['SignedManifest'];
		const bad = await verifyEnvelope(acc, env);
		if (bad) return bad;
		const m = env.manifest;
		const prevHash = digestManifest(p.manifest).manifest_hash;
		if (m.version !== p.manifest.version + 1 || m.previous !== prevHash) return err(409, 'conflict', 'version must be current+1 with previous = current manifest_hash');
		const tiers = (['consensus', 'scheduling', 'listing'] as const).filter((t) => canonicalJson(p.manifest[t]) !== canonicalJson(m[t]));
		const d = digestManifest(m);
		const consensusChange = tiers.includes('consensus');
		const v: S['ProjectVersion'] = { version: m.version, manifest_hash: d.manifest_hash, consensus_hash: d.consensus_hash, tiers_changed: [...tiers], status: consensusChange ? 'submitted' : 'active', publish_tx: null, published_at: consensusChange ? null : now(), effective_epoch: null, submitted_at: now() };
		for (const old of p.versions) if (!consensusChange && old.status === 'active') old.status = 'superseded';
		p.versions.push(v);
		if (!consensusChange) {
			p.manifest = m;
			Object.assign(p.project, { version: m.version, manifest_hash: d.manifest_hash, scheduling: m.scheduling, listing: m.listing, name: m.listing.name, tagline: m.listing.tagline || null, icon: m.listing.icon, tags: m.listing.tags, category: m.listing.category, accent_color: m.listing.accent_color, device_classes: m.scheduling.requirements.device_classes });
		} else p.project.pending_version = v;
		save();
		return json(201, { version: v, publish_tx: consensusChange ? { chain_id: CHAIN_ID, to: MOCK_CONTRACTS.project_registry, data: '0x00000000', value: '0', description: 'ProjectRegistry.publishVersion' } : null });
	}));
	const ownProject = (acc: Account, id: string) => {
		const p = findProject(id);
		return p && p.project.developer === acc.address ? p : null;
	};
	route('GET', '/v1/developers/projects/{id}/analytics', needAuth((acc, { params, url }) => {
		const p = ownProject(acc, params.id);
		if (!p) return err(403, 'not_owner', 'not your project');
		const t = now();
		return json(200, {
			period: url.searchParams.get('period') ?? '7d',
			miners_total: p.project.miners ?? 0,
			miners_active: p.project.stats?.miners_active ?? 0,
			tasks_submitted: 0,
			tasks_finalized: 0,
			tasks_failed: 0,
			tasks_fallback: 0,
			avg_finality_ms: 0,
			avg_lease_ms: 0,
			rewards_distributed: '0',
			slashing_events: 0,
			uptime_bp: 0,
			series: Array.from({ length: 7 }, (_, i) => ({ t: t - (6 - i) * 86400, tasks: 0, miners: 0, units: 0 }))
		});
	}));
	route('GET', '/v1/developers/projects/{id}/health', needAuth((acc, { params }) => {
		const p = ownProject(acc, params.id);
		if (!p) return err(403, 'not_owner', 'not your project');
		const listedP = p.project.listing_status === 'listed';
		return json(200, { status: listedP ? 'healthy' : 'paused', eligible_miners: p.project.miners ?? 0, committee_size: p.manifest.consensus.work.committee.size, fallback_rounds_24h: 0, contested_rounds_24h: 0, median_finality_ms: 0, runway_epochs: 0, issues: listedP ? [] : ['Project is not listed yet — it is waiting for operator review.'] });
	}));
	route('GET', '/v1/developers/projects/{id}/revenue', needAuth((acc, { params }) => {
		const p = ownProject(acc, params.id);
		if (!p) return err(403, 'not_owner', 'not your project');
		return json(200, { items: [], totals: { units: 0, gross: '0', miner: '0', developer: '0', treasury: '0' } });
	}));
	route('GET', '/v1/developers/projects/{id}/proofs', needAuth((acc, { params, url }) => {
		const p = ownProject(acc, params.id);
		if (!p) return err(403, 'not_owner', 'not your project');
		return json(200, page(rounds().filter((r) => r.project_id === params.id), url));
	}));
	route('POST', '/v1/developers/projects/{id}/announcements', needAuth(async (acc, { params, body }) => {
		const p = ownProject(acc, params.id);
		if (!p) return err(403, 'not_owner', 'not your project');
		const b = await body();
		const a: S['Announcement'] = { announcement_id: 'an_' + (st.seq++).toString(36), project_id: params.id, title: String(b.title), content: String(b.content), type: (b.type as S['Announcement']['type']) ?? 'update', author: acc.address, created_at: now() };
		p.announcements.unshift(a);
		save();
		return json(201, a);
	}));
	route('DELETE', '/v1/developers/projects/{id}/announcements/{aid}', needAuth((acc, { params }) => {
		const p = ownProject(acc, params.id);
		if (!p) return err(403, 'not_owner', 'not your project');
		p.announcements = p.announcements.filter((a) => a.announcement_id !== params.aid);
		save();
		return json(204, null);
	}));
	route('GET', '/v1/developers/projects/{id}/simulations', needAuth((acc, { params }) => {
		const p = ownProject(acc, params.id);
		return p ? json(200, { items: p.simulations }) : err(403, 'not_owner', 'not your project');
	}));
	route('POST', '/v1/developers/projects/{id}/simulations', needAuth(async (acc, { params, body }) => {
		const p = ownProject(acc, params.id);
		if (!p) return err(403, 'not_owner', 'not your project');
		const b = await body();
		const tasks = (b.tasks as { function: string; input: unknown }[]) ?? [];
		const sim: S['Simulation'] = {
			simulation_id: 'sim_' + (st.seq++).toString(36),
			project_id: params.id,
			status: 'passed',
			results: tasks.map((t, i) => ({ round_id: 'exec:' + fakeHash('sim' + i + st.seq), success: true, output: JSON.stringify({ ok: true, fn: t.function }), receipt_hash: fakeHash('simr' + i + st.seq), gas_used: 181_000 + i * 100, consensus: { state: 'finalized', votes: 4, quorum: 3 }, error: null })),
			logs: ['loaded worker module', `ran ${tasks.length} task(s) on 4 validators`, 'all receipts agree'],
			started_at: now(),
			completed_at: now()
		};
		p.simulations.unshift(sim);
		save();
		return json(202, sim);
	}));
	route('GET', '/v1/developers/api-keys', needAuth((acc) => json(200, { items: acc.apiKeys })));
	route('POST', '/v1/developers/api-keys', needAuth(async (acc, { body }) => {
		if (!acc.developer || acc.developer.enrollment?.status !== 'active') return err(403, 'not_enrolled', 'enroll first');
		const b = await body();
		const id = fakeHash('key' + st.seq++).slice(2, 10);
		const secret = 'nk_test_' + id + '_' + fakeHash('secret' + st.seq++).slice(2, 45);
		const key: S['ApiKey'] = { key_id: id, name: String(b.name ?? 'key'), prefix: 'nk_test_' + id, scopes: (b.scopes as S['ApiScope'][]) ?? [], project_ids: (b.project_ids as string[]) ?? [], last_used_at: null, expires_at: (b.expires_at as number | null) ?? null, created_at: now() };
		acc.apiKeys.unshift(key);
		save();
		return json(201, { ...key, secret });
	}));
	route('DELETE', '/v1/developers/api-keys/{id}', needAuth((acc, { params }) => {
		const before = acc.apiKeys.length;
		acc.apiKeys = acc.apiKeys.filter((k) => k.key_id !== params.id);
		save();
		return before === acc.apiKeys.length ? err(404, 'not_found', 'key not found') : json(204, null);
	}));

	async function handle(req: Request): Promise<Response> {
		const url = new URL(req.url);
		// Accept both absolute Hub URLs and a `/rpc` prefix (local-mode proxy path).
		let path = url.pathname.replace(/^\/rpc(?=\/|$)/, '') || '/';
		if (path.length > 1) path = path.replace(/\/+$/, '');
		if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE' } });
		for (const [method, re, names, h] of routes) {
			if (method !== req.method) continue;
			const m = re.exec(path);
			if (!m) continue;
			const params: Record<string, string> = {};
			names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
			let cached: Json | null = null;
			const body = async () => {
				if (cached) return cached;
				try {
					cached = (await req.clone().json()) as Json;
				} catch {
					cached = {};
				}
				return cached;
			};
			try {
				return await h({ req, url, params, body });
			} catch (e) {
				return err(500, 'internal', e instanceof Error ? e.message : String(e));
			}
		}
		return err(404, 'not_found', `no route ${req.method} ${path}`);
	}

	return {
		handle,
		state: () => st,
		reset(o) {
			st = seed(now(), !!o?.empty);
			save();
		}
	};
}


