<script lang="ts">
	/**
	 * Settings → Wallet in local mode: the miner's embedded wallet address and a local-only private key export.
	 * Export needs a fresh confirmation each time, shows the key for 60 s and is never offered to remote dashboard
	 * sessions (the miner refuses them anyway).
	 */
	import { onMount } from 'svelte';
	import { Cpu, KeyRound, Loader2, Eye, ShieldAlert } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import CopyText from '$lib/components/common/CopyText.svelte';
	import { minerApi, minerSession, type MinerWallet } from '$lib/local/miner';
	import { exportPrivateKey, walletErrorMessage, EXPORT_CONFIRM_TEXT } from '$lib/local/wallet-setup';

	let w = $state<MinerWallet | null>(null);
	let loadError = $state<string | null>(null);
	let exporting = $state(false);
	let confirmText = $state('');
	let understood = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let key = $state<string | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	const remote = $derived(minerSession()?.remote ?? false);

	onMount(() => {
		minerApi
			.wallet()
			.then((x) => (w = x))
			.catch((e) => (loadError = walletErrorMessage(e)));
		return () => {
			if (hideTimer) clearTimeout(hideTimer);
			key = null;
		};
	});

	function cancel() {
		exporting = false;
		confirmText = '';
		understood = false;
		error = null;
		key = null;
		if (hideTimer) clearTimeout(hideTimer);
	}

	async function reveal() {
		busy = true;
		error = null;
		try {
			key = await exportPrivateKey(confirmText);
			confirmText = '';
			hideTimer = setTimeout(cancel, 60_000);
		} catch (e) {
			error = walletErrorMessage(e);
		} finally {
			busy = false;
		}
	}

	const inputCls =
		'w-full h-[34px] px-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-base)]';
</script>

<Card>
	<h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-4 tracking-[0.01em] flex items-center gap-2">
		<Cpu class="h-4 w-4 text-[var(--text-accent)]" strokeWidth={1.6} /> Miner wallet
	</h2>
	{#if loadError}
		<p class="text-[13px] text-[var(--text-secondary)]">{loadError}</p>
	{:else if !w}
		<Loader2 class="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
	{:else}
		<div class="space-y-2 text-[13px]" data-testid="miner-wallet-card">
			<div class="flex justify-between gap-3"><span class="text-[var(--text-secondary)]">Address</span>{#if w.address}<CopyText value={w.address} />{:else}<span>No wallet yet</span>{/if}</div>
			<div class="flex justify-between gap-3"><span class="text-[var(--text-secondary)]">Type</span><span>{w.mode === 'embedded' ? 'Kept by Necter Miner on this computer' : 'External wallet'}</span></div>
			<div class="flex justify-between gap-3"><span class="text-[var(--text-secondary)]">Status</span><span>{w.locked ? 'Locked' : 'Unlocked'}</span></div>
		</div>

		{#if w.mode === 'embedded' && w.address && !w.locked && !remote}
			<div class="mt-5 pt-4 border-t border-[var(--border-default)]">
				{#if !exporting}
					<button type="button" class="btn-secondary inline-flex items-center gap-1.5" onclick={() => (exporting = true)} data-testid="export-key">
						<KeyRound class="h-3.5 w-3.5" /> Export private key
					</button>
					<p class="text-[11px] text-[var(--text-tertiary)] mt-2">To use this wallet in MetaMask or another app. Only available here, on this computer.</p>
				{:else if key}
					<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-2)] p-3">
						<p class="text-[11px] text-[var(--text-tertiary)] mb-1.5">Private key — hidden again in 60 seconds</p>
						<p class="text-[12px] font-mono break-all text-[var(--text-primary)] select-all" data-testid="exported-key">{key}</p>
					</div>
					<button type="button" class="btn-secondary mt-3" onclick={cancel}>Hide</button>
				{:else}
					<div class="rounded-[8px] border border-[var(--error)]/40 bg-[var(--surface-2)] p-3 text-[12px] text-[var(--text-secondary)] flex gap-2">
						<ShieldAlert class="h-4 w-4 text-[var(--error)] flex-shrink-0 mt-0.5" />
						<span>Anyone with this key can take everything in the wallet, including bonded collateral once withdrawn. Never share it or paste it into a website.</span>
					</div>
					<label class="flex items-start gap-2 mt-3 text-[12px] text-[var(--text-secondary)] cursor-pointer">
						<input type="checkbox" bind:checked={understood} class="mt-0.5 h-4 w-4 accent-[var(--accent-base)]" />
						I understand and I am alone at this screen.
					</label>
					<label for="export-confirm" class="text-[12px] text-[var(--text-secondary)] block mt-3 mb-1.5">Type <span class="font-mono text-[var(--text-primary)]">{EXPORT_CONFIRM_TEXT}</span> to confirm</label>
					<input id="export-confirm" class={inputCls} autocomplete="off" spellcheck="false" bind:value={confirmText} data-testid="export-confirm" />
					<div class="flex gap-2 mt-3">
						<button type="button" class="btn-subscribe inline-flex items-center gap-1.5" disabled={busy || !understood || confirmText.trim().toLowerCase() !== EXPORT_CONFIRM_TEXT} onclick={reveal} data-testid="export-reveal">
							{#if busy}<Loader2 class="h-3.5 w-3.5 animate-spin" />{:else}<Eye class="h-3.5 w-3.5" />{/if} Reveal key
						</button>
						<button type="button" class="btn-secondary" onclick={cancel}>Cancel</button>
					</div>
					{#if error}<p class="mt-2 text-[12px] text-[var(--error)]" role="alert">{error}</p>{/if}
				{/if}
			</div>
		{/if}
	{/if}
</Card>
