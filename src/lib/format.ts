/**
 * Display formatting. All token math is bigint over wei strings (PLATFORM.md §j: no JS floats in logic);
 * floats appear only in the final display string.
 */
import type { Category, DeviceClass, ListingStatus, Token } from '$lib/api/types';

const AMOUNT_RE = /^(0|[1-9][0-9]{0,77})$/;

export function isAmount(s: unknown): s is string {
	return typeof s === 'string' && AMOUNT_RE.test(s);
}

/** Parses a decimal display string ("12.5") into base units. Throws on invalid input or too many decimals. */
export function parseUnits(value: string, decimals: number): string {
	const v = value.trim();
	if (!/^\d+(\.\d+)?$/.test(v)) throw new Error('Enter a positive number');
	const [int, frac = ''] = v.split('.');
	if (frac.length > decimals) throw new Error(`At most ${decimals} decimal places`);
	const wei = BigInt(int + frac.padEnd(decimals, '0'));
	return wei.toString();
}

/** Exact decimal string of `wei / 10^decimals`, trailing zeros trimmed. */
export function formatUnitsExact(wei: string | bigint, decimals: number): string {
	const v = typeof wei === 'bigint' ? wei : BigInt(isAmount(wei) ? wei : '0');
	const neg = v < 0n;
	const abs = neg ? -v : v;
	const base = 10n ** BigInt(decimals);
	const int = abs / base;
	let frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
	return `${neg ? '-' : ''}${int.toString()}${frac ? '.' + frac : ''}`;
}

/**
 * Human amount: grouped integer part, up to `maxFrac` significant fraction digits, compact suffix for big values.
 * `formatAmount("1500000000000000000000", 18)` → "1,500"
 */
export function formatAmount(
	wei: string | bigint | null | undefined,
	decimals = 18,
	opts: { maxFrac?: number; compact?: boolean } = {}
): string {
	if (wei === null || wei === undefined) return '—';
	const maxFrac = opts.maxFrac ?? 4;
	const v = typeof wei === 'bigint' ? wei : isAmount(wei) ? BigInt(wei) : null;
	if (v === null) return '—';
	const base = 10n ** BigInt(decimals);
	const int = v / base;
	if (opts.compact && int >= 1_000_000n) {
		const units: [bigint, string][] = [
			[10n ** 12n, 'T'],
			[10n ** 9n, 'B'],
			[10n ** 6n, 'M']
		];
		for (const [u, s] of units) {
			if (int >= u) {
				const scaled = (v * 100n) / (base * u);
				return `${(Number(scaled) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}${s}`;
			}
		}
	}
	const fracFull = (v % base).toString().padStart(decimals, '0');
	let frac = fracFull.slice(0, maxFrac).replace(/0+$/, '');
	if (int === 0n && !frac && v > 0n) {
		// tiny non-zero amount: show "<0.0001"
		return `<0.${'0'.repeat(Math.max(0, maxFrac - 1))}1`;
	}
	const intStr = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return frac ? `${intStr}.${frac}` : intStr;
}

export function formatToken(wei: string | null | undefined, token?: Pick<Token, 'symbol' | 'decimals'> | null, opts?: { maxFrac?: number; compact?: boolean }) {
	if (!token) return formatAmount(wei, 18, opts);
	return `${formatAmount(wei, token.decimals, opts)} ${token.symbol}`;
}

/** Basis points → "85%" / "12.5%". */
export function bpToPercent(bp: number | null | undefined, frac = 1): string {
	if (bp === null || bp === undefined || !Number.isFinite(bp)) return '—';
	const pct = bp / 100;
	return `${pct.toLocaleString('en-US', { maximumFractionDigits: frac })}%`;
}

/** Signed bp growth → "+4.2%" */
export function bpDelta(bp: number | null | undefined): string {
	if (bp === null || bp === undefined) return '—';
	const s = bpToPercent(Math.abs(bp));
	return bp >= 0 ? `+${s}` : `-${s}`;
}

