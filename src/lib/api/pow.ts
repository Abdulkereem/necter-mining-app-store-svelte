/**
 * Proof-of-work apps on the Hub (`/v1/pow/apps…`, POW-APPS.md). Plain fetches: these endpoints are new and kept
 * out of the generated schema until the next `gen:api`.
 *
 * Two apps exist: "monero" (the RandomX app: Necter picks the treasury target coin, Tari is merge-mined with
 * Monero) and "verus" (VerusHash 2.2). The Hub lists only the apps it enables; the UI works with either or both.
 * Miners are always paid in NECTA per verified share; the treasury target only decides what Necter's treasury earns.
 */
import { RPC_URL } from '$lib/config';
import { hubFetch } from './http';

export type PowWorkload = 'pow.randomx' | 'pow.verushash';

/** One coin the RandomX app can point the treasury at (`randomx.targets[]`). */
export interface PowTarget {
	id: string;
	coin: string;
	name: string;
	algo: string;
	website: string;
	default: boolean;
	active: boolean;
	merge_mined: string[];
}

export interface PowRandomx {
	target: string;
	target_coin: string;
	target_name: string;
	algo: string;
	targets: PowTarget[];
}

/** An auxiliary chain merge-mined with a target (`merge_mining[]`, e.g. Tari with Monero). */
export interface PowMergeMining {
	id: string;
	coin: string;
	name: string;
	website: string;
	/** Target id it is merge-mined with ("monero"). */
	with: string;
	active: boolean;
	mode: 'simulated' | 'pool';
	note: string;
}

export interface PowApp {
	app_id: string;
	project_id: string;
	slug: string;
	kind: 'proof-of-work';
	workload: PowWorkload;
	family: string;
	family_name: string;
	name: string;
	coin: string;
	algorithm: string;
	pool_mode: 'test' | string;
	tagline: string;
	description: string;
	testnet_note: string | null;
	website: string;
	category: string;
	accent_color: string;
	device_classes: string[];
	mobile_enabled: boolean;
	/** Verus: the candidate if phone mining is ever turned on. */
	mobile_candidate: boolean;
	opt_in: boolean;
	default_cpu_pct: number;
	disclosure_version: string;
	/** Oldest necter-miner that can mine the app's current target (null: any). */
	min_miner_version: string | null;
	share_difficulty: number;
	units_per_share: number;
	epoch_secs: number;
	/** RandomX app only. */
	randomx: PowRandomx | null;
	merge_mining: PowMergeMining[];
	/** Coins Necter's treasury earns now (["XMR", "XTM"], ["ZEPH"], ["VRSC"]). */
	treasury_earns: string[];
	headline: string | null;
	reward: { token: { symbol?: string } | null; reward_per_unit: string; daily_emission: string; vault: string | null; settlement: string };
}

/** Treasury metadata of one closed epoch (`…/epochs/{E}`.treasury and `…/treasury`.epochs[]). */
export interface PowEpochTreasury {
	v: number;
	app: string;
	project_id: string;
	epoch: number;
	targets: Record<string, { shares: number; work: string }>;
	aux: Record<
		string,
		{
			coin: string;
			name: string;
			with: string;
			mode: 'simulated' | 'pool';
			shares: number;
			work: string;
			aux_difficulty: number;
			blocks: number;
			expected_blocks: number;
			reward_per_block: string;
			reward_unit: string;
			reward: string;
		}
	>;
}

export interface PowTreasury {
	app: string;
	project_id: string;
	target: string;
	treasury_earns: string[];
	merge_mining: PowMergeMining[];
	aux_totals: Record<string, { coin: string; mode: 'simulated' | 'pool'; blocks: number; reward: string; shares: number }>;
	/** Last 48 closed epochs, newest first. */
	epochs: PowEpochTreasury[];
}

/** Local logo assets for first-party PoW apps (official marks, see static/apps/<id>/ATTRIBUTION.txt). */
export const POW_ICONS: Record<string, { src: string; credit: string; license: string; licenseName: string; owner: string }> = {
	monero: {
		src: '/apps/monero/monero-symbol.png',
		credit: 'Monero symbol © The Monero Project',
		license: 'https://creativecommons.org/licenses/by-sa/4.0/',
		licenseName: 'CC BY-SA 4.0',
		owner: 'the Monero Project'
	}
};

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/**
 * Fills the fields older Hubs (pow-xmr-v1) do not send, so the UI can rely on them: `family`, `merge_mining`,
 * `treasury_earns` (falls back to the app's own coin), `randomx`, `headline`, `min_miner_version`.
 */
export function normalizePowApp(raw: unknown): PowApp {
	const a = (raw ?? {}) as Partial<PowApp> & Record<string, unknown>;
	const workload: PowWorkload = a.workload === 'pow.verushash' ? 'pow.verushash' : 'pow.randomx';
	const family = typeof a.family === 'string' ? a.family : workload === 'pow.verushash' ? 'verushash' : 'randomx';
	const family_name = typeof a.family_name === 'string' ? a.family_name : family === 'verushash' ? 'VerusHash' : 'RandomX';
	const rx = a.randomx && typeof a.randomx === 'object' ? (a.randomx as PowRandomx) : null;
	const earns = arr<string>(a.treasury_earns).filter((c) => typeof c === 'string');
	return {
		...(a as PowApp),
		workload,
		family,
		family_name,
		device_classes: arr<string>(a.device_classes),
		mobile_candidate: a.mobile_candidate === true,
		min_miner_version: strOrNull(a.min_miner_version),
		randomx: rx ? { ...rx, targets: arr<PowTarget>(rx.targets) } : null,
		merge_mining: arr<PowMergeMining>(a.merge_mining),
		treasury_earns: earns.length ? earns : a.coin ? [a.coin] : [],
		headline: strOrNull(a.headline),
		testnet_note: strOrNull(a.testnet_note)
	};
}

