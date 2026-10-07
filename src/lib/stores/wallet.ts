/**
 * Wallet connection + Hub sign-in.
 *
 * - `wallet`: the connected EIP-1193 account (lowercase address, chain id, connector), or null.
 * - `session` (re-exported): the Hub bearer session obtained with SIWE; required for `/v1/me*` and every write.
 * - In local mode the miner's own wallet can be used (`connectMinerWallet`); Hub calls then go through the
 *   miner's authenticated `/rpc` proxy (miner-core.md §7.1).
 */
import { derived, get, writable } from 'svelte/store';
import { numberToHex, type Hex } from 'viem';
import { api, unwrap } from '$lib/api/http';
import { session, setSession, hydrateSession, currentSession } from '$lib/api/session';
import { checkSiweMessage } from '$lib/protocol/siwe';
import { normalizeSignature } from '$lib/protocol/manifest';
import { typedDataJson } from '$lib/protocol/gasless';
import { APP_MODE, CHAIN_ID, CHAIN_NAME, CHAIN_RPC_PUBLIC, CHAIN_EXPLORER, SIWE_STATEMENT, siweDomain, siweUri } from '$lib/config';
import type { Eip712TypedData, TxRequest } from '$lib/api/types';
import { discoverWallets, walletOptions, type Eip1193Provider, type WalletOption } from '$lib/wallet/providers';
import { minerApi } from '$lib/local/miner';

export { session } from '$lib/api/session';
export { walletOptions } from '$lib/wallet/providers';

export interface WalletInfo {
	address: `0x${string}`; // lowercase
	chainId: number | null;
	connector: { id: string; name: string; kind: WalletOption['kind'] | 'miner' };
	/** Kept for compatibility with older components. */
	connected: true;
}

const LAST_CONNECTOR_KEY = 'necter_wallet_connector_v2';

export const wallet = writable<WalletInfo | null>(null);
export const isConnecting = writable(false);
export const isSigningIn = writable(false);
export const showConnectModal = writable(false);

/** Signed in = Hub session for the connected address (or local miner wallet in local mode). */
export const signedIn = derived([wallet, session], ([$w, $s]) => {
	if (!$w) return false;
	if ($w.connector.kind === 'miner') return true;
	return !!$s && $s.address === $w.address;
});

/** Address of the signed-in account, else null. */
export const account = derived([wallet, signedIn], ([$w, $ok]) => ($w && $ok ? $w.address : null));

let provider: Eip1193Provider | null = null;
let detach: (() => void) | null = null;

function lower(a: string): `0x${string}` {
	return a.toLowerCase() as `0x${string}`;
}

function remember(id: string | null) {
	try {
		if (id) localStorage.setItem(LAST_CONNECTOR_KEY, id);
		else localStorage.removeItem(LAST_CONNECTOR_KEY);
	} catch {
		/* ignore */
	}
}

function attach(p: Eip1193Provider) {
	detach?.();
	const onAccounts = (accs: unknown) => {
		const list = Array.isArray(accs) ? (accs as string[]) : [];
		const w = get(wallet);
		if (!list.length) return void disconnectWallet();
		const next = lower(list[0]);
		if (w && w.address !== next) {
			wallet.set({ ...w, address: next });
			const s = currentSession();
			if (s && s.address !== next) setSession(null);
		}
	};
	const onChain = (cid: unknown) => {
		const w = get(wallet);
		if (w) wallet.set({ ...w, chainId: typeof cid === 'string' ? parseInt(cid, 16) : Number(cid) });
	};
	const onDisconnect = () => disconnectWallet();
	p.on?.('accountsChanged', onAccounts);
	p.on?.('chainChanged', onChain);
	p.on?.('disconnect', onDisconnect);
	detach = () => {
		p.removeListener?.('accountsChanged', onAccounts);
		p.removeListener?.('chainChanged', onChain);
		p.removeListener?.('disconnect', onDisconnect);
	};
}

