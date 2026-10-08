/**
 * On-chain balances of the connected wallet (`GET /v1/accounts/{address}/balances`, public).
 */
import { get, writable, type Readable } from 'svelte/store';
import { hub } from '$lib/api/hub';
import type { TokenBalance } from '$lib/api/types';
import { wallet } from './wallet';

export interface WalletBalances {
	address: string;
	balances: TokenBalance[];
	unclaimed: TokenBalance[];
	collateral_bonded?: string;
}

const _b = writable<WalletBalances | null>(null);
export const balances: Readable<WalletBalances | null> = { subscribe: _b.subscribe };

let started = false;
let current: string | null = null;

export async function refreshBalances() {
	const w = get(wallet);
	if (!w) {
		_b.set(null);
		return;
	}
	try {
		const r = await hub.balances(w.address);
		if (get(wallet)?.address === w.address) _b.set(r);
	} catch {
		/* keep the last value; the sidebar shows a dash */
	}
}

export function startBalanceSync() {
	if (started) return;
	started = true;
	wallet.subscribe((w) => {
		const a = w?.address ?? null;
		if (a === current) return;
		current = a;
		_b.set(null);
		if (a) void refreshBalances();
	});
	setInterval(() => {
		if (current && typeof document !== 'undefined' && document.visibilityState === 'visible') void refreshBalances();
	}, 60_000);
}

/** NECTA balance (by symbol) or null. */
export function nectaOf(b: WalletBalances | null): TokenBalance | null {
	return b?.balances.find((x) => x.token.symbol === 'NECTA') ?? null;
}