function normalizeTreasury(raw: unknown): PowTreasury {
	const t = (raw ?? {}) as Partial<PowTreasury>;
	return {
		...(t as PowTreasury),
		treasury_earns: arr<string>(t.treasury_earns),
		merge_mining: arr<PowMergeMining>(t.merge_mining),
		aux_totals: t.aux_totals && typeof t.aux_totals === 'object' ? t.aux_totals : {},
		epochs: arr<PowEpochTreasury>(t.epochs)
	};
}

/** Error thrown for a non-2xx Hub answer; `status` 404 means the app is unknown or not enabled. */
export class PowHubError extends Error {
	readonly status: number;
	constructor(status: number) {
		super(status === 404 ? 'This proof-of-work app is not available on this network.' : `Hub ${status}`);
		this.name = 'PowHubError';
		this.status = status;
	}
}

async function get<T>(path: string): Promise<T> {
	const r = await hubFetch(new Request(`${RPC_URL}${path}`, { headers: { Accept: 'application/json' } }));
	if (!r.ok) throw new PowHubError(r.status);
	return (await r.json()) as T;
}

const enc = encodeURIComponent;

export const pow = {
	apps: () => get<{ items: unknown[] }>('/v1/pow/apps').then((r) => arr(r.items).map(normalizePowApp)),
	app: (id: string) => get<unknown>(`/v1/pow/apps/${enc(id)}`).then(normalizePowApp),
	treasury: (id: string) => get<unknown>(`/v1/pow/apps/${enc(id)}/treasury`).then(normalizeTreasury),
	worker: (id: string, nodeId: string) =>
		get<{ units_credited: number; units_pending: number; strikes: number; suspended_until: number | null; epoch: number }>(
			`/v1/pow/apps/${enc(id)}/workers/${enc(nodeId)}`
		)
};

export function deviceClassLabel(classes: string[]): string {
	const names: Record<string, string> = { desktop: 'Desktop', laptop: 'Laptop', server: 'Server', phone: 'Android phone', tablet: 'Android tablet' };
	return classes.map((c) => names[c] ?? c).join(' · ');
}

/**
 * One-line summary of what the app mines: the Hub's `headline`, else built from `randomx.targets` and
 * `merge_mining` ("RandomX: Monero (default) · also Zephyr, Salvium · Tari merge-mined"), else
 * "Verus (VRSC) · VerusHash 2.2".
 */
export function powHeadline(app: PowApp): string {
	if (app.headline) return app.headline;
	const targets = app.randomx?.targets ?? [];
	if (targets.length) {
		const def = targets.find((t) => t.default) ?? targets[0];
		const others = targets.filter((t) => t !== def).map((t) => t.name);
		const merged = [...new Set([...app.merge_mining.map((m) => m.name), ...targets.flatMap((t) => t.merge_mined.map(cap))])];
		let s = `${app.family_name}: ${def.name} (default)`;
		if (others.length) s += ` · also ${others.join(', ')}`;
		if (merged.length) s += ` · ${merged.join(', ')} merge-mined`;
		return s;
	}
	return `${app.name} (${app.coin}) · ${algorithmLabel(app)}`;
}

function cap(id: string): string {
	return id ? id[0].toUpperCase() + id.slice(1) : id;
}

/** "XMR + XTM". */
export function treasuryEarnsLabel(app: Pick<PowApp, 'treasury_earns' | 'coin'>): string {
	return (app.treasury_earns.length ? app.treasury_earns : [app.coin]).join(' + ');
}

/** "VerusHash 2.2" for "verushash-2.2", "RandomX (rx/0)" for "rx/0". */
export function algorithmLabel(app: Pick<PowApp, 'algorithm' | 'family_name'>): string {
	const m = /^verushash-(.+)$/.exec(app.algorithm);
	if (m) return `VerusHash ${m[1]}`;
	if (app.algorithm.startsWith('rx/')) return `${app.family_name} (${app.algorithm})`;
	return app.algorithm;
}

/** Hostname of the project website for link text ("getmonero.org", "verus.io"). */
export function websiteHost(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

/** Tari (or another aux chain) totals from `/treasury`, with the number of epochs they cover. */
export function auxSummary(t: PowTreasury, auxId: string): { blocks: number; reward: string; shares: number; mode: string; epochs: number } | null {
	const tot = t.aux_totals[auxId];
	if (!tot) return null;
	return { blocks: tot.blocks, reward: tot.reward, shares: tot.shares, mode: tot.mode, epochs: t.epochs.length };
}

/** `a >= b` for dotted versions ("1.0.10" >= "1.0.4"); unparsable parts count as 0. */
export function versionAtLeast(a: string, b: string): boolean {
	const pa = a.replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
	const pb = b.replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d !== 0) return d > 0;
	}
	return true;
}

/** Proof-of-work projects have their own page and stay out of the compute project lists. */
export function isComputeProject(p: { kind?: string | null }): boolean {
	return p.kind !== 'proof-of-work';
}
