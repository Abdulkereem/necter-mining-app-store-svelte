<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Droplets, Loader2, ExternalLink, Clock } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import { signedIn, wallet, showConnectModal, signIn } from '$lib/stores/wallet';
	import { balances, nectaOf, refreshBalances } from '$lib/stores/balances';
	import { refreshMe } from '$lib/stores/account';
	import { descriptor, explorerBase } from '$lib/stores/network';
	import { formatAmount, formatDateTime, formatDuration, txUrl } from '$lib/format';
	import { countdown } from '$lib/components/mining/labels';
	import ErrorState from '$lib/components/common/ErrorState.svelte';

	// Re-fetch when the session changes (eligibility is per wallet).
	const q = useQuery(() => {
		void $signedIn;
		return hub.faucet();
	});
	let dripping = $state(false);
	let lastTx = $state<string | null>(null);
	let now = $state(Math.floor(Date.now() / 1000));
	$effect(() => {
		const t = setInterval(() => (now = Math.floor(Date.now() / 1000)), 1000);
		return () => clearInterval(t);
	});

	const necta = $derived(nectaOf($balances));
	const waitSecs = $derived(q.data?.next_eligible_at ? q.data.next_eligible_at - now : 0);

	async function drip() {
		if (!$wallet) return showConnectModal.set(true);
		if (!$signedIn) {
			try {
				await signIn();
			} catch (e) {
				return toast.error(errorMessage(e));
			}
		}
		dripping = true;
		try {
			const r = await hub.drip();
			lastTx = r.tx_hash;
			toast.success(`${formatAmount(r.amount, 18)} testnet NECTA on the way`);
			void refreshBalances();
			void refreshMe();
			await q.refresh();
		} catch (e) {
			toast.error(errorMessage(e));
			await q.refresh();
		} finally {
			dripping = false;
		}
	}
</script>

<svelte:head><title>Testnet faucet · Necter</title></svelte:head>

<div class="px-4 md:px-8 py-8 md:py-12 max-w-[960px] mx-auto">
	<section class="faucet-hero" data-testid="faucet">
		<div class="relative z-[1]">
			<span class="faucet-pill"><Droplets class="h-3 w-3" /> Testnet faucet</span>
			<h1 class="text-[28px] leading-[34px] font-bold tracking-tight text-[var(--text-primary)] mt-4">Get testnet NECTA</h1>
			<p class="text-[14px] text-[var(--text-secondary)] mt-2 max-w-[460px]">
				NECTA is the collateral for mining. The faucet sends {q.data ? formatAmount(q.data.amount, q.data.token.decimals) : '1,000'} testnet NECTA
				per wallet every {q.data ? formatDuration(q.data.cooldown_secs) : '24 h'}. No Sepolia ETH needed — bonding and claims are gasless.
			</p>

			{#if q.error}
				<div class="mt-6 max-w-[420px]"><ErrorState error={q.error} retry={q.refresh} compact /></div>
			{:else}
				<div class="mt-6 flex flex-wrap items-center gap-3">
					{#if q.data && !q.data.enabled}
						<span class="text-[13px] text-[var(--warning)]">The faucet is paused right now. Try again later.</span>
					{:else if $signedIn && q.data && !q.data.eligible && waitSecs > 0}
						<button type="button" class="faucet-btn" disabled><Clock class="h-4 w-4" /> Next drip in {countdown(waitSecs)}</button>
					{:else}
						<button type="button" class="faucet-btn" onclick={drip} disabled={dripping || q.loading} data-testid="faucet-drip">
							{#if dripping}<Loader2 class="h-4 w-4 animate-spin" />Sending…{:else if !$wallet}Connect wallet{:else if !$signedIn}Sign in & request NECTA{:else}Request {q.data ? formatAmount(q.data.amount, q.data.token.decimals) : ''} NECTA{/if}
						</button>
					{/if}
					{#if $wallet}
						<span class="text-[12px] text-[var(--text-tertiary)]">Balance: <span class="font-mono text-[var(--text-secondary)]">{necta ? formatAmount(necta.amount, necta.token.decimals, { maxFrac: 2 }) : '—'} NECTA</span></span>
					{/if}
				</div>
				{#if lastTx}
					<a href={txUrl(lastTx, explorerBase($descriptor))} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 mt-3 text-[12px] text-[var(--text-accent)]">View transaction <ExternalLink class="h-3 w-3" /></a>
				{/if}
				{#if q.data?.next_eligible_at && waitSecs > 0}
					<p class="text-[11px] text-[var(--text-tertiary)] mt-2">Eligible again {formatDateTime(q.data.next_eligible_at)}</p>
				{/if}
			{/if}
		</div>
		<img src="/brand/3d/bee-dark.png" alt="" class="faucet-art" />
	</section>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
		{#each [
			{ n: '1', t: 'Get NECTA', d: 'Request testnet NECTA here once a day.' },
			{ n: '2', t: 'Pick a project', d: 'Discover projects that match your device.' },
			{ n: '3', t: 'Bond & mine', d: 'Bond collateral with a gasless signature and start mining.' }
		] as s (s.n)}
			<div class="rounded-[10px] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
				<span class="text-[11px] font-mono text-[var(--text-accent)]">{s.n}</span>
				<p class="text-[13px] font-semibold mt-1">{s.t}</p>
				<p class="text-[12px] text-[var(--text-secondary)] mt-1">{s.d}</p>
			</div>
		{/each}
	</div>
	<div class="text-center mt-6"><a href="/discover" class="text-[12px] text-[var(--text-accent)]">Browse projects →</a></div>
</div>

<style>
	.faucet-hero {
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 40px;
		border-radius: 16px;
		border: 1px solid var(--border-accent);
		background:
			radial-gradient(ellipse at 85% 50%, rgba(255, 201, 51, 0.14), transparent 55%),
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='98' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23FFC933' fill-opacity='0.07'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") right top / 56px 98px repeat,
			var(--surface-1);
	}
	@media (max-width: 720px) {
		.faucet-hero {
			flex-direction: column-reverse;
			align-items: flex-start;
			padding: 28px 20px;
		}
	}
	.faucet-art {
		width: 220px;
		height: auto;
		flex-shrink: 0;
		filter: drop-shadow(0 20px 40px rgba(255, 201, 51, 0.15));
	}
	.faucet-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 22px;
		padding: 0 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-accent);
		background: var(--accent-subtle);
		border: 1px solid var(--border-accent);
	}
	.faucet-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 40px;
		padding: 0 20px;
		border-radius: 8px;
		border: none;
		background: var(--accent-base);
		color: #0c0c0e;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 120ms;
	}
	.faucet-btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}
	.faucet-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
