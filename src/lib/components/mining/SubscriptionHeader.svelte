<script lang="ts">
	import { ArrowLeft, AlertTriangle, Pause, Play, Plus, LogOut, ArrowDownToLine } from 'lucide-svelte';
	import toast from 'svelte-french-toast';
	import { Modal, Input } from '$lib/components/ui';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import CopyText from '$lib/components/common/CopyText.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { Subscription } from '$lib/api/types';
	import { pause, resume, topUp, unbond, withdrawCollateral } from '$lib/flows';
	import { formatAmount, formatNumber, bpToPercent, formatDuration, parseUnits } from '$lib/format';
	import { refreshBalances } from '$lib/stores/balances';
	import { subStatus } from './labels';

	let {
		sub,
		project,
		wrongWallet,
		now,
		unbondingSecs,
		onChanged
	}: {
		sub: Subscription;
		project: { project_id: string; name: string; category?: string | null; icon?: string | null };
		wrongWallet: boolean;
		now: number;
		unbondingSecs: number | null;
		onChanged: () => void;
	} = $props();

	let st = $derived(subStatus(sub.status));
	let busy = $state<string | null>(null);
	let stepLabel = $state('');

	let canPause = $derived(sub.status === 'active');
	let canResume = $derived(sub.status === 'paused');
	let canTopUp = $derived(['active', 'paused', 'jailed', 'pending_collateral'].includes(sub.status));
	let canUnbond = $derived(['active', 'paused', 'jailed', 'pending_collateral'].includes(sub.status));
	let releasePassed = $derived(sub.release_at !== null && sub.release_at !== undefined && sub.release_at <= now);
	let canWithdraw = $derived(sub.status === 'withdrawable' || (sub.status === 'unbonding' && releasePassed && !(sub.pending_slashes ?? 0)));

	let topUpOpen = $state(false);
	let topUpAmount = $state('');
	let unbondOpen = $state(false);

	async function run(key: string, fn: (step: (l: string) => void) => Promise<unknown>, ok: string) {
		busy = key;
		stepLabel = '';
		try {
			await fn((l) => (stepLabel = l));
			toast.success(ok);
			void refreshBalances();
			onChanged();
			return true;
		} catch (e) {
			toast.error(errorMessage(e));
			return false;
		} finally {
			busy = null;
			stepLabel = '';
		}
	}

	async function doTopUp() {
		let wei: string;
		try {
			wei = parseUnits(topUpAmount, 18);
			if (BigInt(wei) <= 0n) throw new Error('Enter an amount above 0');
		} catch (e) {
			toast.error(errorMessage(e));
			return;
		}
		if (await run('topup', (s) => topUp(sub, wei, s), 'Collateral topped up')) {
			topUpOpen = false;
			topUpAmount = '';
		}
	}

	async function doUnbond() {
		if (await run('unbond', (s) => unbond(sub, s), 'Unbonding started')) unbondOpen = false;
	}

	let earned = $derived(sub.token && sub.earned_total !== undefined ? formatAmount(sub.earned_total, sub.token.decimals) : '—');
	let belowMin = $derived(
		sub.min_collateral !== undefined && /^\d+$/.test(sub.collateral) && /^\d+$/.test(sub.min_collateral) ? BigInt(sub.collateral) < BigInt(sub.min_collateral) : false
	);
	let shortfall = $derived(belowMin && sub.min_collateral ? BigInt(sub.min_collateral) - BigInt(sub.collateral) : 0n);
</script>

<!-- Back Button -->
<a
	href="/mining"
	class="inline-flex items-center gap-2 bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-[5px] text-[13px] px-3 py-1.5 no-underline"
>
	<ArrowLeft class="h-4 w-4" />
	Back to My Mining
</a>

