<script lang="ts">
	/**
	 * Shows a subscription's payout address and lets the owner change it gaslessly (PLATFORM.md errata E10:
	 * POST /v1/subscriptions/{id}/payout returns an EIP-712 SetPayout, the wallet signs it, the Hub relays it).
	 */
	import toast from 'svelte-french-toast';
	import { Loader2, Pencil } from 'lucide-svelte';
	import type { Subscription } from '$lib/api/types';
	import { errorMessage } from '$lib/api/http';
	import { changePayout } from '$lib/flows';
	import { shortAddress } from '$lib/format';

	let {
		sub,
		canEdit = false,
		onchanged
	}: {
		sub: Subscription;
		canEdit?: boolean;
		onchanged?: (payout: string) => void | Promise<void>;
	} = $props();

	let current = $derived((sub.payout_address ?? sub.owner).toLowerCase());
	let editing = $state(false);
	let value = $state('');
	let busy = $state(false);
	let progress = $state('');
	let pendingTo = $state<string | null>(null);

	let input = $derived(value.trim().toLowerCase());
	let valid = $derived(/^0x[0-9a-f]{40}$/.test(input) && !/^0x0{40}$/.test(input) && input !== current);
	let editable = $derived(canEdit && sub.status !== 'closed');

	async function submit() {
		if (!valid || busy) return;
		busy = true;
		try {
			const tx = await changePayout(sub, input, (l) => (progress = l));
			pendingTo = tx.status === 'confirmed' ? null : input;
			toast.success(tx.status === 'confirmed' ? 'Payout address changed' : 'Payout change submitted; it applies once the transaction confirms');
			editing = false;
			value = '';
			await onchanged?.(input);
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			busy = false;
			progress = '';
		}
	}
</script>

<div data-testid="payout-address">
	<p class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium">Payout address</p>
	<div class="flex items-center gap-2">
		<p class="font-mono text-[12px] text-[var(--text-primary)]" title={current}>{shortAddress(current)}</p>
		{#if editable && !editing}
			<button
				type="button"
				class="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-accent)] bg-transparent border-none cursor-pointer p-0"
				data-testid="payout-edit"
				onclick={() => (editing = true)}
			>
				<Pencil size={11} strokeWidth={1.5} /> Change
			</button>
		{/if}
	</div>
	{#if pendingTo && pendingTo !== current}
		<p class="text-[11px] text-[var(--warning)] mt-1">Changing to {shortAddress(pendingTo)} — waiting for the transaction.</p>
	{/if}
	{#if editing}
		<form
			class="mt-2 flex flex-col gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
		>
			<input
				type="text"
				bind:value
				placeholder="0x… new payout address"
				spellcheck="false"
				autocomplete="off"
				data-testid="payout-input"
				class="h-8 px-2 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border-default)] text-[12px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--border-accent)]"
			/>
			<p class="text-[11px] text-[var(--text-tertiary)] leading-[15px]">
				Rewards of epochs that settle after the change go to the new address. You sign a typed message (free); the network relays the change, no ETH needed.
			</p>
			{#if value && !valid}
				<p class="text-[11px] text-[var(--error)]">{input === current ? 'That is the current payout address.' : 'Enter a 0x… address (40 hex characters, not the zero address).'}</p>
			{/if}
			<div class="flex gap-2">
				<button type="submit" class="btn-subscribe" disabled={!valid || busy} data-testid="payout-submit">
					{#if busy}<Loader2 class="h-3.5 w-3.5 animate-spin" />{progress || 'Working'}…{:else}Sign & change{/if}
				</button>
				<button type="button" class="btn-secondary" disabled={busy} onclick={() => { editing = false; value = ''; }}>Cancel</button>
			</div>
		</form>
	{/if}
</div>
