<script lang="ts">
	import toast from 'svelte-french-toast';
	import { ArrowLeft, Loader2, ExternalLink } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { Claim, Subscription, Withdrawal } from '$lib/api/types';
	import { signedIn, account } from '$lib/stores/wallet';
	import { refreshBalances } from '$lib/stores/balances';
	import { descriptor, explorerBase } from '$lib/stores/network';
	import { claimAll, withdrawCollateral } from '$lib/flows';
	import { formatAmount, formatDateTime, formatToken, shortAddress, txUrl } from '$lib/format';
	import { sumByToken, WITHDRAWAL_STATUS } from '$lib/components/mining/labels';
	import { projectRef } from '$lib/components/mining/projects.svelte';
	import { Card, StatCard } from '$lib/components/ui';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	const claimsQ = useQuery(() => hub.claims(), { enabled: () => $signedIn });
	const collateralQ = useQuery(() => hub.collateral(), { enabled: () => $signedIn });
	const historyQ = useQuery(() => hub.withdrawals({ limit: 50 }), { enabled: () => $signedIn });

	const claims = $derived((claimsQ.data?.items ?? []) as Claim[]);
	const claimTotals = $derived(sumByToken(claims));
	const withdrawable = $derived(
		((collateralQ.data?.subscriptions ?? []) as Subscription[]).filter(
			(s) => s.status === 'withdrawable' || (s.status === 'unbonding' && !!s.release_at && s.release_at <= Math.floor(Date.now() / 1000))
		)
	);
	const history = $derived((historyQ.data?.items ?? []) as Withdrawal[]);
	const byProject = $derived.by(() => {
		const m = new Map<string, Claim[]>();
		for (const c of claims) m.set(c.project_id, [...(m.get(c.project_id) ?? []), c]);
		return [...m.entries()];
	});

	let claiming = $state(false);
	let busySub = $state<string | null>(null);
	let step = $state('');

	async function refreshAll() {
		void refreshBalances();
		await Promise.all([claimsQ.refresh(), collateralQ.refresh(), historyQ.refresh()]);
	}

	async function claim(projectIds?: string[]) {
		claiming = true;
		try {
			const items = await claimAll(projectIds);
			toast.success(items.length ? `Claim submitted for ${items.length} vault(s)` : 'Claim submitted');
			await refreshAll();
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			claiming = false;
		}
	}

	async function withdraw(s: Subscription) {
		busySub = s.subscription_id;
		try {
			await withdrawCollateral(s, (x) => (step = x));
			toast.success('Collateral withdrawn');
			await refreshAll();
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			busySub = null;
			step = '';
		}
	}
</script>

<svelte:head><title>Withdraw — Necter Mining App Store</title></svelte:head>

