<script lang="ts">
	/** Shows a chain transaction the Hub prepared (`TxRequest`) and lets the developer send it from the wallet. */
	import { Send, ExternalLink, Fuel } from 'lucide-svelte';
	import toast from 'svelte-french-toast';
	import type { TxRequest } from '$lib/api/types';
	import { errorMessage } from '$lib/api/http';
	import { sendTransaction } from '$lib/stores/wallet';
	import { descriptor, explorerBase } from '$lib/stores/network';
	import { addressUrl, shortHex, txUrl } from '$lib/format';
	import CopyText from '$lib/components/common/CopyText.svelte';

	let {
		tx,
		title = 'Transaction to send',
		onsent
	}: {
		tx: TxRequest;
		title?: string;
		onsent?: (hash: string) => void | Promise<void>;
	} = $props();

	let sending = $state(false);
	let hash = $state<string | null>(null);

	async function send() {
		sending = true;
		try {
			hash = await sendTransaction(tx);
			toast.success('Transaction sent');
			await onsent?.(hash);
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			sending = false;
		}
	}
</script>

<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-0)] p-4">
	<div class="flex items-center justify-between gap-3 mb-3">
		<span class="text-[12px] font-semibold text-[var(--text-primary)]">{title}</span>
		<span class="inline-flex items-center gap-1 text-[11px] text-[var(--warning)]">
			<Fuel size={12} strokeWidth={1.5} /> Needs Sepolia ETH for gas
		</span>
	</div>
	{#if tx.description}
		<p class="text-[12px] text-[var(--text-secondary)] mb-3 font-mono">{tx.description}</p>
	{/if}
	<div class="grid grid-cols-[90px_1fr] gap-y-1.5 text-[11px] mb-3">
		<span class="text-[var(--text-tertiary)]">Chain</span>
		<span class="font-mono text-[var(--text-primary)]">{tx.chain_id}</span>
		<span class="text-[var(--text-tertiary)]">To</span>
		<span class="flex items-center gap-1.5">
			<CopyText value={tx.to} />
			<a href={addressUrl(tx.to, explorerBase($descriptor))} target="_blank" rel="noopener" class="text-[var(--text-tertiary)] hover:text-[var(--text-accent)]" aria-label="Open in explorer"><ExternalLink size={11} strokeWidth={1.5} /></a>
		</span>
		{#if tx.value && tx.value !== '0'}
			<span class="text-[var(--text-tertiary)]">Value</span>
			<span class="font-mono text-[var(--text-primary)]">{tx.value} wei</span>
		{/if}
		<span class="text-[var(--text-tertiary)]">Data</span>
		<span class="min-w-0"><CopyText value={tx.data} /></span>
	</div>
	{#if hash}
		<a href={txUrl(hash, explorerBase($descriptor))} target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-accent)] no-underline">
			<ExternalLink size={12} strokeWidth={1.5} /> {shortHex(hash, 10, 6)}
		</a>
	{:else}
		<button type="button" class="btn-subscribe" disabled={sending} onclick={send}>
			<Send size={12} strokeWidth={1.5} />
			{sending ? 'Confirm in your wallet…' : 'Send from wallet'}
		</button>
	{/if}
</div>
