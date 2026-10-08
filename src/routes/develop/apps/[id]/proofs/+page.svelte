<script lang="ts">
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { devProject } from '$lib/develop/context';
	import { formatNumber, shortHex, timeAgo } from '$lib/format';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';

	const ctx = devProject();
	const q = useQuery(() => hub.proofMonitoring(ctx.project.project_id, { limit: 100 }), { pollMs: 30_000 });
	const color: Record<string, string> = { finalized: 'var(--success)', committee_agreed: 'var(--info)', pending: 'var(--text-secondary)', escalated: 'var(--warning)', fallback: 'var(--warning)', failed: 'var(--error)' };
</script>

{#if q.loading && !q.data}
	<LoadingBlock rows={6} height="44px" />
{:else if q.error}
	<ErrorState error={q.error} retry={q.refresh} />
{:else if (q.data?.items?.length ?? 0) === 0}
	<EmptyState illustration="network" title="No rounds yet" description="Rounds appear when tasks are submitted to your project (API key or schedule)." />
{:else}
	<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden">
		<div class="hidden md:grid px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--text-tertiary)] border-b border-[var(--border-default)]" style="grid-template-columns:1fr 110px 90px 90px 80px 90px;gap:12px">
			<span>Round</span><span>State</span><span class="text-right">Votes</span><span class="text-right">Gas</span><span class="text-right">Audited</span><span class="text-right">When</span>
		</div>
		{#each q.data?.items ?? [] as r (r.round_id)}
			<a href="/explorer/rounds/{encodeURIComponent(r.round_id)}" class="flex md:grid items-center px-4 py-2.5 border-b border-[var(--border-default)] gap-3 text-[12px] no-underline text-[var(--text-primary)] hover:bg-[var(--surface-2)]" style="grid-template-columns:1fr 110px 90px 90px 80px 90px">
				<span class="font-mono truncate">{shortHex(r.round_id, 14, 6)} <span class="text-[var(--text-tertiary)]">· {r.function ?? ''} #{r.seq ?? ''}</span></span>
				<span style="color:{color[r.state]}">{r.state.replace('_', ' ')}</span>
				<span class="text-right font-mono">{r.agreeing ?? '—'}/{r.committee_size ?? '—'}</span>
				<span class="hidden md:block text-right font-mono">{formatNumber(r.gas_used)}</span>
				<span class="hidden md:block text-right">{r.audited ? 'Yes' : '—'}</span>
				<span class="text-right text-[var(--text-tertiary)]">{timeAgo(r.created_at)}</span>
			</a>
		{/each}
	</div>
{/if}
