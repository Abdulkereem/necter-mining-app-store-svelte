<script lang="ts">
	import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import type { ProjectVersion } from '$lib/api/types';
	import { devProject } from '$lib/develop/context';
	import { descriptor, explorerBase } from '$lib/stores/network';
	import { formatDateTime, txUrl } from '$lib/format';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';

	const ctx = devProject();
	const q = useQuery(() => hub.versions(ctx.project.project_id));

	// PLATFORM.md §j.1 DeploymentLog: signed → registered (tx) → pending → active.
	function steps(v: ProjectVersion) {
		const order = ['submitted', 'registered', 'pending', 'active'];
		const idx = v.status === 'superseded' ? 3 : order.indexOf(v.status);
		return [
			{ label: 'Signed & submitted', at: v.submitted_at, done: true },
			{ label: v.tiers_changed.includes('consensus') ? 'Registered on-chain' : 'No transaction needed', at: v.published_at, done: idx >= 1 || !v.tiers_changed.includes('consensus'), tx: v.publish_tx },
			{ label: v.effective_epoch != null ? `Pending until epoch ${v.effective_epoch}` : 'Activation', at: null, done: idx >= 2 },
			{ label: v.status === 'superseded' ? 'Active (since superseded)' : 'Active', at: null, done: idx >= 3 }
		];
	}
</script>

{#if q.loading && !q.data}
	<LoadingBlock rows={3} height="120px" />
{:else if q.error}
	<ErrorState error={q.error} retry={q.refresh} />
{:else}
	<div class="space-y-3">
		{#each q.data?.items ?? [] as v (v.version)}
			<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5">
				<div class="flex items-center justify-between mb-3">
					<span class="text-[14px] font-semibold font-mono">v{v.version}</span>
					<span class="text-[11px] text-[var(--text-tertiary)]">{v.tiers_changed.join(' · ')}</span>
				</div>
				{#if v.status === 'rejected'}
					<p class="text-[13px] text-[var(--error)] flex items-center gap-1.5"><XCircle class="h-4 w-4" /> Rejected</p>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-4 gap-3">
						{#each steps(v) as s, i (i)}
							<div class="flex items-start gap-2">
								{#if s.done}<CheckCircle2 class="h-4 w-4 text-[var(--success)] mt-0.5" />{:else if i === 2}<Clock class="h-4 w-4 text-[var(--warning)] mt-0.5" />{:else}<Circle class="h-4 w-4 text-[var(--text-tertiary)] mt-0.5" />{/if}
								<div>
									<p class="text-[12px] {s.done ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}">{s.label}</p>
									{#if s.at}<p class="text-[10px] text-[var(--text-tertiary)]">{formatDateTime(s.at)}</p>{/if}
									{#if s.tx}<a href={txUrl(s.tx, explorerBase($descriptor))} target="_blank" rel="noopener noreferrer" class="text-[10px] text-[var(--text-accent)]">View tx</a>{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
