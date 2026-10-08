<script lang="ts">
	import { CheckCircle2, AlertTriangle, ShieldAlert, Clock } from 'lucide-svelte';
	import type { Device, Subscription } from '$lib/api/types';
	import { formatAmount, formatNumber, bpToPercent, timeAgo, formatDateTime, shortAddress, DEVICE_CLASS_LABEL } from '$lib/format';
	import { countdown, deviceStatus, ENGINE_LABEL, PLATFORM_LABEL, subStatus } from './labels';

	let {
		sub,
		device,
		now
	}: {
		sub: Subscription;
		device: Device | null | undefined;
		now: number;
	} = $props();

	let st = $derived(subStatus(sub.status));
	let ds = $derived(device ? deviceStatus(device.status) : null);

	const HEALTH: Record<string, { label: string; color: string }> = {
		healthy: { label: 'Healthy', color: 'var(--success)' },
		warning: { label: 'Near minimum', color: 'var(--warning)' },
		critical: { label: 'Below minimum', color: 'var(--error)' }
	};
	let health = $derived(sub.collateral_health ? HEALTH[sub.collateral_health] : null);

	let ratio = $derived.by(() => {
		if (!sub.min_collateral || !/^\d+$/.test(sub.min_collateral) || !/^\d+$/.test(sub.collateral)) return null;
		const min = BigInt(sub.min_collateral);
		if (min === 0n) return null;
		const pct = Number((BigInt(sub.collateral) * 1000n) / min) / 10;
		return pct;
	});

	let releaseIn = $derived(sub.release_at ? sub.release_at - now : null);
</script>

