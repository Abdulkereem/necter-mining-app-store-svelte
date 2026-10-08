<script lang="ts">
	import { page } from '$app/state';
	import { CheckCircle2, Clock, AlertCircle, ArrowLeft, XCircle } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { formatDateTime, formatMs, formatToken, formatNumber } from '$lib/format';
	import { proofStatus, REJECTION_REASON } from '$lib/components/mining/labels';
	import { projectRef } from '$lib/components/mining/projects.svelte';
	import CopyText from '$lib/components/common/CopyText.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	const id = $derived((page.params.id ?? '').toLowerCase());
	const q = useQuery(() => hub.proof(id));
	const ref = $derived(q.data ? projectRef(q.data.project_id) : null);
</script>

<svelte:head><title>Proof · Necter</title></svelte:head>

{#snippet row(label: string, value: string | null | undefined, mono = true)}
	<div class="flex items-center justify-between gap-3 p-3 bg-[var(--surface-0)] rounded-[5px]">
		<span class="text-[13px] text-[var(--text-secondary)]">{label}</span>
		<span class="text-[12px] text-[var(--text-primary)] text-right {mono ? 'font-mono' : ''}">{value ?? '—'}</span>
	</div>
{/snippet}

<div class="min-h-screen bg-[var(--surface-0)] px-4 md:px-6 pt-4 md:pt-6 pb-12">
	<div style="max-width:720px;margin:0 auto">
		<a href="/mining" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] no-underline mb-4">
			<ArrowLeft class="h-3 w-3" strokeWidth={1.5} /> Back to My Mining
		</a>

		{#if q.loading}
			<LoadingBlock rows={4} height="64px" />
		{:else if q.error}
			<ErrorState error={q.error} retry={q.refresh} />
		{:else if !q.data}
			<EmptyState illustration="network" title="Proof not found" description="Proofs appear once your miner has voted in a round. The id may be wrong or the round is still being indexed." />
		{:else}
			{@const p = q.data}
			{@const st = proofStatus(p.status)}
			<div class="flex items-center gap-3 mb-2">
				{#if p.status === 'verified'}<CheckCircle2 class="h-7 w-7" style="color:{st.color}" />
				{:else if p.status === 'rejected'}<XCircle class="h-7 w-7" style="color:{st.color}" />
				{:else if p.status === 'missed'}<AlertCircle class="h-7 w-7" style="color:{st.color}" />
				{:else}<Clock class="h-7 w-7" style="color:{st.color}" />{/if}
				<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">{st.label}</h1>
			</div>
			<div class="text-[12px] text-[var(--text-tertiary)] mb-5"><CopyText value={p.proof_id} short={false} /></div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
				<div class="md:col-span-2 space-y-6">
					<div class="p-4 md:p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
						<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Vote and outcome</h2>
						<div class="space-y-2">
							{@render row('Submitted', formatDateTime(p.submitted_at))}
							{@render row('Finalized', p.verified_at ? formatDateTime(p.verified_at) : null)}
							{@render row('Time to finality', p.finality_ms != null ? formatMs(p.finality_ms) : null)}
							{@render row('Epoch', p.epoch != null ? String(p.epoch) : null)}
							{@render row('Audited by validators', p.audited ? 'Yes' : 'No', false)}
							{#if p.rejection_reason}
								<div class="p-3 bg-[rgba(235,87,87,0.08)] border border-[rgba(235,87,87,0.20)] rounded-[5px]">
									<p class="text-[12px] font-medium text-[var(--error)] mb-1">Why it did not count</p>
									<p class="text-[13px] text-[var(--text-primary)]">{REJECTION_REASON[p.rejection_reason] ?? p.rejection_reason}</p>
								</div>
							{/if}
						</div>
					</div>

					<div class="p-4 md:p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
						<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Receipts</h2>
						<div class="space-y-3">
							<div>
								<p class="text-[12px] text-[var(--text-secondary)] mb-1">Your receipt hash</p>
								{#if p.receipt_hash}<a href="/explorer/receipts/{p.receipt_hash}" class="font-mono text-[12px] break-all text-[var(--text-primary)]">{p.receipt_hash}</a>{:else}<span class="text-[12px] text-[var(--text-tertiary)]">No vote recorded</span>{/if}
							</div>
							<div>
								<p class="text-[12px] text-[var(--text-secondary)] mb-1">Final receipt hash</p>
								{#if p.final_receipt_hash}<span class="font-mono text-[12px] break-all">{p.final_receipt_hash}</span>
									{#if p.receipt_hash && p.receipt_hash !== p.final_receipt_hash}<p class="text-[11px] text-[var(--error)] mt-1">Your result differs from the finalized one.</p>{/if}
								{:else}<span class="text-[12px] text-[var(--text-tertiary)]">Not final yet</span>{/if}
							</div>
							<div>
								<p class="text-[12px] text-[var(--text-secondary)] mb-1">Round</p>
								<a href="/explorer/rounds/{encodeURIComponent(p.round_id)}" class="font-mono text-[12px] break-all text-[var(--text-accent)]">{p.round_id}</a>
							</div>
						</div>
					</div>

					{#if p.finality_validators?.length}
						<div class="p-4 md:p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
							<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-3">Finalized by validators</h2>
							<div class="flex flex-wrap gap-2">
								{#each p.finality_validators as v (v)}<span class="font-mono text-[11px] px-2 py-1 rounded-[4px] bg-[var(--surface-2)]">{v}</span>{/each}
							</div>
						</div>
					{/if}
				</div>

				<div class="space-y-4">
					<div class="p-4 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
						<p class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">Project</p>
						<a href="/apps/{p.project_id}" class="text-[13px] font-medium text-[var(--text-primary)]">{ref?.name ?? p.project_id.slice(0, 12) + '…'}</a>
						<p class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mt-3">Device</p>
						<a href="/miners/{p.node_id}" class="text-[12px] font-mono text-[var(--text-primary)]">{p.node_id}</a>
						{#if p.subscription_id}
							<p class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mt-3">Subscription</p>
							<a href="/mining/{p.subscription_id}" class="text-[12px] font-mono text-[var(--text-accent)]">Open →</a>
						{/if}
					</div>
					<div class="p-4 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
						<p class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">Units</p>
						<p class="text-[18px] font-semibold font-mono">{formatNumber(p.units ?? 0)}</p>
						<p class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mt-3">Expected reward</p>
						<p class="text-[15px] font-semibold font-mono text-[var(--text-accent)]">{p.expected_amount ? formatToken(p.expected_amount, ref?.token ?? null, { maxFrac: 4 }) : '—'}</p>
						<p class="text-[10px] text-[var(--text-tertiary)] mt-1">Paid when the epoch settles.</p>
					</div>
					{#if p.slash_id}
						<a href="/mining/{p.subscription_id ?? ''}" class="block p-4 rounded-[8px] border border-[rgba(235,87,87,0.25)] bg-[rgba(235,87,87,0.06)] text-[12px] text-[var(--error)] no-underline">A slash was proposed for this round — review or dispute it on the subscription page.</a>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
