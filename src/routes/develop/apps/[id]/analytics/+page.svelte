<script lang="ts">
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import type { Period } from '$lib/api/types';
	import { devProject } from '$lib/develop/context';
	import { bpToPercent, formatMs, formatNumber, formatToken } from '$lib/format';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';

	const ctx = devProject();
	let period = $state<Period>('7d');
	const q = useQuery(() => hub.analytics(ctx.project.project_id, period));
	const series = $derived(q.data?.series ?? []);
	const labels = $derived(series.map((x) => new Date((x.t ?? 0) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })));
</script>

<div class="flex justify-end mb-4">
	<select bind:value={period} class="h-[30px] px-2 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border)] text-[12px]">
		<option value="24h">24 h</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="all">All time</option>
	</select>
</div>
{#if q.loading && !q.data}
	<LoadingBlock rows={3} height="96px" />
{:else if q.error}
	<ErrorState error={q.error} retry={q.refresh} />
{:else if q.data}
	{@const a = q.data}
	<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
		{#each [
			{ l: 'Miners active / total', v: `${formatNumber(a.miners_active)} / ${formatNumber(a.miners_total)}` },
			{ l: 'Tasks finalized', v: `${formatNumber(a.tasks_finalized)} / ${formatNumber(a.tasks_submitted)}` },
			{ l: 'Failed · fallback', v: `${formatNumber(a.tasks_failed)} · ${formatNumber(a.tasks_fallback)}` },
			{ l: 'Avg finality', v: formatMs(a.avg_finality_ms) },
			{ l: 'Avg lease', v: formatMs(a.avg_lease_ms) },
			{ l: 'Rewards distributed', v: a.rewards_distributed ? formatToken(a.rewards_distributed, ctx.project.token, { maxFrac: 2 }) : '—' },
			{ l: 'Slashing events', v: formatNumber(a.slashing_events) },
			{ l: 'Uptime', v: bpToPercent(a.uptime_bp) }
		] as s (s.l)}
			<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
				<p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{s.l}</p>
				<p class="text-[16px] font-semibold font-mono mt-1">{s.v}</p>
			</div>
		{/each}
	</div>
	{#if series.length > 1}
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			{#each [{ k: 'tasks', t: 'Tasks', c: '#FFC933' }, { k: 'miners', t: 'Active miners', c: '#4CB782' }, { k: 'units', t: 'Units', c: '#6E9FFF' }] as ch (ch.k)}
				<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
					<p class="text-[13px] font-semibold mb-2">{ch.t}</p>
					{#key series}<AreaChart data={series.map((x) => Number((x as Record<string, number | undefined>)[ch.k] ?? 0))} {labels} color={ch.c} height={150} />{/key}
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-[13px] text-[var(--text-secondary)]">Charts appear once the project has activity.</p>
	{/if}
{/if}
