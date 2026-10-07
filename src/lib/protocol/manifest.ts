/**
 * Project manifest v1 (PLATFORM.md §a): canonical bytes, derived hashes, field validation, EIP-191 signing and
 * verification. The Hub re-validates everything; this module lets the developer portal show problems early and
 * lets the wallet sign the exact bytes the Hub will verify.
 */
import { hashMessage, keccak256, recoverMessageAddress, stringToHex, type Hex } from 'viem';
import type { Manifest, ManifestConsensus, ManifestListing, ManifestScheduling, SignedManifest } from '$lib/api/types';
import { canonicalJson, CanonicalJsonError } from './canonical';
import { isHash, isLowerAddress, projectId, SLUG_RE } from './ids';

export interface ManifestProblem {
	path: string;
	code: string;
	message: string;
}

/** Network parameters used by validation (PLATFORM.md §0.1, testnet defaults). */
export interface ManifestParams {
	network: string;
	chain_id: number;
	committee_min_size: number;
	committee_max_size: number;
	committee_max_backups: number;
	dispute_window_secs_min: number;
	dispute_window_secs_max: number;
	slash_invalid_result_bp_max: number;
	slash_missed_sla_bp_max: number;
	treasury_bp_min: number;
	min_collateral_floor: string;
}

export const TESTNET_PARAMS: ManifestParams = {
	network: 'necter-testnet',
	chain_id: 11155111,
	committee_min_size: 3,
	committee_max_size: 31,
	committee_max_backups: 16,
	dispute_window_secs_min: 3600,
	dispute_window_secs_max: 604800,
	slash_invalid_result_bp_max: 5000,
	slash_missed_sla_bp_max: 500,
	treasury_bp_min: 0,
	min_collateral_floor: '1000000000000000000'
};

/** Builds params from `GET /v1/network/params` (falls back to testnet defaults per key). */
export function paramsFromHub(raw: Record<string, unknown> | null | undefined, network = 'necter-testnet', chainId = 11155111): ManifestParams {
	const p = { ...TESTNET_PARAMS, network, chain_id: chainId } as ManifestParams & Record<string, unknown>;
	if (raw) {
		for (const k of Object.keys(TESTNET_PARAMS)) {
			const v = raw[k];
			if (k === 'min_collateral_floor' ? typeof v === 'string' : typeof v === 'number') p[k] = v;
		}
	}
	return p;
}

export const EPOCH_SECS_ALLOWED = [3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400] as const;
export const DEVICE_CLASSES = ['desktop', 'laptop', 'phone', 'server', 'tablet'] as const; // sorted
export const ENGINES = ['native', 'pulley32', 'pulley64'] as const; // sorted
const AMOUNT_RE = /^(0|[1-9][0-9]{0,77})$/;
const TAG_RE = /^[a-z0-9-]{1,24}$/;
const ACCENT_RE = /^#[0-9A-F]{6}$/;
const MAX_COLLATERAL = 10n ** 6n * 10n ** 18n;
const KEYS = {
	root: ['chain_id', 'consensus', 'developer', 'listing', 'network', 'previous', 'scheduling', 'slug', 'v', 'version'],
	consensus: ['economics', 'modules', 'work'],
	modules: ['verifier', 'worker'],
	work: ['class', 'committee', 'dispute_window_secs', 'epoch_secs', 'execution', 'functions', 'lease_secs', 'max_gas_limit', 'round_secs', 'task_source', 'verification'],
	committee: ['backups', 'min_size', 'selection', 'size', 'weight_cap_multiple'],
	economics: ['daily_emission', 'fee_split_bp', 'max_recipients_per_epoch', 'max_units_per_epoch', 'min_collateral', 'reward_model', 'reward_per_unit', 'reward_token', 'slashing_bp', 'vault'],
	fee: ['developer', 'miner', 'treasury'],
	slashing: ['invalid_result', 'missed_sla'],
	scheduling: ['public_tasks', 'requirements', 'sla'],
	requirements: ['attestation', 'cpu_cores', 'device_classes', 'engines', 'gpu', 'min_benchmark', 'ram_mb', 'storage_mb'],
	sla: ['max_latency_ms', 'min_uptime_bp'],
	listing: ['accent_color', 'banner', 'category', 'description', 'docs', 'features', 'icon', 'name', 'screenshots', 'support', 'tagline', 'tags', 'video', 'website']
} as const;

