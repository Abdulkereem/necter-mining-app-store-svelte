/**
 * Display labels / colors for the miner-side resources (PLATFORM.md §d.3, §h, §i) and per-token amount helpers.
 * Amounts stay bigint; only chart heights become numbers.
 */
import type {
	DeviceStatus,
	EpochPayout,
	Lease,
	ProofStatus,
	SlashStatus,
	SubscriptionStatus,
	Token,
	TokenBalance,
	Withdrawal
} from '$lib/api/types';

export type Variant = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

export interface StatusMeta {
	label: string;
	variant: Variant;
	color: string;
	/** `status-dot-*` class suffix from app.css */
	dot: 'active' | 'proving' | 'earning' | 'paused' | 'slashed' | 'pending';
	hint?: string;
}

const COLOR: Record<Variant, string> = {
	accent: 'var(--text-accent)',
	success: 'var(--success)',
	warning: 'var(--warning)',
	error: 'var(--error)',
	neutral: 'var(--text-tertiary)'
};

const meta = (label: string, variant: Variant, dot: StatusMeta['dot'], hint?: string): StatusMeta => ({
	label,
	variant,
	color: COLOR[variant],
	dot,
	hint
});

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, StatusMeta> = {
	pending_collateral: meta('Awaiting collateral', 'accent', 'pending', 'Waiting for the bond to confirm on-chain.'),
	active: meta('Active', 'success', 'active', 'Eligible for task committees from the next snapshot.'),
	paused: meta('Paused', 'neutral', 'paused', 'Excluded from new snapshots; collateral stays bonded and slashable.'),
	jailed: meta('Jailed', 'error', 'slashed', 'Collateral fell below the minimum after a slash. Top up to reactivate.'),
	unbonding: meta('Unbonding', 'warning', 'proving', 'Not eligible for work; collateral is released after the unbonding period.'),
	withdrawable: meta('Withdrawable', 'accent', 'earning', 'Unbonding finished. Withdraw the collateral to your wallet.'),
	closed: meta('Closed', 'neutral', 'paused', 'Collateral withdrawn. This subscription has ended.')
};

export const SUBSCRIPTION_STATUSES = Object.keys(SUBSCRIPTION_STATUS) as SubscriptionStatus[];

export function subStatus(s: string | null | undefined): StatusMeta {
	return SUBSCRIPTION_STATUS[s as SubscriptionStatus] ?? meta(s ?? '—', 'neutral', 'paused');
}

export const PROOF_STATUS: Record<ProofStatus, StatusMeta> = {
	pending: meta('Pending', 'neutral', 'pending', 'Voted; waiting for validator finality.'),
	verified: meta('Verified', 'success', 'active', 'Your vote matched the finalized result.'),
	rejected: meta('Rejected', 'error', 'slashed', 'Your vote did not match the finalized result.'),
	missed: meta('Missed', 'warning', 'proving', 'The lease deadline passed without a vote.')
};

export function proofStatus(s: string | null | undefined): StatusMeta {
	return PROOF_STATUS[s as ProofStatus] ?? meta(s ?? '—', 'neutral', 'paused');
}

export const REJECTION_REASON: Record<string, string> = {
	disagreed: 'Result disagreed with the finalized receipt',
	invalid_vote: 'Vote signature or format was invalid',
	late: 'Vote arrived after the lease deadline',
	missed: 'No vote before the lease deadline'
};

export const SLASH_STATUS: Record<SlashStatus, StatusMeta> = {
	recorded: meta('Recorded', 'neutral', 'pending'),
	proposed: meta('Proposed', 'warning', 'proving'),
	disputed: meta('Disputed', 'accent', 'earning'),
	cancelled: meta('Cancelled', 'success', 'active'),
	executed: meta('Executed', 'error', 'slashed')
};

export function slashStatus(s: string | null | undefined): StatusMeta {
	return SLASH_STATUS[s as SlashStatus] ?? meta(s ?? '—', 'neutral', 'paused');
}

export const SLASH_KIND: Record<string, string> = {
	invalid_result: 'Invalid result',
	equivocation: 'Equivocation',
	missed_sla: 'Missed SLA'
};