async function readChain(p: Eip1193Provider): Promise<number | null> {
	try {
		const c = await p.request({ method: 'eth_chainId' });
		return typeof c === 'string' ? parseInt(c, 16) : Number(c);
	} catch {
		return null;
	}
}

/** Connects a wallet option (prompts the wallet). Does not sign in; call `signIn()` next. */
export async function connectWallet(option: WalletOption): Promise<WalletInfo> {
	isConnecting.set(true);
	try {
		const p = await option.getProvider();
		const accs = (await p.request({ method: 'eth_requestAccounts' })) as string[];
		if (!accs?.length) throw new Error('The wallet did not return an account');
		provider = p;
		attach(p);
		const info: WalletInfo = {
			address: lower(accs[0]),
			chainId: await readChain(p),
			connector: { id: option.id, name: option.name, kind: option.kind },
			connected: true
		};
		const s = currentSession();
		if (s && s.address !== info.address) setSession(null);
		wallet.set(info);
		remember(option.id);
		return info;
	} finally {
		isConnecting.set(false);
	}
}

/** Local mode: use the miner's own wallet (embedded or external) — no browser wallet needed. */
export async function connectMinerWallet(): Promise<WalletInfo | null> {
	const w = await minerApi.wallet();
	if (!w.address) return null;
	provider = null;
	detach?.();
	const info: WalletInfo = {
		address: lower(w.address),
		chainId: CHAIN_ID,
		connector: { id: 'miner', name: w.mode === 'embedded' ? 'Miner wallet' : 'Miner (external wallet)', kind: 'miner' },
		connected: true
	};
	wallet.set(info);
	remember('miner');
	return info;
}

/** Silent reconnect on load (no prompt): restores the session and the last injected account if still authorised. */
export async function hydrateWallet() {
	hydrateSession();
	discoverWallets();
	let last: string | null = null;
	try {
		last = localStorage.getItem(LAST_CONNECTOR_KEY);
	} catch {
		last = null;
	}
	if (!last) return;
	if (last === 'miner') {
		if (APP_MODE === 'local') await connectMinerWallet().catch(() => null);
		return;
	}
	if (last === 'walletconnect') return; // needs an explicit reconnect
	// EIP-6963 announcements arrive asynchronously; give them a moment.
	await new Promise((r) => setTimeout(r, 150));
	const opt = get(walletOptions).find((o) => o.id === last) ?? get(walletOptions).find((o) => o.kind !== 'walletconnect');
	if (!opt) return;
	try {
		const p = await opt.getProvider();
		const accs = (await p.request({ method: 'eth_accounts' })) as string[];
		if (!accs?.length) return;
		provider = p;
		attach(p);
		const info: WalletInfo = {
			address: lower(accs[0]),
			chainId: await readChain(p),
			connector: { id: opt.id, name: opt.name, kind: opt.kind },
			connected: true
		};
		const s = currentSession();
		if (s && s.address !== info.address) setSession(null);
		wallet.set(info);
	} catch {
		/* wallet locked or gone */
	}
}

/** Signs out of the Hub and forgets the wallet. */
export async function disconnectWallet() {
	const s = currentSession();
	if (s) {
		try {
			await api.POST('/v1/auth/logout');
		} catch {
			/* revoke best-effort */
		}
	}
	setSession(null);
	detach?.();
	detach = null;
	const p = provider;
	provider = null;
	wallet.set(null);
	remember(null);
	if (p?.disconnect) await p.disconnect().catch(() => undefined);
}

function requireProvider(): Eip1193Provider {
	if (!provider) throw new Error('Connect a wallet first');
	return provider;
}

function requireAddress(): `0x${string}` {
	const w = get(wallet);
	if (!w) throw new Error('Connect a wallet first');
	return w.address;
}

