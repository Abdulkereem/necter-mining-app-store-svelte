<script lang="ts">
	import type { App } from '$lib/types';

	let {
		app,
		totalEarnedNecta,
		pendingRewardsNecta,
		totalWithdrawn,
		financialTransactions
	}: {
		app: App;
		totalEarnedNecta: number;
		pendingRewardsNecta: number;
		totalWithdrawn: number;
		financialTransactions: Array<{
			id: string;
			type: 'payout' | 'withdrawal' | 'slash';
			date: string;
			label: string;
			amount: number;
			meta?: string;
		}>;
	} = $props();
</script>

<div class="space-y-6">
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<p
				class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium"
			>
				Amount earned
			</p>
			<p class="text-[20px] font-bold text-[var(--text-accent)] mt-1 font-mono">
				{totalEarnedNecta.toFixed(4)} NECTA
			</p>
			<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">
				Total from verified proofs
			</p>
		</div>
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<p
				class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium"
			>
				Pending
			</p>
			<p class="text-[20px] font-bold text-[var(--text-primary)] mt-1 font-mono">
				{pendingRewardsNecta.toFixed(4)} NECTA
			</p>
			<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">
				From queued/running jobs
			</p>
		</div>
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<p
				class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium"
			>
				Withdrawn
			</p>
			<p class="text-[20px] font-bold text-[var(--text-primary)] mt-1 font-mono">
				{totalWithdrawn.toFixed(4)} NECTA
			</p>
			<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">
				Successfully claimed
			</p>
		</div>
		<div
			class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<p
				class="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium"
			>
				Available
			</p>
			<p class="text-[20px] font-bold text-[var(--text-primary)] mt-1 font-mono">
				{(totalEarnedNecta - totalWithdrawn).toFixed(4)} NECTA
			</p>
			<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">
				Earned minus withdrawn
			</p>
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<div
			class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				Reward criteria
			</h4>
			<ul class="text-[13px] text-[var(--text-secondary)] space-y-2">
				<li>- Proof verified within dispute window</li>
				<li>- Miner share: 80% of gross reward</li>
				<li>- Developer: 15% / Treasury: 5%</li>
				<li>
					- Min reward: {app?.minRewardPerTask ?? '0'} / Max: {app?.maxRewardPerTask ??
						'—'}
					{app?.rewardToken ?? 'NECTA'}
				</li>
			</ul>
		</div>
		<div
			class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
				Earnings schedule
			</h4>
			<p class="text-[13px] text-[var(--text-secondary)] mb-2">
				Payouts are distributed when proofs are verified. No batching delay in this
				prototype.
			</p>
			<div class="text-[13px] space-y-1">
				<p>
					<span class="text-[var(--text-secondary)]">Dispute window:</span>
					<span class="text-[var(--text-primary)]"
						>{app?.disputeWindowSeconds
							? `${(app.disputeWindowSeconds / 3600).toFixed(1)}h`
							: '24h'} after proof submission</span
					>
				</p>
				<p>
					<span class="text-[var(--text-secondary)]">Withdrawal:</span>
					<span class="text-[var(--text-primary)]"
						>Request anytime; processing ~1-2 min</span
					>
				</p>
			</div>
		</div>
	</div>

	<!-- Transaction history -->
	<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
		<div class="flex items-center justify-between mb-4">
			<h4 class="text-[13px] font-semibold text-[var(--text-primary)]">
				Transaction history
			</h4>
			<a href="/withdraw" class="btn-secondary">Withdraw / manage payouts</a>
		</div>
		<div class="rounded-[8px] border border-[var(--border)] overflow-x-auto">
			<table class="w-full text-[13px]">
				<thead>
					<tr class="border-b border-[var(--border)] bg-[var(--surface-2)]">
						<th
							class="text-left p-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide"
							>Date</th
						>
						<th
							class="text-left p-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide"
							>Type</th
						>
						<th
							class="text-right p-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide"
							>Amount (NECTA)</th
						>
						<th
							class="text-left p-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide"
							>Details</th
						>
					</tr>
				</thead>
				<tbody>
					{#if financialTransactions.length === 0}
						<tr>
							<td
								colspan="4"
								class="p-6 text-center text-[13px] text-[var(--text-secondary)]"
								>No transactions yet.</td
							>
						</tr>
					{:else}
						{#each financialTransactions as tx (tx.id)}
							<tr
								class="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
							>
								<td
									class="p-3 text-[12px] text-[var(--text-secondary)] font-mono"
									>{new Date(tx.date).toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										year: 'numeric',
										hour: '2-digit',
										minute: '2-digit'
									})}</td
								>
								<td class="p-3">
									<span
										class="text-[11px] capitalize px-2 py-0.5 rounded {tx.type === 'slash'
											? 'bg-[var(--error)]/15 text-[var(--error)]'
											: tx.type === 'withdrawal'
												? 'bg-[var(--surface-2)] text-[var(--text-secondary)]'
												: 'bg-[var(--accent)]/15 text-[var(--accent)]'}"
									>
										{tx.label}
									</span>
								</td>
								<td
									class="p-3 text-right tabular-nums font-mono font-medium text-[13px] {tx.amount >= 0
										? 'text-[var(--success)]'
										: 'text-[var(--error)]'}"
								>
									{tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(4)}
								</td>
								<td class="p-3 text-[11px] text-[var(--text-tertiary)]"
									>{tx.meta ?? '—'}</td
								>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
