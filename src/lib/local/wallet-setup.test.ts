import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockMiner, checkPhrase, type MockMiner } from './mock/miner';
import {
	phraseWords,
	normalizePhrase,
	phraseLengthOk,
	looksLikePrivateKey,
	normalizePrivateKey,
	pickConfirmIndices,
	confirmationOk,
	walletState,
	walletErrorMessage,
	createWithPhrase,
	previewPhrase,
	importPhrase,
	importPrivateKey,
	unlockWallet,
	exportPrivateKey,
	EXPORT_CONFIRM_TEXT
} from './wallet-setup';
import { MinerApiError } from './miner';

// Standard BIP-39 test mnemonic and its MetaMask / BIP-44 accounts (m/44'/60'/0'/0/i).
const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const ABANDON_0 = '0x9858effd232b4033e47d90003d41ec34ecaeda94';
const ABANDON_1 = '0x6fac4d18c912343bf86fa7049364dd4e424ab9c0';
// Hardhat/anvil account 0.
const HH_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const HH_ADDR = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

let miner: MockMiner;

/** Routes the miner client's fetches (http://127.0.0.1:7878/api/v1/…) to the in-memory mock. */
function installMockFetch(m: MockMiner) {
	vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
		const u = new URL(String(input));
		const path = u.pathname.replace(/^\/api\/v1/, '');
		const body = init?.body ? JSON.parse(String(init.body)) : undefined;
		const r = m.handle(init?.method ?? 'GET', path, body) ?? { status: 404, body: { error: 'not_found', message: 'unknown endpoint' } };
		return new Response(r.status === 204 ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
	});
}

beforeEach(() => {
	miner = createMockMiner();
	installMockFetch(miner);
});
afterEach(() => vi.unstubAllGlobals());

describe('phrase input helpers', () => {
	it('accepts pasted phrases with numbering, commas, line breaks and capitals', () => {
		const messy = ABANDON.split(' ')
			.map((w, i) => `${i + 1}. ${w.toUpperCase()}`)
			.join(',\n');
		expect(normalizePhrase(messy)).toBe(ABANDON);
		expect(phraseWords('  1) abandon  2) about ')).toEqual(['abandon', 'about']);
		expect(phraseLengthOk(phraseWords(ABANDON))).toBe(true);
		expect(phraseLengthOk(['abandon'])).toBe(false);
	});

	it('recognises private keys', () => {
		expect(looksLikePrivateKey(HH_KEY)).toBe(true);
		expect(looksLikePrivateKey(HH_KEY.slice(2).toUpperCase())).toBe(true);
		expect(looksLikePrivateKey('0x1234')).toBe(false);
		expect(normalizePrivateKey(' ' + HH_KEY.slice(2).toUpperCase() + ' ')).toBe(HH_KEY);
	});

	it('picks distinct sorted confirmation words and checks answers', () => {
		const idx = pickConfirmIndices(12, 3, () => 0.5);
		expect(new Set(idx).size).toBe(3);
		expect([...idx].sort((a, b) => a - b)).toEqual(idx);
		expect(idx.every((i) => i >= 0 && i < 12)).toBe(true);
		for (let k = 0; k < 20; k++) expect(new Set(pickConfirmIndices(24)).size).toBe(3);
		const words = ABANDON.split(' ');
		expect(confirmationOk(words, [0, 11], { 0: ' Abandon ', 11: 'about' })).toBe(true);
		expect(confirmationOk(words, [0, 11], { 0: 'abandon', 11: 'abandon' })).toBe(false);
		expect(confirmationOk(words, [0, 11], { 0: 'abandon' })).toBe(false);
		expect(confirmationOk(words, [], {})).toBe(false);
	});

	it('maps miner wallet state to the options offered', () => {
		expect(walletState({ mode: 'embedded', address: null, locked: true })).toEqual({ kind: 'none' });
		expect(walletState({ mode: 'embedded', address: HH_ADDR, locked: true })).toEqual({ kind: 'locked', address: HH_ADDR });
		expect(walletState({ mode: 'embedded', address: HH_ADDR, locked: false })).toEqual({ kind: 'ready', address: HH_ADDR });
		expect(walletState({ mode: 'external', address: null, locked: true }).kind).toBe('external');
	});

	it('the mock miner checks BIP-39 checksums like the miner', () => {
		expect(checkPhrase(ABANDON)).toBeNull();
		expect(checkPhrase(ABANDON.replace('about', 'abandon'))).toMatch(/checksum/);
		expect(checkPhrase(ABANDON.replace('about', 'aboutx'))).toMatch(/word 12/);
	});
});

