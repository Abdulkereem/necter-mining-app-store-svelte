<script lang="ts">
	import toast from 'svelte-french-toast';
	import { AlertCircle, Lock, Unlock, Loader2 } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { Subscription } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { refreshBalances } from '$lib/stores/balances';
	import { topUp, unbond, withdrawCollateral } from '$lib/flows';
	import { formatAmount, formatDateTime, parseUnits } from '$lib/format';
	import { subStatus, bigOf, countdown } from '$lib/components/mining/labels';
	import { projectRef } from '$lib/components/mining/projects.svelte';
	import { Modal } from '$lib/components/ui';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	const D = 18; // collateral is always NECTA (PLATFORM.md D20)
	const q = useQuery(() => hub.collateral(), { enabled: () => $signedIn });
	const subs = $derived(((q.data?.subscriptions ?? []) as Subscription[]).filter((s) => s.status !== 'closed'));

	let busy = $state<string | null>(null);
	let step = $state('');
	let topUpFor = $state<Subscription | null>(null);
	let topUpAmount = $state('');
	let confirmUnbond = $state<Subscription | null>(null);
	const now = Math.floor(Date.now() / 1000);

	async function run(s: Subscription, fn: () => Promise<unknown>, ok: string) {
		busy = s.subscription_id;
		try {
			await fn();
			toast.success(ok);
			void refreshBalances();
			await q.refresh();
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			busy = null;
			step = '';
		}
	}

	async function doTopUp() {
		const s = topUpFor;
		if (!s) return;
		let wei: string;
		try {
			wei = parseUnits(topUpAmount, D);
		} catch (e) {
			toast.error(errorMessage(e));
			return;
		}
		topUpFor = null;
		await run(s, () => topUp(s, wei, (x) => (step = x)), 'Collateral added');
	}

	const health = (s: Subscription) =>
		s.collateral_health === 'critical' || s.status === 'jailed' ? 'critical' : s.collateral_health === 'warning' ? 'warning' : 'healthy';
</script>

<svelte:head><title>Collateral · Necter</title></svelte:head>

