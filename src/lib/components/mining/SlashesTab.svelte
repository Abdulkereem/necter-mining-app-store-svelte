<script lang="ts">
	import { CheckCircle2, ShieldAlert } from 'lucide-svelte';
	import toast from 'svelte-french-toast';
	import { Modal, Textarea } from '$lib/components/ui';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { hub } from '$lib/api/hub';
	import { errorMessage } from '$lib/api/http';
	import { useQuery } from '$lib/api/query.svelte';
	import type { Slash } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { descriptor, explorerBase } from '$lib/stores/network';
	import { formatAmount, formatDateTime, bpToPercent, shortHex, txUrl } from '$lib/format';
	import { SLASH_KIND, countdown, slashStatus } from './labels';

	let { subscriptionId, now, canAct, onChanged }: { subscriptionId: string; now: number; canAct: boolean; onChanged: () => void } = $props();

	const slashes = useQuery(() => hub.mySlashes({ limit: 200 }), { enabled: () => $signedIn });
	let items = $derived((slashes.data?.items ?? []).filter((s) => s.subscription_id === subscriptionId).sort((a, b) => b.created_at - a.created_at));

	let target = $state<Slash | null>(null);
	let open = $state(false);
	let reason = $state('');
	let links = $state('');
	let sending = $state(false);

	function canDispute(s: Slash) {
		return s.status === 'proposed' && !s.dispute && !!s.executable_at && s.executable_at > now;
	}

	function start(s: Slash) {
		target = s;
		reason = '';
		links = '';
		open = true;
	}

	async function submit() {
		if (!target) return;
		const r = reason.trim();
		if (r.length < 10) {
			toast.error('Describe why the slash is wrong (at least 10 characters).');
			return;
		}
		const urls = links
			.split(/\s+/)
			.map((x) => x.trim())
			.filter(Boolean)
			.slice(0, 5);
		if (urls.some((u) => !/^https?:\/\//.test(u))) {
			toast.error('Links must start with http:// or https://');
			return;
		}
		sending = true;
		try {
			const updated = await hub.disputeSlash(target.evidence_hash, r, urls);
			toast.success('Dispute filed — the operator reviews it before the slash can execute.');
			slashes.set({ ...(slashes.data ?? { items: [], next_cursor: null }), items: (slashes.data?.items ?? []).map((x) => (x.evidence_hash === updated.evidence_hash ? updated : x)) });
			open = false;
			onChanged();
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			sending = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
		<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-1">Slashing</h4>
		<p class="text-[13px] text-[var(--text-secondary)] mb-4">
			Slashes are proposed with signed evidence, then wait a dispute window before anyone can execute them. You can dispute a proposed slash until it becomes
			executable.
		</p>
		{#if slashes.loading && !slashes.data}
			<LoadingBlock rows={2} height="64px" />
		{:else if slashes.error}
			<ErrorState error={slashes.error} retry={slashes.refresh} compact />
		{:else if items.length === 0}
			<div class="py-8 flex flex-col items-center gap-2 rounded-[8px] border border-[var(--border)] border-dashed bg-[var(--surface-2)] text-[13px] text-[var(--text-secondary)]">
				<CheckCircle2 class="h-6 w-6 text-[var(--success)]" strokeWidth={1.5} />
				No slashes against this subscription.
			</div>
		{:else}
			<div class="space-y-2">
				{#each items as s (s.evidence_hash)}
					{@const st = slashStatus(s.status)}
					<div class="p-4 rounded-[8px] border border-[rgba(235,87,87,0.30)] bg-[rgba(235,87,87,0.05)]">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<ShieldAlert class="h-4 w-4 text-[var(--error)]" />
									<p class="text-[13px] font-medium text-[var(--text-primary)]">{SLASH_KIND[s.kind] ?? s.kind}</p>
									<span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)]" style="color: {st.color};">{st.label}</span>
								</div>
								<p class="text-[11px] text-[var(--text-tertiary)] mt-1">
									{formatDateTime(s.created_at)} · evidence <span class="font-mono">{shortHex(s.evidence_hash)}</span>
									{#if s.round_id} · round <a href="/explorer/rounds/{encodeURIComponent(s.round_id)}" class="font-mono text-[var(--text-accent)] no-underline">{shortHex(s.round_id.split(':')[1] ?? s.round_id)}</a>{/if}
									{#if s.propose_tx} · <a href={txUrl(s.propose_tx, explorerBase($descriptor))} target="_blank" rel="noopener noreferrer" class="text-[var(--text-accent)] no-underline">proposal tx ↗</a>{/if}
								</p>
								{#if s.status === 'proposed' && s.executable_at}
									<p class="text-[11px] text-[var(--text-secondary)] mt-1">
										{s.executable_at > now ? `Executable in ${countdown(s.executable_at - now)}` : 'Dispute window closed'}
									</p>
								{/if}
								{#if s.dispute}
									<p class="text-[11px] text-[var(--text-secondary)] mt-1">
										Dispute filed {formatDateTime(s.dispute.filed_at)}{s.dispute.outcome ? ` — ${s.dispute.outcome === 'cancelled' ? 'slash cancelled' : 'slash upheld'}` : ' — awaiting decision'}
									</p>
								{/if}
								{#if s.recovery}
									<p class="text-[11px] text-[var(--text-secondary)] mt-1">Recovery: {s.recovery}</p>
								{/if}
							</div>
							<div class="text-right shrink-0">
								<p class="text-[13px] font-semibold text-[var(--error)] font-mono">{s.amount ? `-${formatAmount(s.amount, 18)} NECTA` : '—'}</p>
								{#if s.bp !== undefined}<p class="text-[11px] text-[var(--text-tertiary)]">{bpToPercent(s.bp)} of bond</p>{/if}
								{#if canDispute(s)}
									<button type="button" class="btn-secondary mt-2" disabled={!canAct} onclick={() => start(s)}>Dispute</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<Modal bind:open maxWidth="480px">
	<div class="p-5">
		<h3 class="text-[15px] font-semibold text-[var(--text-primary)] mb-1">Dispute slash</h3>
		<p class="text-[12px] text-[var(--text-secondary)] mb-4">
			On testnet the network operator reviews disputes and can cancel the slash. File it before
			{target?.executable_at ? formatDateTime(target.executable_at) : 'the dispute window closes'}.
		</p>
		<label for="dispute-reason" class="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5">Reason</label>
		<Textarea id="dispute-reason" bind:value={reason} rows={5} placeholder="Explain why the evidence is wrong…" class="mb-3" />
		<label for="dispute-links" class="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5">Links (optional, up to 5)</label>
		<Textarea id="dispute-links" bind:value={links} rows={2} placeholder="https://…" class="mb-4" />
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-secondary" onclick={() => (open = false)} disabled={sending}>Cancel</button>
			<button type="button" class="btn-subscribe" onclick={submit} disabled={sending}>{sending ? 'Filing…' : 'File dispute'}</button>
		</div>
	</div>
</Modal>