<SignInGate title="Earnings & withdrawals" description="Sign in to claim settled rewards and withdraw unbonded collateral. Both are gasless." illustration="ecosystem">
	<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
			<div>
				<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-[-0.015em] leading-7 m-0">Earnings & Withdrawals</h1>
				<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
					Rewards and collateral always go to your miner wallet {$account ? shortAddress($account) : ''}. The network pays the gas.
				</p>
			</div>
			<a href="/mining" class="btn-secondary"><ArrowLeft class="h-3 w-3 mr-1.5" strokeWidth={1.5} /> Back</a>
		</div>

		<div class="mobile-grid-2 grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
			<StatCard label="Claimable rewards" value={claimTotals.length ? claimTotals.map((t) => formatToken(t.amount.toString(), t.token, { maxFrac: 2 })).join(' · ') : '0'} accent />
			<StatCard label="Claimable epochs" value={String(claims.length)} />
			<StatCard label="Withdrawable collateral" value={`${formatAmount(collateralQ.data?.withdrawable ?? '0', 18, { maxFrac: 2 })} NECTA`} />
			<StatCard label="Unbonding" value={`${formatAmount(collateralQ.data?.unbonding ?? '0', 18, { maxFrac: 2 })} NECTA`} />
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<Card>
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-[14px] font-semibold text-[var(--text-primary)]">Claim rewards</h2>
					<button type="button" class="btn-subscribe inline-flex items-center gap-1.5" disabled={claiming || claims.length === 0} onclick={() => claim()} data-testid="claim-all">
						{#if claiming}<Loader2 class="h-3.5 w-3.5 animate-spin" />Claiming…{:else}Claim all (gasless){/if}
					</button>
				</div>
				{#if claimsQ.loading && !claimsQ.data}
					<LoadingBlock rows={3} />
				{:else if claimsQ.error}
					<ErrorState error={claimsQ.error} retry={claimsQ.refresh} compact />
				{:else if claims.length === 0}
					<EmptyState compact illustration="ecosystem" title="Nothing to claim right now" description="Epoch payouts become claimable after settlement and the one-hour challenge window." />
				{:else}
					<div class="space-y-2">
						{#each byProject as [pid, list] (pid)}
							{@const ref = projectRef(pid)}
							{@const tot = sumByToken(list)}
							<div class="flex items-center justify-between gap-3 p-3 rounded-[6px] bg-[var(--surface-2)]">
								<div class="min-w-0">
									<p class="text-[13px] font-medium truncate">{ref?.name ?? pid.slice(0, 12) + '…'}</p>
									<p class="text-[11px] text-[var(--text-tertiary)]">{list.length} epoch{list.length === 1 ? '' : 's'} · {list.map((c) => c.epoch).sort((a, b) => a - b).slice(0, 4).join(', ')}{list.length > 4 ? '…' : ''}</p>
								</div>
								<div class="text-right">
									{#each tot as t (t.token.address)}<p class="text-[13px] font-mono font-semibold text-[var(--text-accent)]">{formatToken(t.amount.toString(), t.token, { maxFrac: 4 })}</p>{/each}
									<button type="button" class="text-[11px] text-[var(--text-accent)] bg-transparent border-none cursor-pointer p-0" disabled={claiming} onclick={() => claim([pid])}>Claim</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</Card>

			<Card>
				<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Withdraw collateral</h2>
				{#if collateralQ.loading && !collateralQ.data}
					<LoadingBlock rows={2} />
				{:else if withdrawable.length === 0}
					<EmptyState compact illustration="security" title="No collateral ready" description="Unbond a subscription first; collateral can be withdrawn after the unbonding period.">
						<a href="/mining/collateral" class="btn-secondary">Manage collateral</a>
					</EmptyState>
				{:else}
					<div class="space-y-2">
						{#each withdrawable as s (s.subscription_id)}
							<div class="flex items-center justify-between gap-3 p-3 rounded-[6px] bg-[var(--surface-2)]">
								<div class="min-w-0">
									<p class="text-[13px] font-medium truncate">{s.project_name ?? projectRef(s.project_id)?.name ?? 'Project'}</p>
									<p class="text-[11px] text-[var(--text-tertiary)] font-mono">{s.node_id}</p>
								</div>
								<div class="text-right">
									<p class="text-[13px] font-mono font-semibold">{formatAmount(s.collateral, 18, { maxFrac: 2 })} NECTA</p>
									<button type="button" class="btn-subscribe mt-1" disabled={busySub === s.subscription_id} onclick={() => withdraw(s)}>
										{busySub === s.subscription_id ? step || 'Working…' : 'Withdraw'}
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</Card>
		</div>

		<Card class="mt-4">
			<h2 class="text-[14px] font-semibold text-[var(--text-primary)] mb-4">History</h2>
			{#if historyQ.loading && !historyQ.data}
				<LoadingBlock rows={3} />
			{:else if history.length === 0}
				<p class="text-[13px] text-[var(--text-secondary)]">No claims or withdrawals yet.</p>
			{:else}
				<div class="divide-y divide-[var(--border-default)]">
					{#each history as w (w.withdrawal_id)}
						{@const st = WITHDRAWAL_STATUS[w.status]}
						<div class="flex items-center justify-between gap-3 py-3">
							<div>
								<p class="text-[13px] font-medium">{w.kind === 'claim' ? 'Reward claim' : 'Collateral withdrawal'}</p>
								<p class="text-[11px] text-[var(--text-tertiary)]">{formatDateTime(w.requested_at)}{w.epochs?.length ? ` · ${w.epochs.length} epoch(s)` : ''}</p>
							</div>
							<div class="text-right">
								<p class="text-[13px] font-mono">{formatToken(w.amount, w.token, { maxFrac: 4 })}</p>
								<p class="text-[11px] flex items-center gap-1 justify-end">
									<span style="color:{st?.color}">{st?.label ?? w.status}</span>
									{#if w.tx_hash}<a href={txUrl(w.tx_hash, explorerBase($descriptor))} target="_blank" rel="noopener noreferrer" class="text-[var(--text-tertiary)]" aria-label="Transaction"><ExternalLink class="h-3 w-3" /></a>{/if}
								</p>
								{#if w.error}<p class="text-[11px] text-[var(--error)]">{w.error}</p>{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	</div>
</SignInGate>
