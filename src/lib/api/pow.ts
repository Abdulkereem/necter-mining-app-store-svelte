/**
 * Proof-of-work apps on the Hub (`/v1/pow/apps…`, POW-APPS.md). Plain fetches: these endpoints are new and kept
 * out of the generated schema until the next `gen:api`.
 */
import { RPC_URL } from '$lib/config';

export interface PowApp {
	app_id: string;
	project_id: string;
	slug: string;
	kind: 'proof-of-work';
	workload: 'pow.randomx';
	name: string;
	coin: string;
	algorithm: string;
	pool_mode: 'test';
	tagline: string;
	description: string;
	testnet_note: string | null;
	website: string;
	category: string;
	accent_color: string;
	device_classes: string[];
	mobile_enabled: boolean;
	opt_in: boolean;
	default_cpu_pct: number;
	disclosure_version: string;
	share_difficulty: number;
	units_per_share: number;
	epoch_secs: number;
	reward: { token: { symbol?: string } | null; reward_per_unit: string; daily_emission: string; vault: string | null; settlement: string };
}

/** Local logo assets for first-party PoW apps (official marks, see static/apps/<id>/ATTRIBUTION.txt). */
export const POW_ICONS: Record<string, { src: string; credit: string; license: string }> = {
	monero: {
		src: '/apps/monero/monero-symbol.png',
		credit: 'Monero symbol © The Monero Project',
		license: 'https://creativecommons.org/licenses/by-sa/4.0/'
	}
};

async function get<T>(path: string): Promise<T> {
	const r = await fetch(`${RPC_URL}${path}`, { headers: { Accept: 'application/json' } });
	if (!r.ok) throw new Error(`Hub ${r.status}`);
	return (await r.json()) as T;
}

export const pow = {
	apps: () => get<{ items: PowApp[] }>('/v1/pow/apps').then((r) => r.items),
	app: (id: string) => get<PowApp>(`/v1/pow/apps/${encodeURIComponent(id)}`),
	worker: (id: string, nodeId: string) =>
		get<{ units_credited: number; units_pending: number; strikes: number; suspended_until: number | null; epoch: number }>(
			`/v1/pow/apps/${encodeURIComponent(id)}/workers/${encodeURIComponent(nodeId)}`
		)
};

export function deviceClassLabel(classes: string[]): string {
	const names: Record<string, string> = { desktop: 'Desktop', laptop: 'Laptop', server: 'Server', phone: 'Android phone', tablet: 'Android tablet' };
	return classes.map((c) => names[c] ?? c).join(' · ');
}