describe('local wallet flows against the miner API', () => {
	it('creates a wallet with a recovery phrase returned once', async () => {
		const c = await createWithPhrase(12);
		expect(c.words).toHaveLength(12);
		expect(c.confirm).toHaveLength(3);
		expect(miner.calls.at(-1)).toEqual({ action: 'create', recovery_phrase: true, words: 12 });
		expect(miner.wallet?.address).toBe(c.address);
		// The phrase really derives the created address (account 0).
		expect(await previewPhrase({ text: c.words.join(' ') })).toBe(c.address);
		const c24 = createMockMiner();
		installMockFetch(c24);
		expect((await createWithPhrase(24)).words).toHaveLength(24);
	});

	it('refuses to create or import over an existing wallet', async () => {
		await createWithPhrase(12);
		await expect(createWithPhrase(12)).rejects.toSatisfy((e) => walletErrorMessage(e).includes('already has a wallet'));
		await expect(importPhrase({ text: ABANDON })).rejects.toBeInstanceOf(MinerApiError);
	});

	it('previews and imports the standard test mnemonic (account 0 and 1)', async () => {
		expect(await previewPhrase({ text: ABANDON })).toBe(ABANDON_0);
		expect(await previewPhrase({ text: ABANDON.toUpperCase(), accountIndex: 1 })).toBe(ABANDON_1);
		expect(miner.wallet).toBeNull(); // preview stores nothing
		expect(await importPhrase({ text: ABANDON })).toBe(ABANDON_0);
		expect(miner.calls.at(-1)).toEqual({ action: 'import', recovery_phrase: ABANDON, account_index: 0 });
		expect(miner.wallet?.address).toBe(ABANDON_0);
	});

	it('imports at a chosen account index with a passphrase', async () => {
		const a = await importPhrase({ text: ABANDON, accountIndex: 1, passphrase: 'TREZOR' });
		expect(miner.calls.at(-1)).toEqual({ action: 'import', recovery_phrase: ABANDON, passphrase: 'TREZOR', account_index: 1 });
		expect(a).not.toBe(ABANDON_1);
	});

	it('rejects bad phrases before or at the miner, storing nothing', async () => {
		await expect(previewPhrase({ text: 'abandon about' })).rejects.toThrow(/12 or 24 words/);
		await expect(importPhrase({ text: ABANDON, accountIndex: 10 })).rejects.toThrow(/0–9/);
		const bad = ABANDON.replace('about', 'abandon');
		await expect(importPhrase({ text: bad })).rejects.toSatisfy((e) => walletErrorMessage(e).includes('checksum'));
		expect(miner.wallet).toBeNull();
	});

	it('imports a private key', async () => {
		await expect(importPrivateKey('0x1234')).rejects.toThrow(/64 hexadecimal/);
		expect(miner.calls).toHaveLength(0);
		expect(await importPrivateKey(HH_KEY.slice(2).toUpperCase())).toBe(HH_ADDR);
		expect(miner.calls.at(-1)).toEqual({ action: 'import', private_key: HH_KEY });
	});

	it('unlocks a locked wallet', async () => {
		miner.reset({ wallet: { privateKey: HH_KEY, locked: true } });
		const w = await unlockWallet();
		expect(w.locked).toBe(false);
		expect(w.address).toBe(HH_ADDR);
	});

	it('exports the private key only after the typed confirmation', async () => {
		miner.reset({ wallet: { privateKey: HH_KEY } });
		await expect(exportPrivateKey('yes')).rejects.toThrow(EXPORT_CONFIRM_TEXT);
		expect(miner.calls).toHaveLength(0);
		expect(await exportPrivateKey(EXPORT_CONFIRM_TEXT.toUpperCase())).toBe(HH_KEY);
	});

	it('remote dashboard sessions get no secrets', async () => {
		miner.reset({ remote: true, wallet: { privateKey: HH_KEY } });
		await expect(exportPrivateKey(EXPORT_CONFIRM_TEXT)).rejects.toSatisfy((e) => walletErrorMessage(e).includes('only available in the app'));
		miner.reset({ remote: true });
		await expect(importPhrase({ text: ABANDON })).rejects.toBeInstanceOf(MinerApiError);
		await expect(createWithPhrase()).rejects.toBeInstanceOf(MinerApiError);
		expect(miner.wallet).toBeNull();
	});

	it('reports an unreachable miner', async () => {
		vi.stubGlobal('fetch', async () => {
			throw new TypeError('fetch failed');
		});
		await expect(previewPhrase({ text: ABANDON })).rejects.toSatisfy((e) => walletErrorMessage(e).includes('not reachable'));
	});
});

describe('wallet options per build', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it('local mode offers no injected / EIP-6963 / WalletConnect options', async () => {
		vi.stubEnv('PUBLIC_APP_MODE', 'local');
		vi.stubEnv('PUBLIC_WALLETCONNECT_PROJECT_ID', 'abc');
		vi.resetModules();
		const announced: string[] = [];
		const target = new EventTarget();
		vi.stubGlobal('window', Object.assign(target, { ethereum: { request: async () => [] } }));
		target.addEventListener('eip6963:requestProvider', () => announced.push('asked'));
		const { discoverWallets, walletOptions } = await import('$lib/wallet/providers');
		discoverWallets();
		target.dispatchEvent(Object.assign(new Event('eip6963:announceProvider'), { detail: { info: { rdns: 'io.metamask', name: 'MetaMask', icon: '', uuid: '1' }, provider: {} } }));
		let list: unknown[] = ['unset'];
		walletOptions.subscribe((v) => (list = v))();
		expect(list).toEqual([]);
		expect(announced).toEqual([]);
	});

	it('web mode still discovers browser wallets', async () => {
		vi.stubEnv('PUBLIC_APP_MODE', 'web');
		vi.resetModules();
		const target = new EventTarget();
		vi.stubGlobal('window', Object.assign(target, { ethereum: { request: async () => [] } }));
		const { discoverWallets, walletOptions } = await import('$lib/wallet/providers');
		discoverWallets();
		target.dispatchEvent(Object.assign(new Event('eip6963:announceProvider'), { detail: { info: { rdns: 'io.metamask', name: 'MetaMask', icon: '', uuid: '1' }, provider: {} } }));
		let list: { id: string }[] = [];
		walletOptions.subscribe((v) => (list = v))();
		expect(list.map((o) => o.id)).toContain('io.metamask');
	});
});