export const LEASE_STATE: Record<Lease['state'], StatusMeta> = {
	offered: meta('Offered', 'neutral', 'pending'),
	leased: meta('Running', 'accent', 'earning'),
	voted: meta('Voted', 'warning', 'proving'),
	finalized: meta('Finalized', 'success', 'active'),
	missed: meta('Missed', 'error', 'slashed'),
	cancelled: meta('Cancelled', 'neutral', 'paused')
};

export const PAYOUT_STATUS: Record<EpochPayout['status'], StatusMeta> = {
	accruing: meta('Accruing', 'neutral', 'pending'),
	attested: meta('Attested', 'warning', 'proving'),
	settled: meta('Settled', 'accent', 'earning'),
	claimable: meta('Claimable', 'accent', 'earning'),
	claimed: meta('Claimed', 'success', 'active'),
	vetoed: meta('Vetoed', 'error', 'slashed')
};

export const WITHDRAWAL_STATUS: Record<Withdrawal['status'], StatusMeta> = {
	pending: meta('Pending', 'warning', 'proving'),
	processing: meta('Processing', 'accent', 'earning'),
	completed: meta('Completed', 'success', 'active'),
	failed: meta('Failed', 'error', 'slashed')
};

export const DEVICE_STATUS: Record<DeviceStatus, StatusMeta> = {
	online: meta('Online', 'success', 'active'),
	idle: meta('Idle', 'warning', 'proving'),
	offline: meta('Offline', 'neutral', 'paused'),
	faulty: meta('Faulty', 'error', 'slashed', 'Benchmark receipts did not match — the device gets no offers.'),
	banned: meta('Banned', 'error', 'slashed')
};

export function deviceStatus(s: string | null | undefined): StatusMeta {
	return DEVICE_STATUS[s as DeviceStatus] ?? meta(s ?? '—', 'neutral', 'paused');
}

export const PLATFORM_LABEL: Record<string, string> = {
	android: 'Android',
	ios: 'iOS',
	macos: 'macOS',
	windows: 'Windows',
	linux: 'Linux'
};

export const ENGINE_LABEL: Record<string, string> = {
	native: 'Native',
	pulley64: 'Pulley 64',
	pulley32: 'Pulley 32'
};

// ── per-token amounts ──

export interface TokenTotal {
	token: Token;
	amount: bigint;
}

function toBig(v: string | null | undefined): bigint {
	try {
		return v && /^\d+$/.test(v) ? BigInt(v) : 0n;
	} catch {
		return 0n;
	}
}

/** Sums `{token, amount}` entries per token address (never across tokens). Sorted by symbol. */
export function sumByToken(entries: Iterable<{ token: Token; amount: string }>): TokenTotal[] {
	const m = new Map<string, TokenTotal>();
	for (const e of entries) {
		const k = e.token.address.toLowerCase();
		const cur = m.get(k);
		if (cur) cur.amount += toBig(e.amount);
		else m.set(k, { token: e.token, amount: toBig(e.amount) });
	}
	return [...m.values()].sort((a, b) => a.token.symbol.localeCompare(b.token.symbol));
}

export function bigOf(v: string | null | undefined): bigint {
	return toBig(v);
}

/** Amount of `token` in a TokenBalance list (0n when absent). */
export function amountOf(list: TokenBalance[] | null | undefined, tokenAddress: string): bigint {
	const t = tokenAddress.toLowerCase();
	return toBig(list?.find((x) => x.token.address.toLowerCase() === t)?.amount);
}

/** Display-only float for chart heights / chart.js series. */
export function chartValue(wei: bigint, decimals: number): number {
	const base = 10n ** BigInt(decimals);
	const scaled = (wei * 10_000n) / base;
	return Number(scaled) / 10_000;
}

