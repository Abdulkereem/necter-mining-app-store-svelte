<script lang="ts">
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import type { Period } from '$lib/api/types';
	import { devProject } from '$lib/develop/context';
	import { descriptor, explorerBase } from '$lib/stores/network';
	import { formatNumber, formatToken, formatDateTime, txUrl } from '$lib/format';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';

	const ctx = devProject();
	let period = $state<Period>('30d');
	const q = useQuery(() => hub.revenue(ctx.project.project_id, period));
	const token = $derived(ctx.project.token);
</script>

<div class="flex justify-end mb-4">
	<select bind:value={period} class="h-[30px] px-2 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border)] text-[12px]">
		<option value="7d">7 days</option><option value="30d">30 days</option><option value="all">All time</option>
	</select>
</div>
{#if q.loading && !q.data}
	<LoadingBlock rows={4} />
{:else if q.error}
	<ErrorState error={q.error} retry={q.refresh} />
{:else if q.data}
	{@const t = q.data.totals}
	<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
		{#each [
			{ l: 'Units', v: formatNumber(t?.units ?? 0) },
			{ l: 'Gross', v: formatToken(t?.gross ?? '0', token, { maxFrac: 2 }) },
			{ l: 'Miners', v: formatToken(t?.miner ?? '0', token, { maxFrac: 2 }) },
			{ l: 'You (developer)', v: formatToken(t?.developer ?? '0', token, { maxFrac: 2 }) },
			{ l: 'Treasury', v: formatToken(t?.treasury ?? '0', token, { maxFrac: 2 }) }
		] as s (s.l)}
			<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
				<p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{s.l}</p>
				<p class="text-[15px] font-semibold font-mono mt-1">{s.v}</p>
			</div>
		{/each}
	</div>
	{#if (q.data.items?.length ?? 0) === 0}
		<EmptyState illustration="ecosystem" title="No settled epochs yet" description="Revenue is reported per project epoch once validators attest and the vault settles it." />
	{:else}
		<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-x-auto">
			<table class="w-full text-[12px]">
				<thead><tr class="text-[10px] uppercase tracking-[0.03em] text-[var(--text-tertiary)] text-left border-b border-[var(--border-default)]"><th class="px-4 py-2">Epoch</th><th class="px-2">Status</th><th class="px-2 text-right">Units</th><th class="px-2 text-right">Gross</th><th class="px-2 text-right">Miners</th><th class="px-2 text-right">Developer</th><th class="px-4 text-right">Settlement</th></tr></thead>
				<tbody>
					{#each q.data.items ?? [] as e (e.epoch)}
						<tr class="border-b border-[var(--border-default)]">
							<td class="px-4 py-2 font-mono"><a href="/explorer/epochs/{e.project_id}/{e.epoch}" class="text-[var(--text-primary)]">{e.epoch}</a><span class="block text-[10px] text-[var(--text-tertiary)]">{formatDateTime(e.starts_at)}</span></td>
							<td class="px-2 capitalize">{e.status}</td>
							<td class="px-2 text-right font-mono">{formatNumber(e.totals?.units ?? 0)}</td>
							<td class="px-2 text-right font-mono">{formatToken(e.totals?.gross ?? '0', e.token ?? token, { maxFrac: 2 })}</td>
							<td class="px-2 text-right font-mono">{formatToken(e.totals?.miner ?? '0', e.token ?? token, { maxFrac: 2 })}</td>
							<td class="px-2 text-right font-mono">{formatToken(e.totals?.developer ?? '0', e.token ?? token, { maxFrac: 2 })}</td>
							<td class="px-4 text-right">{#if e.settlement?.tx_hash}<a href={txUrl(e.settlement.tx_hash, explorerBase($descriptor))} target="_blank" rel="noopener noreferrer" class="text-[var(--text-accent)]">{e.settlement.status}</a>{:else}—{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}
