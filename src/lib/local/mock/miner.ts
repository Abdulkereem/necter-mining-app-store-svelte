/**
 * In-memory mock of necter-miner's local wallet API (`/api/v1/session`, `/api/v1/wallet`, `/api/v1/pow`, a few reads) for vitest
 * and the Playwright local-mode server. Test-only; never imported by the app.
 *
 * Mirrors the miner's behaviour (necter-miner README "Embedded wallet"): BIP-39 English phrases with checksum,
 * m/44'/60'/0'/0/<index> derivation, one wallet per miner (409 when one exists), phrase returned once on create,
 * import/derive/export refused for remote sessions.
 */
import { english, generateMnemonic, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { bytesToHex, hexToBytes, sha256, type Hex } from 'viem';

export interface MockMinerOptions {
	remote?: boolean;
	/** Start with this wallet already present. */
	wallet?: { privateKey: Hex; locked?: boolean };
}

interface Stored {
	address: string;
	privateKey: Hex;
	locked: boolean;
}

export interface MockMinerResponse {
	status: number;
	body: unknown;
}

const LENGTHS = [12, 15, 18, 21, 24];

/** Per-app PoW disclosures (miner 1.0.4+): enabling an app needs that app's version. */
export const MOCK_POW_DISCLOSURES: Record<string, { version: string; text: string; workload: string; algo: string; coin: string }> = {
	monero: {
		version: 'pow-randomx-v2',
		workload: 'pow.randomx',
		algo: 'rx/0',
		coin: 'XMR',
		text: 'When turned on, this device runs RandomX proof-of-work for Necter within the CPU limit you set. Necter chooses the RandomX coin its treasury mines (Monero by default; Tari is merge-mined with Monero) and keeps what is mined. You are paid in NECTA for every verified share. Mining uses electricity and warms the device; you can turn it off at any time.'
	},
	verus: {
		version: 'pow-verus-v1',
		workload: 'pow.verushash',
		algo: 'verushash-2.2',
		coin: 'VRSC',
		text: 'When turned on, this device runs VerusHash 2.2 proof-of-work for Necter within the CPU limit you set. Necter keeps the mined Verus (VRSC). You are paid in NECTA for every verified share. Mining uses electricity and warms the device; you can turn it off at any time.'
	}
};

function err(status: number, error: string, message: string): MockMinerResponse {
	return { status, body: { error, message } };
}

/** BIP-39 checks as the miner does them; returns an error message or null. */
export function checkPhrase(phrase: string): string | null {
	const words = phrase.split(' ').filter(Boolean);
	if (!LENGTHS.includes(words.length)) return `a recovery phrase has 12 or 24 words (got ${words.length})`;
	const idx = words.map((w) => english.indexOf(w));
	const bad = idx.findIndex((i) => i < 0);
	if (bad >= 0) return `word ${bad + 1} of the recovery phrase is not in the BIP-39 English wordlist`;
	const bits = idx.map((i) => i.toString(2).padStart(11, '0')).join('');
	const entBits = (words.length * 11 * 32) / 33;
	const entropy = new Uint8Array(entBits / 8);
	for (let i = 0; i < entropy.length; i++) entropy[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
	const hash = hexToBytes(sha256(entropy));
	const cs = Array.from(hash, (b) => b.toString(2).padStart(8, '0'))
		.join('')
		.slice(0, words.length / 3);
	if (cs !== bits.slice(entBits)) return 'the recovery phrase checksum does not match; check the words and their order';
	return null;
}

function derive(phrase: string, passphrase: string, index: number) {
	const acct = mnemonicToAccount(phrase, { addressIndex: index, passphrase: passphrase || undefined });
	const pk = acct.getHdKey().privateKey;
	return { address: acct.address.toLowerCase(), privateKey: bytesToHex(pk!) };
}

export function createMockMiner(opts: MockMinerOptions = {}) {
	let remote = !!opts.remote;
	let wallet: Stored | null = null;
	/** Every POST /wallet body (tests assert what the UI sent). */
	const calls: Record<string, unknown>[] = [];
	let pow = { enabled: false, accepted_disclosure: '', app: 'monero', max_cpu_pct: 50 };

	function powJson() {
		const d = MOCK_POW_DISCLOSURES[pow.app];
		return {
			compiled: true,
			app: pow.app,
			workload: d.workload,
			settings: { ...pow, max_threads: 0, memory_mode: 'auto', max_thermal: 'serious', pause_when_user_active: null, require_ac: null, mobile_min_battery_pct: 50, mobile_max_battery_temp_c: 40 },
			decision: pow.enabled ? { state: 'running', threads: 4, mode: 'fast' } : { state: 'off', reason: 'not_opted_in' },
			hub: { fetched: true, device_classes: ['desktop', 'laptop', 'server'], mobile_enabled: false, error: null },
			stats: pow.enabled
				? { hashes: 120000, hashrate_hs: 2400, shares: { found: 12, submitted: 12, accepted: 11, rejected: 1, duplicate: 0 }, job: { job_id: 'job_mock', difficulty: 1000, algo: d.algo, coin: d.coin }, last_error: null }
				: null,
			memory_mb: { total: 16384, available: 8192 },
			disclosure: { version: d.version, text: d.text },
			disclosures: Object.fromEntries(Object.entries(MOCK_POW_DISCLOSURES).map(([k, v]) => [k, { version: v.version, text: v.text }]))
		};
	}

	function putPow(b: Record<string, unknown>): MockMinerResponse {
		const app = typeof b.app === 'string' ? b.app : pow.app;
		if (!MOCK_POW_DISCLOSURES[app]) return err(400, 'invalid', `unknown proof-of-work app ${app}`);
		if (b.enabled === true && b.accepted_disclosure !== MOCK_POW_DISCLOSURES[app].version)
			return err(400, 'disclosure_required', `accept the ${app} disclosure (${MOCK_POW_DISCLOSURES[app].version}) first`);
		const next = { ...pow, app };
		if (typeof b.enabled === 'boolean') next.enabled = b.enabled;
		if (typeof b.accepted_disclosure === 'string') next.accepted_disclosure = b.accepted_disclosure;
		if (typeof b.max_cpu_pct === 'number') next.max_cpu_pct = Math.min(100, Math.max(10, b.max_cpu_pct));
		// Switching app keeps mining only if that app's disclosure was accepted.
		if (next.enabled && next.accepted_disclosure !== MOCK_POW_DISCLOSURES[app].version) next.enabled = false;
		pow = next;
		return { status: 200, body: powJson() };
	}

	function reset(o: MockMinerOptions = {}) {
		remote = !!o.remote;
		calls.length = 0;
		pow = { enabled: false, accepted_disclosure: '', app: 'monero', max_cpu_pct: 50 };
		wallet = o.wallet
			? { address: privateKeyToAccount(o.wallet.privateKey).address.toLowerCase(), privateKey: o.wallet.privateKey, locked: !!o.wallet.locked }
			: null;
	}
	reset(opts);

	function walletJson() {
		return { mode: 'embedded', address: wallet?.address ?? null, locked: wallet ? wallet.locked : true };
	}

	function phraseArgs(b: Record<string, unknown>): { phrase: string; pass: string; index: number } | MockMinerResponse {
		if (typeof b.recovery_phrase !== 'string') return err(400, 'invalid', 'recovery_phrase is required');
		const index = b.account_index ?? 0;
		if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 9)
			return err(400, 'invalid', 'account_index must be an integer 0–9');
		const phrase = b.recovery_phrase.trim().toLowerCase().split(/\s+/).join(' ');
		const problem = checkPhrase(phrase);
		if (problem) return err(400, 'invalid', problem);
		return { phrase, pass: typeof b.passphrase === 'string' ? b.passphrase : '', index };
	}

	function postWallet(b: Record<string, unknown>): MockMinerResponse {
		calls.push(b);
		const action = b.action;
		const secret = action === 'import' || action === 'export' || action === 'derive' || (action === 'create' && b.recovery_phrase === true);
		if (secret && remote) return err(403, 'forbidden', 'wallet import/export is only available on this machine');
		switch (action) {
			case 'create': {
				if (b.recovery_phrase === true) {
					const words = b.words ?? 12;
					if (words !== 12 && words !== 24) return err(400, 'invalid', 'words must be 12 or 24');
					if (wallet) return err(409, 'state', 'an embedded wallet already exists');
					const phrase = generateMnemonic(english, words === 24 ? 256 : 128);
					const d = derive(phrase, '', 0);
					wallet = { ...d, locked: false };
					return { status: 200, body: { address: d.address, recovery_phrase: phrase, derivation_path: "m/44'/60'/0'/0/0" } };
				}
				if (wallet) return err(409, 'state', 'an embedded wallet already exists');
				const pk = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
				wallet = { address: privateKeyToAccount(pk).address.toLowerCase(), privateKey: pk, locked: false };
				return { status: 200, body: { address: wallet.address } };
			}
			case 'import': {
				if (typeof b.recovery_phrase === 'string') {
					const a = phraseArgs(b);
					if ('status' in a) return a;
					if (wallet) return err(409, 'state', 'an embedded wallet already exists');
					const d = derive(a.phrase, a.pass, a.index);
					wallet = { ...d, locked: false };
					return { status: 200, body: { address: d.address, derivation_path: `m/44'/60'/0'/0/${a.index}` } };
				}
				if (typeof b.private_key !== 'string' || !/^0x[0-9a-f]{64}$/i.test(b.private_key))
					return err(400, 'invalid', 'private_key or recovery_phrase is required');
				if (wallet) return err(409, 'state', 'an embedded wallet already exists');
				const pk = b.private_key.toLowerCase() as Hex;
				wallet = { address: privateKeyToAccount(pk).address.toLowerCase(), privateKey: pk, locked: false };
				return { status: 200, body: { address: wallet.address } };
			}
			case 'derive': {
				const a = phraseArgs(b);
				if ('status' in a) return a;
				const d = derive(a.phrase, a.pass, a.index);
				return { status: 200, body: { address: d.address, account_index: a.index, derivation_path: `m/44'/60'/0'/0/${a.index}` } };
			}
			case 'unlock':
				if (!wallet) return err(404, 'not_found', 'no embedded wallet');
				wallet.locked = false;
				return { status: 200, body: walletJson() };
			case 'export':
				if (!wallet || wallet.locked) return err(423, 'wallet_locked', 'the wallet is locked');
				return { status: 200, body: { private_key: wallet.privateKey } };
			default:
				return err(400, 'invalid', `unknown wallet action ${String(action)}`);
		}
	}

	/** Handles `/api/v1/<path>`; returns null for paths the mock does not know (→ 404). */
	function handle(method: string, path: string, body: unknown): MockMinerResponse | null {
		const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
		if (path === '/session' && method === 'GET')
			return { status: 200, body: { authenticated: true, remote, csrf_token: 'mock-csrf', expires_at: null, reauth_until: null } };
		if (path === '/session' && method === 'POST') return { status: 204, body: null };
		if (path === '/wallet' && method === 'GET') return { status: 200, body: walletJson() };
		if (path === '/wallet' && method === 'POST') return postWallet(b);
		if (path === '/status' && method === 'GET')
			return { status: 200, body: { state: 'unbound', node_id: 'ndsr-mock', owner: null, relay: { connected: false } } };
		if (path === '/identity' && method === 'GET') return { status: 200, body: { node_id: 'ndsr-mock', public_key: '0x00', owner: null } };
		if (path === '/sign-requests' && method === 'GET') return { status: 200, body: { items: [] } };
		if (path === '/pow' && method === 'GET') return { status: 200, body: powJson() };
		if (path === '/pow' && method === 'PUT') return putPow(b);
		return null;
	}

	return { handle, reset, calls, get pow() { return { ...pow }; }, get wallet() { return wallet ? { ...wallet } : null; } };
}

export type MockMiner = ReturnType<typeof createMockMiner>;
