<script lang="ts">
	import { CheckCircle2, AlertTriangle } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { devProject } from '$lib/develop/context';
	import { formatMs, formatNumber, formatToken } from '$lib/format';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';

	const ctx = devProject();
	const q = useQuery(() => hub.health(ctx.project.project_id));
	const eco = $derived(ctx.project.economics);
</script>

{#if q.loading && !q.data}
	<LoadingBlock rows={3} height="96px" />
{:else if q.error}
	<ErrorState error={q.error} retry={q.refresh} />
{:else if q.data}
	{@const h = q.data}
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5 mb-4 flex items-center gap-3">
		{#if h.status === 'healthy'}<CheckCircle2 class="h-6 w-6 text-[var(--success)]" />{:else}<AlertTriangle class="h-6 w-6 text-[var(--warning)]" />{/if}
		<div>
			<p class="text-[16px] font-semibold capitalize">{h.status ?? 'unknown'}</p>
			<p class="text-[12px] text-[var(--text-secondary)]">{h.status === 'fallback' ? 'Rounds run on validators because there are too few eligible miners.' : h.status === 'underfunded' ? 'The vault cannot cover the next epoch — fund it to keep paying miners.' : 'Committee rounds are running normally.'}</p>
		</div>
	</div>
	<div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
		{#each [
			{ l: 'Eligible miners', v: formatNumber(h.eligible_miners) },
			{ l: 'Committee size', v: formatNumber(h.committee_size) },
			{ l: 'Median finality', v: formatMs(h.median_finality_ms) },
			{ l: 'Fallback rounds (24h)', v: formatNumber(h.fallback_rounds_24h) },
			{ l: 'Contested rounds (24h)', v: formatNumber(h.contested_rounds_24h) },
			{ l: 'Runway', v: h.runway_epochs != null ? `${h.runway_epochs} epochs` : '—' }
		] as s (s.l)}
			<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4">
				<p class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{s.l}</p>
				<p class="text-[18px] font-semibold font-mono mt-1">{s.v}</p>
			</div>
		{/each}
	</div>
	{#if eco?.vault}
		<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 mb-4 text-[12px] grid grid-cols-2 md:grid-cols-4 gap-3">
			<div><p class="text-[var(--text-tertiary)]">Vault balance</p><p class="font-mono mt-0.5">{formatToken(eco.vault.balance ?? '0', eco.token, { maxFrac: 2 })}</p></div>
			<div><p class="text-[var(--text-tertiary)]">Reserved</p><p class="font-mono mt-0.5">{formatToken(eco.vault.reserved ?? '0', eco.token, { maxFrac: 2 })}</p></div>
			<div><p class="text-[var(--text-tertiary)]">Deployed</p><p class="mt-0.5">{eco.vault.deployed ? 'Yes' : 'No'}</p></div>
			<div><p class="text-[var(--text-tertiary)]">Config matches manifest</p><p class="mt-0.5">{eco.vault.config_matches_manifest ? 'Yes' : 'No'}</p></div>
		</div>
	{/if}
	{#each h.issues ?? [] as issue}<p class="text-[13px] text-[var(--warning)] mb-1">• {issue}</p>{/each}
{/if}