<SignInGate title="Sign in to manage collateral" description="Collateral is NECTA bonded per device and project. Bonding, unbonding and withdrawals are gasless.">
	<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-6 pb-12">
		<div style="margin-bottom:24px">
			<h1 class="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]" style="margin-bottom:12px">Collateral Management</h1>
			<p class="text-[13px] text-[var(--text-secondary)]" style="max-width:640px">
				Bonded NECTA per subscription, unbonding timers and slashes. Every action here is relayed for you — no Sepolia ETH needed.
			</p>
		</div>

		{#if q.loading && !q.data}
			<LoadingBlock rows={3} height="96px" />
		{:else if q.error}
			<ErrorState error={q.error} retry={q.refresh} />
		{:else if q.data}
			{@const c = q.data}
			<div style="border-bottom:1px solid var(--border-default);padding-bottom:24px">
				<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
					{#each [
						{ label: 'Bonded', value: c.bonded, color: 'var(--text-accent)' },
						{ label: 'Unbonding', value: c.unbonding, color: 'var(--text-primary)' },
						{ label: 'Withdrawable', value: c.withdrawable, color: 'var(--success)' },
						{ label: 'Slashed (total)', value: c.slashed_total, color: 'var(--error)' },
						{ label: 'Wallet NECTA', value: c.necta_balance, color: 'var(--text-primary)' }
					] as stat (stat.label)}
						<div>
							<p style="font-size:12px;color:var(--text-secondary);font-weight:500;text-transform:uppercase;letter-spacing:0.04em">{stat.label}</p>
							<p style="font-size:22px;font-weight:600;font-family:var(--font-mono);color:{stat.color};margin-top:8px">{formatAmount(stat.value ?? '0', D, { maxFrac: 2 })}</p>
							<p class="text-[10px] text-[var(--text-tertiary)]">NECTA</p>
						</div>
					{/each}
				</div>
				{#if (c.pending_slashes ?? 0) > 0}
					<p class="mt-4 text-[12px] text-[var(--warning)] flex items-center gap-1.5"><AlertCircle size={14} /> {c.pending_slashes} pending slash proposal(s) — review them on the subscription page and dispute if they are wrong.</p>
				{/if}
			</div>

			<div style="margin-top:24px;display:flex;flex-direction:column;gap:16px">
				{#each subs as s (s.subscription_id)}
					{@const h = health(s)}
					{@const st = subStatus(s.status)}
					{@const ref = projectRef(s.project_id)}
					{@const borderColor = h === 'healthy' ? 'rgba(76,183,130,0.20)' : h === 'warning' ? 'rgba(242,153,74,0.20)' : 'rgba(235,87,87,0.20)'}
					{@const bgColor = h === 'healthy' ? 'rgba(76,183,130,0.05)' : h === 'warning' ? 'rgba(242,153,74,0.05)' : 'rgba(235,87,87,0.05)'}
					{@const fill = h === 'healthy' ? 'var(--success)' : h === 'warning' ? 'var(--warning)' : 'var(--error)'}
					{@const min = bigOf(s.min_collateral)}
					{@const col = bigOf(s.collateral)}
					{@const pct = min > 0n ? Math.min(100, Number((col * 100n) / (min * 2n))) : 100}
					{@const releaseIn = s.release_at ? s.release_at - now : null}
					<div style="border:2px solid {borderColor};background:{bgColor};border-radius:8px;padding:16px">
						<div class="flex items-start justify-between gap-4 flex-wrap">
							<div>
								<a href="/mining/{s.subscription_id}" class="text-[14px] font-semibold text-[var(--text-primary)] no-underline hover:underline">{s.project_name ?? ref?.name ?? 'Project'}</a>
								<p class="text-[11px] text-[var(--text-tertiary)] font-mono">{s.node_id}</p>
							</div>
							<span class="text-[11px] font-medium px-1.5 h-[20px] inline-flex items-center rounded-[3px] bg-[var(--surface-3)]" style="color:{st.color}">{st.label}</span>
						</div>
						<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
							<div><p class="text-[11px] text-[var(--text-secondary)]">Bonded</p><p class="text-[14px] font-mono font-semibold">{formatAmount(s.collateral, D, { maxFrac: 2 })} NECTA</p></div>
							<div><p class="text-[11px] text-[var(--text-secondary)]">Project minimum</p><p class="text-[14px] font-mono">{formatAmount(s.min_collateral ?? '0', D, { maxFrac: 2 })} NECTA</p></div>
							<div><p class="text-[11px] text-[var(--text-secondary)]">Slashed</p><p class="text-[14px] font-mono">{formatAmount(s.slashed_total ?? '0', D, { maxFrac: 2 })}{(s.pending_slashes ?? 0) > 0 ? ` · ${s.pending_slashes} pending` : ''}</p></div>
							<div>
								<p class="text-[11px] text-[var(--text-secondary)]">{s.status === 'unbonding' ? 'Withdrawable in' : 'Release'}</p>
								<p class="text-[14px] font-mono flex items-center gap-1">
									{#if s.status === 'unbonding' && releaseIn !== null}<Lock size={13} /> {countdown(releaseIn)}{:else if s.status === 'withdrawable'}<Unlock size={13} /> now{:else}—{/if}
								</p>
								{#if s.release_at}<p class="text-[10px] text-[var(--text-tertiary)]">{formatDateTime(s.release_at)}</p>{/if}
							</div>
						</div>
						<div style="height:4px;border-radius:2px;background:var(--surface-3);overflow:hidden;margin-top:12px" title="Collateral vs. 2× the project minimum">
							<div style="height:100%;width:{pct}%;background:{fill};border-radius:2px"></div>
						</div>
						<div class="flex flex-wrap gap-2 mt-4">
							{#if busy === s.subscription_id}
								<span class="text-[12px] text-[var(--text-secondary)] inline-flex items-center gap-1.5"><Loader2 class="h-3.5 w-3.5 animate-spin" /> {step || 'Working…'}</span>
							{:else}
								{#if ['active', 'paused', 'jailed', 'pending_collateral'].includes(s.status)}
									<button type="button" class="btn-subscribe" onclick={() => { topUpFor = s; topUpAmount = ''; }}>Add collateral</button>
								{/if}
								{#if ['active', 'paused', 'jailed'].includes(s.status)}
									<button type="button" class="btn-secondary" onclick={() => (confirmUnbond = s)}>Unbond</button>
								{/if}
								{#if s.status === 'withdrawable' || (s.status === 'unbonding' && releaseIn !== null && releaseIn <= 0)}
									<button type="button" class="btn-subscribe" onclick={() => run(s, () => withdrawCollateral(s, (x) => (step = x)), 'Collateral withdrawn')}>Withdraw</button>
								{/if}
							{/if}
						</div>
					</div>
				{:else}
					<EmptyState illustration="security" title="No collateral bonded" description="Collateral appears here once you subscribe a device to a project.">
						<a href="/discover" class="btn-subscribe">Find a project</a>
						<a href="/faucet" class="btn-secondary">Get testnet NECTA</a>
					</EmptyState>
				{/each}
			</div>
		{/if}
	</div>

	<Modal open={!!topUpFor} onClose={() => (topUpFor = null)}>
		<h2 class="text-[15px] font-semibold mb-2">Add collateral</h2>
		<p class="text-[12px] text-[var(--text-secondary)] mb-3">You will sign an EIP-712 Bond and a NECTA permit; the network relays them.</p>
		<label for="topup" class="text-[12px] text-[var(--text-secondary)] block mb-1">Amount (NECTA)</label>
		<input id="topup" inputmode="decimal" bind:value={topUpAmount} class="w-full h-[38px] px-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] font-mono text-[14px] outline-none focus:border-[var(--accent-base)]" />
		<div class="flex justify-end gap-2 mt-4">
			<button type="button" class="btn-secondary" onclick={() => (topUpFor = null)}>Cancel</button>
			<button type="button" class="btn-subscribe" disabled={!topUpAmount} onclick={doTopUp}>Add collateral</button>
		</div>
	</Modal>

	<Modal open={!!confirmUnbond} onClose={() => (confirmUnbond = null)}>
		<h2 class="text-[15px] font-semibold mb-2">Unbond collateral?</h2>
		<p class="text-[13px] text-[var(--text-secondary)]">
			This device stops receiving work for this project. Your collateral stays slashable during the unbonding period (24 hours on the testnet) and can then be withdrawn.
		</p>
		<div class="flex justify-end gap-2 mt-4">
			<button type="button" class="btn-secondary" onclick={() => (confirmUnbond = null)}>Cancel</button>
			<button
				type="button"
				class="btn-subscribe"
				onclick={() => {
					const s = confirmUnbond!;
					confirmUnbond = null;
					void run(s, () => unbond(s, (x) => (step = x)), 'Unbonding started');
				}}>Unbond</button
			>
		</div>
	</Modal>
</SignInGate>
