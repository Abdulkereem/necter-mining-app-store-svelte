/**
 * EIP-1193 wallet providers: EIP-6963 discovery of injected wallets (MetaMask, Rabby, Coinbase, …), a legacy
 * `window.ethereum` fallback, and WalletConnect v2 (only when PUBLIC_WALLETCONNECT_PROJECT_ID is set; loaded on
 * demand so it adds nothing to the initial bundle).
 */
import { writable, type Readable } from 'svelte/store';
import { APP_MODE, CHAIN_ID, CHAIN_RPC_PUBLIC, WALLETCONNECT_PROJECT_ID } from '$lib/config';

export interface Eip1193Provider {
	request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
	on?(event: string, listener: (...args: any[]) => void): void;
	removeListener?(event: string, listener: (...args: any[]) => void): void;
	disconnect?(): Promise<void>;
}

export interface WalletOption {
	id: string; // eip6963 rdns / 'injected' / 'walletconnect'
	name: string;
	icon: string | null; // data URI or URL
	kind: 'eip6963' | 'injected' | 'walletconnect';
	/** Resolves the provider (WalletConnect lazily creates its session). */
	getProvider(): Promise<Eip1193Provider>;
}

interface Eip6963Detail {
	info: { uuid: string; name: string; icon: string; rdns: string };
	provider: Eip1193Provider;
}

const _options = writable<WalletOption[]>([]);
export const walletOptions: Readable<WalletOption[]> = { subscribe: _options.subscribe };

const discovered = new Map<string, WalletOption>();
let started = false;

function publish() {
	const list = [...discovered.values()];
	const w = typeof window !== 'undefined' ? (window as unknown as { ethereum?: Eip1193Provider }) : undefined;
	if (list.length === 0 && w?.ethereum) {
		const eth = w.ethereum;
		list.push({ id: 'injected', name: 'Browser wallet', icon: null, kind: 'injected', getProvider: async () => eth });
	}
	if (WALLETCONNECT_PROJECT_ID) {
		list.push({ id: 'walletconnect', name: 'WalletConnect', icon: null, kind: 'walletconnect', getProvider: getWalletConnectProvider });
	}
	_options.set(list);
}

/** Starts EIP-6963 discovery (idempotent). */
export function discoverWallets() {
	if (typeof window === 'undefined' || APP_MODE === 'local') return;
	if (!started) {
		started = true;
		window.addEventListener('eip6963:announceProvider', (ev: Event) => {
			const d = (ev as CustomEvent<Eip6963Detail>).detail;
			if (!d?.info?.rdns || !d.provider) return;
			// Only accept image data URIs for icons (EIP-6963 recommends data URIs; avoids remote fetches).
			const icon = typeof d.info.icon === 'string' && d.info.icon.startsWith('data:image/') ? d.info.icon : null;
			discovered.set(d.info.rdns, {
				id: d.info.rdns,
				name: d.info.name,
				icon,
				kind: 'eip6963',
				getProvider: async () => d.provider
			});
			publish();
		});
	}
	window.dispatchEvent(new Event('eip6963:requestProvider'));
	publish();
}

export function findWalletOption(id: string, list: WalletOption[]): WalletOption | undefined {
	return list.find((o) => o.id === id);
}

let wcProvider: Eip1193Provider | null = null;

async function getWalletConnectProvider(): Promise<Eip1193Provider> {
	if (!WALLETCONNECT_PROJECT_ID) throw new Error('WalletConnect is not configured');
	if (wcProvider) return wcProvider;
	const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
	const p = await EthereumProvider.init({
		projectId: WALLETCONNECT_PROJECT_ID,
		chains: [CHAIN_ID],
		showQrModal: true,
		rpcMap: { [CHAIN_ID]: CHAIN_RPC_PUBLIC },
		metadata: {
			name: 'Necter Mining App Store',
			description: 'Discover and mine Necter projects',
			url: typeof location !== 'undefined' ? location.origin : 'https://testnet.necter.network',
			icons: ['https://testnet.necter.network/brand/favicon-512.png']
		}
	});
	await p.connect();
	wcProvider = p as unknown as Eip1193Provider;
	return wcProvider;
}