export function shortHex(h: string | null | undefined, head = 6, tail = 4): string {
	if (!h) return '—';
	if (h.length <= head + tail + 1) return h;
	return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export const shortAddress = (a: string | null | undefined) => shortHex(a, 6, 4);

export function formatNumber(n: number | null | undefined, frac = 0): string {
	if (n === null || n === undefined || !Number.isFinite(n)) return '—';
	return n.toLocaleString('en-US', { maximumFractionDigits: frac });
}

export function compactNumber(n: number | null | undefined): string {
	if (n === null || n === undefined || !Number.isFinite(n)) return '—';
	return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Unix seconds → "3m ago" / "in 2h". */
export function timeAgo(unix: number | null | undefined, now = Math.floor(Date.now() / 1000)): string {
	if (!unix) return '—';
	const d = now - unix;
	const abs = Math.abs(d);
	const fmt = (v: number, u: string) => (d >= 0 ? `${v}${u} ago` : `in ${v}${u}`);
	if (abs < 45) return d >= 0 ? 'just now' : 'in a moment';
	if (abs < 3600) return fmt(Math.round(abs / 60), 'm');
	if (abs < 86400) return fmt(Math.round(abs / 3600), 'h');
	if (abs < 86400 * 30) return fmt(Math.round(abs / 86400), 'd');
	return formatDate(unix);
}

export function formatDate(unix: number | null | undefined): string {
	if (!unix) return '—';
	return new Date(unix * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(unix: number | null | undefined): string {
	if (!unix) return '—';
	return new Date(unix * 1000).toLocaleString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function formatDuration(secs: number | null | undefined): string {
	if (secs === null || secs === undefined || !Number.isFinite(secs)) return '—';
	if (secs < 60) return `${secs}s`;
	if (secs < 3600) return `${Math.round(secs / 60)} min`;
	if (secs < 86400) {
		const h = secs / 3600;
		return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
	}
	const d = secs / 86400;
	return `${Number.isInteger(d) ? d : d.toFixed(1)} days`;
}

export function formatMs(ms: number | null | undefined): string {
	if (ms === null || ms === undefined) return '—';
	if (ms < 1000) return `${ms} ms`;
	return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

export function formatMb(mb: number | null | undefined): string {
	if (mb === null || mb === undefined) return '—';
	if (mb >= 1024 * 1024) return `${(mb / 1024 / 1024).toFixed(1)} TB`;
	if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
	return `${mb} MB`;
}

/** Average rating ×100 → "4.6". */
export function formatRating(x100: number | null | undefined): string {
	if (x100 === null || x100 === undefined) return '—';
	return (x100 / 100).toFixed(1);
}

// ── categories ──

export const CATEGORIES: { slug: Category; name: string; short: string }[] = [
	{ slug: 'depin', name: 'DePIN', short: 'DePIN' },
	{ slug: 'machine-learning', name: 'AI / Machine Learning', short: 'AI/ML' },
	{ slug: 'compute', name: 'Compute', short: 'Compute' },
	{ slug: 'storage', name: 'Storage', short: 'Storage' },
	{ slug: 'iot', name: 'IoT', short: 'IoT' },
	{ slug: 'data-sovereignty', name: 'Data Sovereignty', short: 'Data Sovereignty' },
	{ slug: 'bandwidth', name: 'Bandwidth', short: 'Bandwidth' },
	{ slug: 'content-delivery', name: 'Content Delivery', short: 'Content Delivery' },
	{ slug: 'blockchain', name: 'Blockchain', short: 'Blockchain' },
	{ slug: 'hardware-staking', name: 'Hardware Staking', short: 'Hardware Staking' }
];

export function categoryName(slug: string | null | undefined): string {
	return CATEGORIES.find((c) => c.slug === slug)?.name ?? (slug ? slug.replace(/-/g, ' ') : '—');
}

export function categoryShort(slug: string | null | undefined): string {
	return CATEGORIES.find((c) => c.slug === slug)?.short ?? categoryName(slug);
}

export function isCategory(s: string): s is Category {
	return CATEGORIES.some((c) => c.slug === s);
}

export const DEVICE_CLASS_LABEL: Record<DeviceClass, string> = {
	phone: 'Phone',
	tablet: 'Tablet',
	laptop: 'Laptop',
	desktop: 'Desktop',
	server: 'Server'
};

/** PLATFORM.md §j.1 status mapping for listing badges. */
export function listingStatusLabel(s: ListingStatus | string | null | undefined): {
	label: string;
	variant: 'accent' | 'success' | 'warning' | 'error' | 'neutral';
} {
	switch (s) {
		case 'listed':
			return { label: 'Active', variant: 'success' };
		case 'pending_review':
		case 'submitted':
			return { label: 'Pending review', variant: 'warning' };
		case 'paused':
			return { label: 'Paused', variant: 'warning' };
		case 'underfunded':
			return { label: 'Underfunded', variant: 'warning' };
		case 'rejected':
			return { label: 'Rejected', variant: 'error' };
		case 'delisted':
			return { label: 'Deprecated', variant: 'neutral' };
		case 'draft':
			return { label: 'Draft', variant: 'neutral' };
		default:
			return { label: s ?? '—', variant: 'neutral' };
	}
}

export function rewardModelLabel(m: string | null | undefined): string {
	if (m === 'per-unit') return 'Per-task';
	if (m === 'epoch-pool') return 'Per-epoch';
	return m ?? '—';
}

export function txUrl(hash: string, explorer = 'https://sepolia.etherscan.io'): string {
	return `${explorer.replace(/\/$/, '')}/tx/${hash}`;
}

export function addressUrl(addr: string, explorer = 'https://sepolia.etherscan.io'): string {
	return `${explorer.replace(/\/$/, '')}/address/${addr}`;
}
