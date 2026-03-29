import { writable, derived } from 'svelte/store';

export interface WalletInfo {
	address: string;
	network: string;
	connected: boolean;
}

export interface WalletActor {
	minerId: string;
	walletAddress: string;
}

const WALLET_STORAGE_KEY = 'necter_wallet_v1';

function toHex(bytes: number) {
	const alphabet = '0123456789abcdef';
	let out = '';
	for (let i = 0; i < bytes; i++)
		out += alphabet[Math.floor(Math.random() * 16)] + alphabet[Math.floor(Math.random() * 16)];
	return out;
}

function normalizeWalletAddress(addr: string) {
	if (!addr) return addr;
	return addr.startsWith('0x') ? addr : `0x${addr}`;
}

function deriveMinerId(walletAddress: string) {
	const a = normalizeWalletAddress(walletAddress);
	return `miner_${a.slice(2, 10)}`;
}

// Core wallet state
export const wallet = writable<WalletInfo | null>(null);
export const isConnecting = writable(false);
export const showConnectModal = writable(false);

// Derived actor (minerId + walletAddress)
export const actor = derived(wallet, ($wallet) => {
	if (!$wallet?.connected || !$wallet.address) return null;
	return {
		minerId: deriveMinerId($wallet.address),
		walletAddress: $wallet.address
	} as WalletActor;
});

// Hydrate from localStorage
export function hydrateWallet() {
	if (typeof window === 'undefined') return;
	try {
		const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as WalletInfo;
		if (parsed?.address && parsed?.connected) wallet.set(parsed);
	} catch {
		// ignore
	}
}

// Connect wallet (simulated)
export async function connectWallet(walletType: string) {
	isConnecting.set(true);
	await new Promise((resolve) => setTimeout(resolve, 1500));

	const address = `0x${toHex(20)}`;
	const next: WalletInfo = {
		address,
		network: 'Ethereum Mainnet',
		connected: true
	};

	wallet.set(next);
	try {
		window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(next));
	} catch {
		// ignore
	}

	isConnecting.set(false);
	showConnectModal.set(false);
}

// Disconnect wallet
export function disconnectWallet() {
	wallet.set(null);
	try {
		window.localStorage.removeItem(WALLET_STORAGE_KEY);
	} catch {
		// ignore
	}
}