/** EIP-191 `personal_sign` over raw bytes (hex) or a UTF-8 string. */
export async function personalSign(message: string | Hex): Promise<Hex> {
	const p = requireProvider();
	const address = requireAddress();
	const data = message.startsWith('0x') ? message : (('0x' + Array.from(new TextEncoder().encode(message), (b) => b.toString(16).padStart(2, '0')).join('')) as Hex);
	const sig = (await p.request({ method: 'personal_sign', params: [data, address] })) as string;
	return normalizeSignature(sig);
}

/** Switches (or adds) the settlement chain; required before EIP-712 signing in most wallets. */
export async function ensureChain(chainId = CHAIN_ID) {
	const p = requireProvider();
	const current = await readChain(p);
	if (current === chainId) return;
	const hex = numberToHex(chainId);
	try {
		await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
	} catch (e) {
		const code = (e as { code?: number })?.code;
		if (code !== 4902) throw e;
		await p.request({
			method: 'wallet_addEthereumChain',
			params: [
				{
					chainId: hex,
					chainName: CHAIN_NAME,
					nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
					rpcUrls: [CHAIN_RPC_PUBLIC],
					blockExplorerUrls: [CHAIN_EXPLORER]
				}
			]
		});
	}
	const w = get(wallet);
	if (w) wallet.set({ ...w, chainId });
}

/** `eth_signTypedData_v4` (after `ensureChain`). Caller must have checked the payload (`checkGaslessPayload`). */
export async function signTypedData(td: Eip712TypedData): Promise<Hex> {
	const p = requireProvider();
	const address = requireAddress();
	const chain = Number((td.domain as Record<string, unknown>).chainId ?? CHAIN_ID);
	await ensureChain(chain);
	const sig = (await p.request({ method: 'eth_signTypedData_v4', params: [address, typedDataJson(td)] })) as string;
	return normalizeSignature(sig);
}

/** Sends a transaction prepared by the Hub (`TxRequest`, e.g. ProjectRegistry.register). Returns the tx hash. */
export async function sendTransaction(tx: TxRequest): Promise<Hex> {
	const p = requireProvider();
	const from = requireAddress();
	await ensureChain(tx.chain_id);
	const params: Record<string, string> = { from, to: tx.to, data: tx.data };
	if (tx.value && tx.value !== '0') params.value = numberToHex(BigInt(tx.value));
	return (await p.request({ method: 'eth_sendTransaction', params: [params] })) as Hex;
}

/**
 * SIWE sign-in: `POST /v1/auth/nonce` → check the message → `personal_sign` → `POST /v1/auth/siwe`.
 * Stores the bearer session and returns it.
 */
export async function signIn() {
	const w = get(wallet);
	if (!w) throw new Error('Connect a wallet first');
	if (w.connector.kind === 'miner') return null;
	isSigningIn.set(true);
	try {
		const domain = siweDomain();
		const nonce = await unwrap(api.POST('/v1/auth/nonce', { body: { address: w.address, domain } }));
		const check = checkSiweMessage(nonce.message, {
			domain,
			address: w.address,
			uri: siweUri(),
			chainId: CHAIN_ID,
			statement: SIWE_STATEMENT,
			nonce: nonce.nonce
		});
		if (!check.ok) throw new Error(`Refusing to sign the sign-in message: ${check.reason}`);
		const signature = (await personalSign(nonce.message)).toLowerCase();
		const s = await unwrap(api.POST('/v1/auth/siwe', { body: { message: nonce.message, signature } }));
		if (s.address.toLowerCase() !== w.address) throw new Error('The Hub signed in a different address');
		setSession({ token: s.token, address: s.address.toLowerCase(), expires_at: s.expires_at, roles: s.roles ?? [] });
		return s;
	} finally {
		isSigningIn.set(false);
	}
}

/** Opens the connect modal when needed; resolves true when signed in. */
export function requestSignIn() {
	showConnectModal.set(true);
}

export function hasProvider() {
	return provider !== null;
}