<!-- Header -->
<div class="flex items-start gap-3 md:gap-4">
	<ProjectIcon {project} size={56} rounded="10px" />
	<div class="flex-1 min-w-0">
		<div class="flex flex-wrap items-center gap-3 mb-2">
			<h1 class="text-[24px] font-semibold text-[var(--text-primary)]">{project.name}</h1>
			<span
				class="inline-flex items-center gap-2 text-xs px-2 py-0.5 rounded bg-[var(--surface-2)]"
				style="color: {st.color};"
				title={st.hint}
			>
				<span class="status-dot status-dot-{st.dot} {sub.status === 'active' ? 'status-dot-pulse' : ''}" style="width:6px;height:6px"></span>
				{st.label}
			</span>
		</div>
		<div class="text-[13px] text-[var(--text-secondary)] mb-1 flex flex-wrap items-center gap-x-4 gap-y-1">
			<span class="inline-flex items-center gap-1.5">Subscription <CopyText value={sub.subscription_id} /></span>
			<span class="inline-flex items-center gap-1.5">Device <a href="/mining/devices" class="font-mono text-[12px] text-[var(--text-primary)] no-underline hover:text-[var(--text-accent)]">{sub.node_id}</a></span>
		</div>
		{#if st.hint}
			<p class="text-[12px] text-[var(--text-tertiary)] mb-4">{st.hint}</p>
		{/if}

		{#if wrongWallet}
			<div class="p-4 mb-4 bg-[var(--surface-1)] border border-[rgba(242,153,74,0.30)] rounded-[8px]">
				<div class="flex items-start gap-3">
					<AlertTriangle class="h-5 w-5 text-[var(--warning)] mt-0.5" />
					<div>
						<div class="text-[13px] font-medium text-[var(--text-primary)]">This subscription belongs to a different wallet</div>
						<div class="text-[12px] text-[var(--text-secondary)] mt-1">
							Sign in with <span class="font-mono">{sub.owner}</span> to manage it.
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if sub.status === 'jailed'}
			<div class="p-3 mb-4 rounded-[8px] border border-[rgba(235,87,87,0.30)] bg-[rgba(235,87,87,0.05)] text-[12px] text-[var(--text-secondary)]">
				A slash left the collateral below the project minimum{shortfall > 0n ? ` (short by ${formatAmount(shortfall, 18)} NECTA)` : ''}. Top up to make the
				subscription active again.
			</div>
		{/if}

		<div class="flex flex-wrap gap-2 mb-6">
			{#if canPause}
				<button type="button" class="btn-secondary inline-flex items-center gap-1.5" disabled={wrongWallet || !!busy} onclick={() => run('pause', () => pause(sub), 'Subscription paused')}>
					<Pause class="h-3.5 w-3.5" />{busy === 'pause' ? 'Pausing…' : 'Pause'}
				</button>
			{/if}
			{#if canResume}
				<button type="button" class="btn-subscribe inline-flex items-center gap-1.5" disabled={wrongWallet || !!busy} onclick={() => run('resume', () => resume(sub), 'Subscription resumed')}>
					<Play class="h-3.5 w-3.5" />{busy === 'resume' ? 'Resuming…' : 'Resume'}
				</button>
			{/if}
			{#if canTopUp}
				<button type="button" class="{sub.status === 'jailed' || sub.status === 'pending_collateral' ? 'btn-subscribe' : 'btn-secondary'} inline-flex items-center gap-1.5" disabled={wrongWallet || !!busy} onclick={() => (topUpOpen = true)}>
					<Plus class="h-3.5 w-3.5" />Top up
				</button>
			{/if}
			{#if canWithdraw}
				<button
					type="button"
					class="btn-subscribe inline-flex items-center gap-1.5"
					disabled={wrongWallet || !!busy}
					onclick={() => run('withdraw', (s) => withdrawCollateral(sub, s), 'Collateral withdrawn to your wallet')}
				>
					<ArrowDownToLine class="h-3.5 w-3.5" />{busy === 'withdraw' ? stepLabel || 'Withdrawing…' : 'Withdraw collateral'}
				</button>
			{/if}
			{#if canUnbond}
				<button type="button" class="btn-secondary inline-flex items-center gap-1.5" disabled={wrongWallet || !!busy} onclick={() => (unbondOpen = true)}>
					<LogOut class="h-3.5 w-3.5" />Unbond
				</button>
			{/if}
			<a href="/apps/{sub.project_id}" class="btn-secondary no-underline">View app page</a>
			<a href="/withdraw" class="btn-secondary no-underline">Claim rewards</a>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			<div>
				<p class="text-[12px] text-[var(--text-secondary)]">Total earned</p>
				<p class="text-[20px] font-bold text-[var(--text-accent)] font-mono">{earned} <span class="text-[13px]">{sub.token?.symbol ?? ''}</span></p>
			</div>
			<div>
				<p class="text-[12px] text-[var(--text-secondary)]">Leases completed</p>
				<p class="text-[20px] font-bold text-[var(--text-primary)] font-mono">{formatNumber(sub.leases_completed)}</p>
			</div>
			<div>
				<p class="text-[12px] text-[var(--text-secondary)]">Uptime</p>
				<p class="text-[20px] font-bold text-[var(--text-primary)] font-mono">{bpToPercent(sub.uptime_bp)}</p>
			</div>
			<div>
				<p class="text-[12px] text-[var(--text-secondary)]">Reputation</p>
				<p class="text-[20px] font-bold text-[var(--text-primary)] font-mono">{bpToPercent(sub.reputation)}</p>
			</div>
		</div>
	</div>
</div>

<!-- Top up modal -->
<Modal bind:open={topUpOpen} maxWidth="420px">
	<div class="p-5">
		<h3 class="text-[15px] font-semibold text-[var(--text-primary)] mb-1">Top up collateral</h3>
		<p class="text-[12px] text-[var(--text-secondary)] mb-4">
			Adds NECTA to this subscription's bond. Gasless: you sign a request and a NECTA permit; the network relayer pays the gas.
		</p>
		<div class="grid grid-cols-2 gap-2 mb-4 text-[12px]">
			<div class="p-2.5 rounded-[6px] bg-[var(--surface-2)]">
				<p class="text-[var(--text-tertiary)]">Bonded</p>
				<p class="font-mono text-[var(--text-primary)]">{formatAmount(sub.collateral, 18)} NECTA</p>
			</div>
			<div class="p-2.5 rounded-[6px] bg-[var(--surface-2)]">
				<p class="text-[var(--text-tertiary)]">Minimum</p>
				<p class="font-mono text-[var(--text-primary)]">{sub.min_collateral ? `${formatAmount(sub.min_collateral, 18)} NECTA` : '—'}</p>
			</div>
		</div>
		<label for="topup-amount" class="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5">Amount (NECTA)</label>
		<div class="flex gap-1.5 mb-4">
			<Input id="topup-amount" type="text" inputmode="decimal" bind:value={topUpAmount} placeholder="0.0" class="flex-1 !h-9 font-mono" />
			{#if shortfall > 0n}
				<button type="button" class="btn-secondary !h-9 text-[11px]" onclick={() => (topUpAmount = formatAmount(shortfall, 18, { maxFrac: 18 }).replaceAll(',', ''))}>Minimum</button>
			{/if}
		</div>
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-secondary" onclick={() => (topUpOpen = false)} disabled={busy === 'topup'}>Cancel</button>
			<button type="button" class="btn-subscribe" onclick={doTopUp} disabled={busy === 'topup' || !topUpAmount}>
				{busy === 'topup' ? stepLabel || 'Working…' : 'Top up'}
			</button>
		</div>
	</div>
</Modal>

<!-- Unbond confirm -->
<Modal bind:open={unbondOpen} maxWidth="440px">
	<div class="p-5">
		<h3 class="text-[15px] font-semibold text-[var(--text-primary)] mb-2">Unbond collateral?</h3>
		<div class="text-[13px] text-[var(--text-secondary)] space-y-2 mb-4 leading-5">
			<p>
				Your device stops receiving work for <span class="text-[var(--text-primary)]">{project.name}</span> right away. The
				<span class="font-mono text-[var(--text-primary)]">{formatAmount(sub.collateral, 18)} NECTA</span> bond is released after the unbonding period of
				<span class="text-[var(--text-primary)]">{unbondingSecs ? formatDuration(unbondingSecs) : 'the network'}</span>.
			</p>
			<p>
				During that period the collateral can still be slashed for earlier rounds, and withdrawal waits for any pending slash to finish its dispute window. You
				can withdraw it to your wallet once it is released. This cannot be undone — mining again needs a new bond.
			</p>
		</div>
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-secondary" onclick={() => (unbondOpen = false)} disabled={busy === 'unbond'}>Cancel</button>
			<button type="button" class="btn-subscribe" onclick={doUnbond} disabled={busy === 'unbond'}>
				{busy === 'unbond' ? stepLabel || 'Working…' : 'Start unbonding'}
			</button>
		</div>
	</div>
</Modal>
