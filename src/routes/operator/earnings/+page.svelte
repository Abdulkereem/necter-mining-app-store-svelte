<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import type { Period } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { formatNumber, formatToken } from '$lib/format';
	import { projectRef } from '$lib/components/mining/projects.svelte';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	let period = $state<Period>('30d');
	// Rewards are paid per payout address and project, so the Hub reports per-device rows as units only.
	let groupBy = $state<'device' | 'project' | 'day'>('project');
	const q = useQuery(() => hub.earnings({ period, group_by: groupBy }), { enabled: () => $signedIn });
	const rows = $derived(q.data?.rows ?? []);

	function label(key: string | undefined) {
		if (!key) return '—';
		if (groupBy === 'project') return projectRef(key)?.name ?? key.slice(0, 12) + '…';
		return key;
	}
</script>

<svelte:head><title>Fleet earnings · Necter</title></svelte:head>

<SignInGate title="Fleet earnings" description="Sign in to see earnings per device, project and day." illustration="ecosystem">
	<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-6 pb-12">
		<a href="/operator" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4"><ArrowLeft class="h-3 w-3" /> Operator</a>
		<div class="flex flex-wrap items-end justify-between gap-3 mb-5">
			<div>
				<h1 class="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">Earnings</h1>
				<p class="text-[13px] text-[var(--text-secondary)] mt-1">Amounts are per reward token — never added across tokens.</p>
			</div>
			<div class="flex gap-2">
				<select bind:value={groupBy} class="h-[32px] px-2 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border)] text-[12px]">
					<option value="device">By device</option><option value="project">By project</option><option value="day">By day</option>
				</select>
				<select bind:value={period} class="h-[32px] px-2 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border)] text-[12px]">
					<option value="24h">24 h</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="all">All time</option>
				</select>
			</div>
		</div>

		{#if q.loading && !q.data}
			<LoadingBlock rows={4} />
		{:else if q.error}
			<ErrorState error={q.error} retry={q.refresh} />
		{:else if q.data}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
				<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
					<p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">Units</p>
					<p class="text-[22px] font-semibold font-mono">{formatNumber(q.data.units ?? 0)}</p>
				</div>
				{#each q.data.totals ?? [] as t (t.token.address)}
					<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
						<p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{t.token.symbol} earned</p>
						<p class="text-[22px] font-semibold font-mono text-[var(--text-accent)]">{formatToken(t.amount, t.token, { maxFrac: 2 })}</p>
					</div>
				{/each}
			</div>
			{#if groupBy === 'device'}
				<p class="text-[12px] text-[var(--text-tertiary)] mb-3">Rewards are paid per payout address and project, not per device; this view shows each device's verified units.</p>
			{/if}
			{#if rows.length === 0}
				<EmptyState illustration="ecosystem" title="No earnings in this period" description="Earnings appear after your devices' first finalized rounds settle in an epoch." />
			{:else}
				<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden divide-y divide-[var(--border-default)]">
					{#each rows as r (r.key)}
						<div class="flex items-center justify-between gap-3 px-4 py-3">
							<span class="text-[13px] {groupBy === 'device' ? 'font-mono' : ''} truncate">{label(r.key)}</span>
							<span class="text-[12px] text-[var(--text-tertiary)] font-mono">{formatNumber(r.units ?? 0)} units</span>
							<span class="text-[13px] font-mono text-right">{#each r.amounts ?? [] as a (a.token.address)}<span class="block">{formatToken(a.amount, a.token, { maxFrac: 4 })}</span>{:else}{#if groupBy === 'device'}<span class="text-[11px] text-[var(--text-tertiary)] font-sans">units only</span>{/if}{/each}</span>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</SignInGate>