export const CATEGORY_SLUGS = [
	'blockchain',
	'depin',
	'machine-learning',
	'storage',
	'compute',
	'bandwidth',
	'data-sovereignty',
	'iot',
	'hardware-staking',
	'content-delivery'
] as const;

function utf8Len(s: string) {
	return new TextEncoder().encode(s).length;
}

function isHttpsUrl(s: unknown): boolean {
	if (typeof s !== 'string' || utf8Len(s) > 512) return false;
	try {
		return new URL(s).protocol === 'https:';
	} catch {
		return false;
	}
}

function isInt(v: unknown, min: number, max: number): boolean {
	return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function isSortedUnique(arr: readonly string[]): boolean {
	for (let i = 1; i < arr.length; i++) if (!(arr[i - 1] < arr[i])) return false;
	return true;
}

/**
 * Validates a manifest against §a.3. Returns an empty list when valid. Paths use dotted notation
 * (`consensus.economics.fee_split_bp`).
 */
export function validateManifest(m: unknown, params: ManifestParams = TESTNET_PARAMS): ManifestProblem[] {
	const problems: ManifestProblem[] = [];
	const add = (path: string, code: string, message: string) => problems.push({ path, code, message });
	const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
	const keysExact = (v: Record<string, unknown>, keys: readonly string[], path: string) => {
		for (const k of Object.keys(v)) if (!keys.includes(k)) add(path ? `${path}.${k}` : k, 'unknown_key', 'unknown key');
		for (const k of keys) if (!(k in v)) add(path ? `${path}.${k}` : k, 'missing', 'required');
	};

	if (!obj(m)) return [{ path: '', code: 'invalid_manifest', message: 'manifest must be an object' }];
	try {
		canonicalJson(m);
	} catch (e) {
		if (e instanceof CanonicalJsonError) add(e.path, e.code === 'float' ? 'invalid_manifest' : e.code, e.message);
		else throw e;
	}
	keysExact(m, KEYS.root, '');
	if (m.v !== 1) add('v', 'invalid_value', 'must be 1');
	if (m.network !== params.network) add('network', 'invalid_value', `must be ${params.network}`);
	if (m.chain_id !== params.chain_id) add('chain_id', 'invalid_value', `must be ${params.chain_id}`);
	if (!isLowerAddress(m.developer) || m.developer === '0x0000000000000000000000000000000000000000')
		add('developer', 'invalid_value', 'lowercase non-zero EVM address');
	if (typeof m.slug !== 'string' || !SLUG_RE.test(m.slug)) add('slug', 'invalid_slug', '3–48 chars: a-z, 0-9, inner hyphens');
	if (!isInt(m.version, 1, Number.MAX_SAFE_INTEGER)) add('version', 'invalid_value', 'integer ≥ 1');
	if (m.version === 1 ? m.previous !== null : !isHash(m.previous)) add('previous', 'invalid_value', 'null for version 1, else the previous manifest_hash');

	// consensus
	const c = m.consensus;
	if (!obj(c)) add('consensus', 'invalid_value', 'object required');
	else {
		keysExact(c, KEYS.consensus, 'consensus');
		const mod = c.modules;
		if (obj(mod)) {
			keysExact(mod, KEYS.modules, 'consensus.modules');
			if (!isHash(mod.worker)) add('consensus.modules.worker', 'invalid_value', 'module address (0x + 64 hex)');
			if (mod.verifier !== null) add('consensus.modules.verifier', 'invalid_value', 'must be null in v1');
		}
		const w = c.work;
		if (obj(w)) {
			keysExact(w, KEYS.work, 'consensus.work');
			if (w.class !== 'deterministic') add('consensus.work.class', 'unsupported', 'only "deterministic" is available on testnet');
			if (w.verification !== 'redundant-execution') add('consensus.work.verification', 'unsupported', 'only "redundant-execution"');
			if (w.execution !== 'committee') add('consensus.work.execution', 'unsupported', 'only "committee"');
			const fns = w.functions;
			if (!Array.isArray(fns) || fns.length < 1 || fns.length > 64 || !fns.every((f) => typeof f === 'string' && f.length > 0))
				add('consensus.work.functions', 'invalid_value', '1–64 function names');
			else if (!isSortedUnique(fns as string[])) add('consensus.work.functions', 'invalid_value', 'must be sorted ascending and unique');
			const ts = w.task_source;
			if (!obj(ts)) add('consensus.work.task_source', 'invalid_value', 'object required');
			else if (ts.kind === 'api') {
				if (Object.keys(ts).length !== 1) add('consensus.work.task_source', 'unknown_key', '{"kind":"api"} only');
			} else if (ts.kind === 'schedule') {
				keysExact(ts, ['function', 'gas_limit', 'interval_secs', 'kind'], 'consensus.work.task_source');
				if (!Array.isArray(fns) || !fns.includes(ts.function as string))
					add('consensus.work.task_source.function', 'invalid_value', 'must be one of functions');
				if (!isInt(ts.interval_secs, 10, 3600)) add('consensus.work.task_source.interval_secs', 'invalid_value', '10..3600');
				if (!isInt(ts.gas_limit, 1, Number.MAX_SAFE_INTEGER)) add('consensus.work.task_source.gas_limit', 'invalid_value', 'integer ≥ 1');
			} else add('consensus.work.task_source.kind', 'invalid_value', '"api" or "schedule"');
			if (!isInt(w.max_gas_limit, 1, 10_000_000_000)) add('consensus.work.max_gas_limit', 'invalid_value', '1..10^10');
			const cm = w.committee;
			if (obj(cm)) {
				keysExact(cm, KEYS.committee, 'consensus.work.committee');
				if (!isInt(cm.size, params.committee_min_size, params.committee_max_size))
					add('consensus.work.committee.size', 'invalid_value', `${params.committee_min_size}..${params.committee_max_size}`);
				if (!isInt(cm.backups, 0, params.committee_max_backups))
					add('consensus.work.committee.backups', 'invalid_value', `0..${params.committee_max_backups}`);
				if (!isInt(cm.min_size, params.committee_min_size, typeof cm.size === 'number' ? cm.size : params.committee_max_size))
					add('consensus.work.committee.min_size', 'invalid_value', `${params.committee_min_size}..size`);
				if (cm.selection !== 'collateral-reputation-sortition-v1')
					add('consensus.work.committee.selection', 'invalid_value', '"collateral-reputation-sortition-v1"');
				if (!isInt(cm.weight_cap_multiple, 1, 100)) add('consensus.work.committee.weight_cap_multiple', 'invalid_value', '1..100');
			} else add('consensus.work.committee', 'invalid_value', 'object required');
			if (!isInt(w.round_secs, 10, 600)) add('consensus.work.round_secs', 'invalid_value', '10..600');
			if (!isInt(w.lease_secs, 5, typeof w.round_secs === 'number' ? w.round_secs : 600))
				add('consensus.work.lease_secs', 'invalid_value', '5..round_secs');
			if (!EPOCH_SECS_ALLOWED.includes(w.epoch_secs as (typeof EPOCH_SECS_ALLOWED)[number]))
				add('consensus.work.epoch_secs', 'invalid_value', '3600 × {1,2,3,4,6,8,12,24}');
			if (!isInt(w.dispute_window_secs, params.dispute_window_secs_min, params.dispute_window_secs_max))
				add('consensus.work.dispute_window_secs', 'invalid_value', `${params.dispute_window_secs_min}..${params.dispute_window_secs_max}`);
		} else add('consensus.work', 'invalid_value', 'object required');
		const e = c.economics;
		if (obj(e)) {
			keysExact(e, KEYS.economics, 'consensus.economics');
			if (!isLowerAddress(e.reward_token)) add('consensus.economics.reward_token', 'invalid_value', 'ERC-20 address');
			if (!isLowerAddress(e.vault)) add('consensus.economics.vault', 'invalid_value', 'vault address');
			if (e.reward_model !== 'per-unit' && e.reward_model !== 'epoch-pool')
				add('consensus.economics.reward_model', 'unsupported', '"per-unit" or "epoch-pool"');
			if (typeof e.reward_per_unit !== 'string' || !AMOUNT_RE.test(e.reward_per_unit))
				add('consensus.economics.reward_per_unit', 'invalid_value', 'amount (wei string)');
			else if ((e.reward_model === 'epoch-pool') !== (e.reward_per_unit === '0'))
				add('consensus.economics.reward_per_unit', 'invalid_value', '"0" exactly when reward_model is epoch-pool');
			if (typeof e.daily_emission !== 'string' || !AMOUNT_RE.test(e.daily_emission) || e.daily_emission === '0')
				add('consensus.economics.daily_emission', 'invalid_value', 'amount > 0');
			const f = e.fee_split_bp;
			if (obj(f)) {
				keysExact(f, KEYS.fee, 'consensus.economics.fee_split_bp');
				const ok = isInt(f.miner, 5000, 10000) && isInt(f.developer, 0, 5000) && isInt(f.treasury, 0, 5000);
				if (!ok) add('consensus.economics.fee_split_bp', 'invalid_value', 'miner 5000..10000, developer/treasury 0..5000');
				else if ((f.miner as number) + (f.developer as number) + (f.treasury as number) !== 10000)
					add('consensus.economics.fee_split_bp', 'invalid_fee_split', 'must sum to exactly 10000 bp');
				else if ((f.treasury as number) < params.treasury_bp_min)
					add('consensus.economics.fee_split_bp.treasury', 'invalid_value', `≥ ${params.treasury_bp_min}`);
			} else add('consensus.economics.fee_split_bp', 'invalid_value', 'object required');
			if (!isInt(e.max_units_per_epoch, 1, 1_000_000_000)) add('consensus.economics.max_units_per_epoch', 'invalid_value', '1..10^9');
			if (!isInt(e.max_recipients_per_epoch, 1, 10000)) add('consensus.economics.max_recipients_per_epoch', 'invalid_value', '1..10000');
			if (typeof e.min_collateral !== 'string' || !AMOUNT_RE.test(e.min_collateral))
				add('consensus.economics.min_collateral', 'invalid_value', 'amount (NECTA wei)');
			else {
				const v = BigInt(e.min_collateral);
				if (v < BigInt(params.min_collateral_floor) || v > MAX_COLLATERAL)
					add('consensus.economics.min_collateral', 'invalid_value', 'between the network floor and 1,000,000 NECTA');
			}
			const s = e.slashing_bp;
			if (obj(s)) {
				keysExact(s, KEYS.slashing, 'consensus.economics.slashing_bp');
				if (!isInt(s.invalid_result, 0, params.slash_invalid_result_bp_max))
					add('consensus.economics.slashing_bp.invalid_result', 'invalid_value', `0..${params.slash_invalid_result_bp_max}`);
				if (!isInt(s.missed_sla, 0, params.slash_missed_sla_bp_max))
					add('consensus.economics.slashing_bp.missed_sla', 'invalid_value', `0..${params.slash_missed_sla_bp_max}`);
			} else add('consensus.economics.slashing_bp', 'invalid_value', 'object required');
		} else add('consensus.economics', 'invalid_value', 'object required');
	}

	// scheduling
	const sc = m.scheduling;
	if (!obj(sc)) add('scheduling', 'invalid_value', 'object required');
	else {
		keysExact(sc, KEYS.scheduling, 'scheduling');
		const r = sc.requirements;
		if (obj(r)) {
			keysExact(r, KEYS.requirements, 'scheduling.requirements');
			const dc = r.device_classes;
			if (!Array.isArray(dc) || dc.length === 0 || !dc.every((d) => (DEVICE_CLASSES as readonly string[]).includes(d as string)))
				add('scheduling.requirements.device_classes', 'invalid_value', 'non-empty subset of phone, tablet, laptop, desktop, server');
			else if (!isSortedUnique(dc as string[])) add('scheduling.requirements.device_classes', 'invalid_value', 'sorted and unique');
			for (const k of ['cpu_cores', 'ram_mb', 'storage_mb', 'min_benchmark'] as const)
				if (!isInt(r[k], 0, Number.MAX_SAFE_INTEGER)) add(`scheduling.requirements.${k}`, 'invalid_value', 'integer ≥ 0');
			if (r.gpu !== null) add('scheduling.requirements.gpu', 'unsupported', 'GPU requirements are coming later (must be null)');
			const en = r.engines;
			if (!Array.isArray(en) || en.length === 0 || !en.every((x) => (ENGINES as readonly string[]).includes(x as string)))
				add('scheduling.requirements.engines', 'invalid_value', 'non-empty subset of native, pulley64, pulley32');
			else if (!isSortedUnique(en as string[])) add('scheduling.requirements.engines', 'invalid_value', 'sorted and unique');
			if (!Array.isArray(r.attestation) || r.attestation.length !== 0)
				add('scheduling.requirements.attestation', 'unsupported', 'attestation requirements are coming later (must be [])');
		} else add('scheduling.requirements', 'invalid_value', 'object required');
		const sla = sc.sla;
		if (obj(sla)) {
			keysExact(sla, KEYS.sla, 'scheduling.sla');
			if (!isInt(sla.max_latency_ms, 100, 600000)) add('scheduling.sla.max_latency_ms', 'invalid_value', '100..600000');
			if (!isInt(sla.min_uptime_bp, 0, 10000)) add('scheduling.sla.min_uptime_bp', 'invalid_value', '0..10000');
		} else add('scheduling.sla', 'invalid_value', 'object required');
		if (typeof sc.public_tasks !== 'boolean') add('scheduling.public_tasks', 'invalid_value', 'boolean');
	}

	// listing
	const l = m.listing;
	if (!obj(l)) add('listing', 'invalid_value', 'object required');
	else {
		keysExact(l, KEYS.listing, 'listing');
		if (typeof l.name !== 'string' || utf8Len(l.name) < 1 || utf8Len(l.name) > 64) add('listing.name', 'invalid_value', '1–64 bytes');
		if (typeof l.tagline !== 'string' || utf8Len(l.tagline) > 120) add('listing.tagline', 'invalid_value', '≤ 120 bytes');
		if (typeof l.description !== 'string' || utf8Len(l.description) > 8000) add('listing.description', 'invalid_value', '≤ 8000 bytes');
		if (!(CATEGORY_SLUGS as readonly string[]).includes(l.category as string)) add('listing.category', 'invalid_value', 'unknown category');
		if (!Array.isArray(l.tags) || l.tags.length > 8 || !l.tags.every((t) => typeof t === 'string' && TAG_RE.test(t)) || new Set(l.tags).size !== l.tags.length)
			add('listing.tags', 'invalid_value', '≤ 8 unique tags of a-z, 0-9, hyphen (≤ 24 chars)');
		if (!isHttpsUrl(l.icon)) add('listing.icon', 'invalid_value', 'https URL (≤ 512 bytes) required');
		for (const k of ['banner', 'video', 'website', 'docs', 'support'] as const)
			if (l[k] !== null && !isHttpsUrl(l[k])) add(`listing.${k}`, 'invalid_value', 'https URL or empty');
		if (!Array.isArray(l.screenshots) || l.screenshots.length > 8 || !l.screenshots.every(isHttpsUrl))
			add('listing.screenshots', 'invalid_value', '≤ 8 https URLs');
		if (!Array.isArray(l.features) || l.features.length > 12 || !l.features.every((f) => typeof f === 'string' && utf8Len(f) <= 120))
			add('listing.features', 'invalid_value', '≤ 12 items of ≤ 120 bytes');
		if (l.accent_color !== null && !(typeof l.accent_color === 'string' && ACCENT_RE.test(l.accent_color)))
			add('listing.accent_color', 'invalid_value', '#RRGGBB uppercase hex or empty');
	}

	if (problems.length === 0) {
		const size = utf8Len(canonicalJson(m));
		if (size > 64 * 1024) add('', 'too_large', 'canonical manifest exceeds 64 KiB');
	}
	return problems;
}

export interface ManifestDigest {
	canonical: string;
	manifest_hash: Hex;
	consensus_hash: Hex;
	project_id: Hex;
	/** EIP-191 digest that the wallet signs. */
	eip191_digest: Hex;
}

/** §a.2 derived values. Throws on non-canonicalizable input. */
export function digestManifest(m: Manifest): ManifestDigest {
	const canonical = canonicalJson(m);
	return {
		canonical,
		manifest_hash: keccak256(stringToHex(canonical)),
		consensus_hash: keccak256(stringToHex(canonicalJson(m.consensus))),
		project_id: projectId(m.developer, m.slug),
		eip191_digest: hashMessage({ raw: stringToHex(canonical) })
	};
}

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

/** Normalizes `v ∈ {0,1}` to `{27,28}` and rejects high-s / malformed signatures (§0 EIP-191 rules). */
export function normalizeSignature(sig: string): Hex {
	if (!/^0x[0-9a-fA-F]{130}$/.test(sig)) throw new Error('bad_signature: expected 65-byte signature');
	const lower = sig.toLowerCase();
	const s = BigInt('0x' + lower.slice(66, 130));
	if (s > SECP256K1_N / 2n) throw new Error('bad_signature: high-s signature');
	let v = parseInt(lower.slice(130, 132), 16);
	if (v === 0 || v === 1) v += 27;
	if (v !== 27 && v !== 28) throw new Error('bad_signature: invalid v');
	return (lower.slice(0, 130) + v.toString(16).padStart(2, '0')) as Hex;
}

/** Recovers the EIP-191 signer of a signed manifest envelope and checks it equals `developer`. */
export async function verifySignedManifest(env: SignedManifest): Promise<{ ok: boolean; signer: string | null; reason?: string }> {
	try {
		const d = digestManifest(env.manifest);
		if (env.manifest_hash && env.manifest_hash !== d.manifest_hash) return { ok: false, signer: null, reason: 'manifest_hash mismatch' };
		if (env.consensus_hash && env.consensus_hash !== d.consensus_hash) return { ok: false, signer: null, reason: 'consensus_hash mismatch' };
		if (env.project_id && env.project_id !== d.project_id) return { ok: false, signer: null, reason: 'project_id mismatch' };
		const sig = normalizeSignature(env.signature);
		const signer = (await recoverMessageAddress({ message: { raw: stringToHex(d.canonical) }, signature: sig })).toLowerCase();
		return signer === env.manifest.developer ? { ok: true, signer } : { ok: false, signer, reason: 'signer is not the developer' };
	} catch (e) {
		return { ok: false, signer: null, reason: e instanceof Error ? e.message : String(e) };
	}
}

/** Signs the canonical bytes with an EIP-191 signer (wallet `personal_sign`) and returns the envelope. */
export async function signManifest(
	m: Manifest,
	personalSign: (messageHex: Hex) => Promise<string>
): Promise<SignedManifest> {
	const d = digestManifest(m);
	const signature = normalizeSignature(await personalSign(stringToHex(d.canonical)));
	return {
		manifest: m,
		manifest_hash: d.manifest_hash,
		consensus_hash: d.consensus_hash,
		project_id: d.project_id,
		sig_type: 'eip191',
		signature
	};
}

/** Which tiers differ between two versions (§a.4). */
export function tiersChanged(prev: Manifest, next: Manifest): ('consensus' | 'scheduling' | 'listing')[] {
	const out: ('consensus' | 'scheduling' | 'listing')[] = [];
	if (canonicalJson(prev.consensus) !== canonicalJson(next.consensus)) out.push('consensus');
	if (canonicalJson(prev.scheduling) !== canonicalJson(next.scheduling)) out.push('scheduling');
	if (canonicalJson(prev.listing) !== canonicalJson(next.listing)) out.push('listing');
	return out;
}

/** Next version of a manifest: version+1, previous = current manifest_hash, with field overrides. */
export function nextVersion(
	current: Manifest,
	changes: { consensus?: ManifestConsensus; scheduling?: ManifestScheduling; listing?: ManifestListing }
): Manifest {
	return {
		...current,
		version: current.version + 1,
		previous: digestManifest(current).manifest_hash,
		consensus: changes.consensus ?? current.consensus,
		scheduling: changes.scheduling ?? current.scheduling,
		listing: changes.listing ?? current.listing
	};
}

/** Sorted unique helper for array fields that must be canonicalized by the author. */
export function sortedUnique<T extends string>(xs: readonly T[]): T[] {
	return [...new Set(xs)].sort() as T[];
}