<div class="space-y-6">
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<!-- Node & project -->
		<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
			<h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Node & project</h3>
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Subscription</p>
					<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[var(--surface-2)]" style="color: {st.color};">
						<span class="status-dot status-dot-{st.dot}" style="width:6px;height:6px"></span>{st.label}
					</span>
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Device</p>
					{#if ds}
						<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[var(--surface-2)]" style="color: {ds.color};">
							<span class="status-dot status-dot-{ds.dot}" style="width:6px;height:6px"></span>{ds.label}
						</span>
					{:else}
						<span class="text-[12px] text-[var(--text-tertiary)]">—</span>
					{/if}
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Last seen</p>
					<p class="font-mono text-[12px] text-[var(--text-primary)]">{device?.status === 'online' ? 'Now' : timeAgo(device?.last_seen_at)}</p>
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Device name</p>
					<p class="text-[12px] text-[var(--text-primary)] truncate">{device?.label || '—'}</p>
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Class</p>
					<p class="text-[12px] text-[var(--text-primary)]">
						{device?.class ? DEVICE_CLASS_LABEL[device.class] : '—'}{device?.platform ? ` · ${PLATFORM_LABEL[device.platform] ?? device.platform}` : ''}
					</p>
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Engine</p>
					<p class="font-mono text-[12px] text-[var(--text-primary)]">{device?.engine ? ENGINE_LABEL[device.engine] ?? device.engine : '—'}</p>
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Miner version</p>
					<p class="font-mono text-[12px] text-[var(--text-primary)]">{device?.miner_version ?? '—'}</p>
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Compute units</p>
					<p class="font-mono text-[12px] text-[var(--text-primary)]">{formatNumber(sub.units_total)}</p>
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Last proof</p>
					<p class="font-mono text-[12px] text-[var(--text-primary)]">{sub.last_proof_at ? timeAgo(sub.last_proof_at) : '—'}</p>
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Mining since</p>
					<p class="text-[12px] text-[var(--text-primary)]">{sub.started_at ? formatDateTime(sub.started_at) : '—'}</p>
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Payout address</p>
					<p class="font-mono text-[12px] text-[var(--text-primary)]" title={sub.payout_address ?? sub.owner}>{shortAddress(sub.payout_address ?? sub.owner)}</p>
				</div>
				<div>
					<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Reward token</p>
					<p class="text-[13px] font-semibold text-[var(--text-primary)]">{sub.token?.symbol ?? '—'}</p>
				</div>
				<div class="col-span-2 md:col-span-3">
					<div class="flex justify-between text-[var(--text-tertiary)] text-[11px] mb-1">
						<span>Reputation (affects committee selection)</span>
						<span class="font-mono">{bpToPercent(sub.reputation)}</span>
					</div>
					<div class="w-full bg-[var(--surface-2)] rounded-full h-1.5">
						<div class="bg-[var(--accent)] h-1.5 rounded-full transition-all" style:width="{Math.min(100, (sub.reputation ?? 0) / 100)}%"></div>
					</div>
				</div>
				<div class="col-span-2 md:col-span-3">
					<div class="flex justify-between text-[var(--text-tertiary)] text-[11px] mb-1">
						<span>Uptime</span>
						<span class="font-mono">{bpToPercent(sub.uptime_bp)}</span>
					</div>
					<div class="w-full bg-[var(--surface-2)] rounded-full h-1.5">
						<div class="bg-[var(--success)] h-1.5 rounded-full transition-all" style:width="{Math.min(100, (sub.uptime_bp ?? 0) / 100)}%"></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Collateral -->
		<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
			<h3 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Collateral</h3>
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<span class="text-[13px] text-[var(--text-secondary)]">Bonded</span>
					<span class="text-[13px] font-semibold text-[var(--text-primary)] font-mono">{formatAmount(sub.collateral, 18)} NECTA</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-[13px] text-[var(--text-secondary)]">Project minimum</span>
					<span class="text-[13px] font-semibold text-[var(--text-primary)] font-mono">{sub.min_collateral ? `${formatAmount(sub.min_collateral, 18)} NECTA` : '—'}</span>
				</div>
				{#if ratio !== null}
					<div>
						<div class="w-full bg-[var(--surface-2)] rounded-full h-1.5">
							<div class="h-1.5 rounded-full transition-all" style="width: {Math.min(100, ratio / 2)}%; background: {health?.color ?? 'var(--accent)'};"></div>
						</div>
						<p class="text-[11px] text-[var(--text-tertiary)] mt-1 font-mono">{ratio.toFixed(1)}% of minimum</p>
					</div>
				{/if}
				<div class="flex items-center justify-between">
					<span class="text-[13px] text-[var(--text-secondary)]">Health</span>
					<span class="inline-flex items-center gap-1 text-[12px]" style="color: {health?.color ?? 'var(--text-tertiary)'};">
						{#if sub.collateral_health === 'healthy'}<CheckCircle2 class="h-3.5 w-3.5" />{:else if health}<AlertTriangle class="h-3.5 w-3.5" />{/if}
						{health?.label ?? '—'}
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-[13px] text-[var(--text-secondary)]">Slashed to date</span>
					<span class="text-[13px] font-mono {sub.slashed_total && sub.slashed_total !== '0' ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}">
						{sub.slashed_total ? `${formatAmount(sub.slashed_total, 18)} NECTA` : '0 NECTA'}
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-[13px] text-[var(--text-secondary)]">Pending slashes</span>
					<span class="inline-flex items-center gap-1 text-[13px] font-mono" style="color: {(sub.pending_slashes ?? 0) > 0 ? 'var(--error)' : 'var(--text-primary)'};">
						{#if (sub.pending_slashes ?? 0) > 0}<ShieldAlert class="h-3.5 w-3.5" />{/if}{sub.pending_slashes ?? 0}
					</span>
				</div>
				{#if sub.release_at}
					<div class="mt-2 p-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]">
						<div class="flex items-center gap-2 mb-1">
							<Clock class="h-4 w-4 text-[var(--text-accent)]" />
							<span class="text-[13px] font-semibold text-[var(--text-primary)]">
								{releaseIn !== null && releaseIn > 0 ? `Released in ${countdown(releaseIn)}` : 'Released'}
							</span>
						</div>
						<p class="text-[11px] text-[var(--text-tertiary)]">
							Release time {formatDateTime(sub.release_at)}.{(sub.pending_slashes ?? 0) > 0
								? ' Withdrawal waits until pending slashes finish their dispute window.'
								: ''}
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
