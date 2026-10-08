<script lang="ts">
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { devProject } from '$lib/develop/context';
	import { DEVICE_CLASS_LABEL, bpToPercent, formatNumber, shortAddress, timeAgo } from '$lib/format';
	import { deviceStatus } from '$lib/components/mining/labels';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';

	const ctx = devProject();
	const q = useQuery(() => hub.projectMiners(ctx.project.project_id, { period: '7d', limit: 200 }));
</script>

{#if q.loading && !q.data}
	<LoadingBlock rows={5} />
{:else if q.error}
	<ErrorState error={q.error} retry={q.refresh} />
{:else if (q.data?.items?.length ?? 0) === 0}
	<EmptyState illustration="compute" title="No miners yet" description="Miners appear here once devices subscribe to your project with collateral." />
{:else}
	<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden">
		<div class="hidden md:grid px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--text-tertiary)] border-b border-[var(--border-default)]" style="grid-template-columns:1fr 110px 80px 80px 90px 90px 90px;gap:12px">
			<span>Device</span><span>Owner</span><span>Class</span><span>Status</span><span class="text-right">Units 7d</span><span class="text-right">Reputation</span><span class="text-right">Uptime</span>
		</div>
		{#each q.data?.items ?? [] as m (m.node_id)}
			{@const st = deviceStatus(m.status)}
			<div class="flex md:grid items-center px-4 py-2.5 border-b border-[var(--border-default)] gap-3 text-[12px]" style="grid-template-columns:1fr 110px 80px 80px 90px 90px 90px">
				<a href="/miners/{m.node_id}" class="font-mono truncate text-[var(--text-primary)] no-underline">{m.node_id}<span class="block text-[10px] text-[var(--text-tertiary)]">since {timeAgo(m.since)}</span></a>
				<a href="/profiles/{m.owner}" class="hidden md:block font-mono text-[var(--text-secondary)] no-underline">{shortAddress(m.owner)}</a>
				<span class="hidden md:block">{DEVICE_CLASS_LABEL[m.class]}</span>
				<span style="color:{st.color}">{st.label}</span>
				<span class="text-right font-mono">{formatNumber(m.units)}</span>
				<span class="hidden md:block text-right font-mono">{bpToPercent(m.reputation)}</span>
				<span class="hidden md:block text-right font-mono">{bpToPercent(m.uptime_bp)}</span>
			</div>
		{/each}
	</div>
{/if}