/** Seconds → "2d 4h" / "3h 12m" / "45s" countdown text. */
export function countdown(secs: number): string {
	if (secs <= 0) return 'now';
	const d = Math.floor(secs / 86400);
	const h = Math.floor((secs % 86400) / 3600);
	const m = Math.floor((secs % 3600) / 60);
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${secs % 60}s`;
	return `${secs}s`;
}

// ── events (openapi Event.type, dotted names) ──

export type EventTone = 'success' | 'warning' | 'error' | 'accent' | 'neutral';

export const EVENT_META: Record<string, { label: string; tone: EventTone; group: 'mining' | 'earnings' | 'security' | 'developer' | 'network' | 'account' }> = {
	'device.bound': { label: 'Device bound', tone: 'success', group: 'mining' },
	'device.unbound': { label: 'Device unbound', tone: 'neutral', group: 'mining' },
	'device.online': { label: 'Device online', tone: 'success', group: 'mining' },
	'device.offline': { label: 'Device offline', tone: 'warning', group: 'mining' },
	'subscription.created': { label: 'Subscription created', tone: 'accent', group: 'mining' },
	'subscription.active': { label: 'Subscription active', tone: 'success', group: 'mining' },
	'subscription.paused': { label: 'Subscription paused', tone: 'neutral', group: 'mining' },
	'subscription.resumed': { label: 'Subscription resumed', tone: 'success', group: 'mining' },
	'subscription.jailed': { label: 'Subscription jailed', tone: 'error', group: 'security' },
	'subscription.unbonding': { label: 'Unbonding started', tone: 'warning', group: 'mining' },
	'lease.offered': { label: 'Task offered', tone: 'neutral', group: 'mining' },
	'lease.missed': { label: 'Task missed', tone: 'warning', group: 'mining' },
	'proof.verified': { label: 'Proof verified', tone: 'success', group: 'mining' },
	'proof.rejected': { label: 'Proof rejected', tone: 'error', group: 'mining' },
	'slash.proposed': { label: 'Slash proposed', tone: 'error', group: 'security' },
	'slash.disputed': { label: 'Slash disputed', tone: 'warning', group: 'security' },
	'slash.cancelled': { label: 'Slash cancelled', tone: 'success', group: 'security' },
	'slash.executed': { label: 'Slash executed', tone: 'error', group: 'security' },
	'payout.claimable': { label: 'Rewards claimable', tone: 'accent', group: 'earnings' },
	'withdrawal.completed': { label: 'Withdrawal completed', tone: 'success', group: 'earnings' },
	'faucet.dripped': { label: 'Faucet NECTA received', tone: 'accent', group: 'earnings' },
	'developer.enrollment_approved': { label: 'Developer enrollment approved', tone: 'success', group: 'developer' },
	'developer.enrollment_rejected': { label: 'Developer enrollment rejected', tone: 'error', group: 'developer' },
	'developer.verified': { label: 'Developer verified', tone: 'success', group: 'developer' },
	'listing.approved': { label: 'Listing approved', tone: 'success', group: 'developer' },
	'listing.rejected': { label: 'Listing rejected', tone: 'error', group: 'developer' },
	'module.event': { label: 'Module event', tone: 'neutral', group: 'network' },
	'round.finalized': { label: 'Round finalized', tone: 'success', group: 'network' },
	'round.escalated': { label: 'Round escalated', tone: 'warning', group: 'network' },
	'epoch.settled': { label: 'Epoch settled', tone: 'success', group: 'earnings' },
	'project.listed': { label: 'Project listed', tone: 'success', group: 'network' },
	'project.paused': { label: 'Project paused', tone: 'warning', group: 'network' },
	'project.delisted': { label: 'Project delisted', tone: 'neutral', group: 'network' },
	'project.version_activated': { label: 'New project version', tone: 'accent', group: 'network' }
};

/** Account event types users can toggle notifications for (settings). */
export const NOTIFIABLE_EVENTS = Object.entries(EVENT_META)
	.filter(([, m]) => m.group !== 'network')
	.map(([type, m]) => ({ type, ...m }));

export function eventMeta(type: string) {
	return EVENT_META[type] ?? { label: type.replace(/[._]/g, ' '), tone: 'neutral' as EventTone, group: 'account' as const };
}

export const TONE_COLOR: Record<EventTone, string> = {
	success: 'var(--success)',
	warning: 'var(--warning)',
	error: 'var(--error)',
	accent: 'var(--text-accent)',
	neutral: 'var(--text-secondary)'
};

/** Most specific store page for an event / notification / alert. */
export function eventHref(e: { type?: string; subscription_id?: string | null; node_id?: string | null; project_id?: string | null }): string | null {
	if (e.type === 'payout.claimable' || e.type === 'withdrawal.completed') return '/withdraw';
	if (e.type === 'faucet.dripped') return '/faucet';
	if (e.subscription_id) return `/mining/${encodeURIComponent(e.subscription_id)}`;
	if (e.node_id) return '/mining/devices';
	if (e.type?.startsWith('developer.')) return '/develop';
	if (e.project_id) return `/apps/${encodeURIComponent(e.project_id)}`;
	return null;
}
