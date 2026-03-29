<script lang="ts">
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, wallet, showConnectModal } from '$lib/stores/wallet';
	import { ArrowUpRight, Download, ExternalLink } from 'lucide-svelte';

	type TimeRange = '7d' | '30d' | '90d' | 'all';

	let amount = $state('');
	let recipient = $state('');
	let selectedWithdrawalId = $state<string | null>(null);
	let timeRange = $state<TimeRange>('30d');

	let minerId = $derived($actor?.minerId ?? null);
	let walletAddress = $derived($wallet?.address ?? '');

	const NECTA_USD = 0.2;

	let availableBalance = $derived(
		$wallet?.address ? ($backendState.walletBalancesByAddress?.[$wallet.address] ?? 0) : 0
	);

	let totalEarned = $derived(
		minerId
			? $backendState.proofs
					.filter((p) => p.status === 'verified' && p.minerId === minerId)
					.reduce((sum, p) => sum + p.reward, 0)
			: 0
	);

	let pendingRewards = $derived(
		minerId
			? $backendState.jobs
					.filter(
						(j) =>
							(j.status === 'queued' || j.status === 'running') && j.minerId === minerId
					)
					.reduce((sum, j) => sum + j.reward, 0)
			: 0
	);

	let thisMonth = $derived(() => {
		const payouts = (($backendState as any).payouts ?? []) as Array<{
			minerId: string;
			createdAt: string;
			minerAmount: number;
		}>;
		const now = new Date();
		return payouts
			.filter(
				(p) =>
					p.minerId === minerId &&
					new Date(p.createdAt).getMonth() === now.getMonth() &&
					new Date(p.createdAt).getFullYear() === now.getFullYear()
			)
			.reduce((sum, p) => sum + Number(p.minerAmount ?? 0), 0);
	});

	let parsedAmount = $derived(Number.parseFloat(amount || '0'));
	let feeNecta = $derived(Number(Math.max(0.01, parsedAmount * 0.005).toFixed(4)));
	let gasNecta = 0.02;
	let totalFees = $derived(feeNecta + gasNecta);
	let canWithdraw = $derived(!!$wallet && parsedAmount > 0 && parsedAmount <= availableBalance);

	let savedRecipients = $derived.by(() => {
		if (!minerId || !walletAddress) return walletAddress ? [walletAddress] : [];
		let saved: string[] = [];
		try {
			saved = backend.listWithdrawalAddresses(minerId);
		} catch {
			/* not authenticated */
		}
		const merged = walletAddress ? [walletAddress, ...saved] : [...saved];
		const out: string[] = [];
		for (const a of merged) {
			if (!a) continue;
			if (out.some((x) => x.toLowerCase() === a.toLowerCase())) continue;
			out.push(a);
		}
		return out;
	});

	let recipientAddress = $derived(recipient || walletAddress);

	let minerWithdrawals = $derived(
		minerId ? $backendState.withdrawals.filter((w) => w.minerId === minerId) : []
	);

	let selectedWithdrawal = $derived(
		selectedWithdrawalId
			? (minerWithdrawals.find((w) => w.id === selectedWithdrawalId) ?? null)
			: null
	);

	// Earnings chart data
	let chartData = $derived.by(() => {
		const payouts = (($backendState as any).payouts ?? []) as Array<{
			minerId: string;
			createdAt: string;
			minerAmount: number;
		}>;
		const minerPayouts = minerId ? payouts.filter((p) => p.minerId === minerId) : [];
		const now = new Date();
		const totalDays =
			timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
		const barCount =
			timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 30 : 30;
		const bucketSize = Math.max(1, Math.floor(totalDays / barCount));
		const daysMap: Record<string, number> = {};
		let periodTotal = 0;

		for (const p of minerPayouts) {
			const dayDiff = Math.floor(
				(now.getTime() - new Date(p.createdAt).getTime()) / 86400000
			);
			if (dayDiff < totalDays) {
				periodTotal += Number(p.minerAmount ?? 0);
				const bucket = Math.min(barCount - 1, Math.floor(dayDiff / bucketSize));
				const key = String(barCount - 1 - bucket);
				daysMap[key] = (daysMap[key] ?? 0) + Number(p.minerAmount ?? 0);
			}
		}

		const bars = Array.from({ length: barCount }, (_, i) => daysMap[String(i)] ?? 0);
		const maxVal = Math.max(...bars, 0.01);
		const startLabel = new Date(now.getTime() - totalDays * 86400000).toLocaleDateString(
			'en-US',
			{ month: 'short', day: 'numeric' }
		);

		return { bars, maxVal, periodTotal, barCount, startLabel };
	});

	function handleWithdraw() {
		if (!$actor || !$wallet || !minerId) {
			showConnectModal.set(true);
			return;
		}
		if (!canWithdraw) return;
		backend.requestWithdrawal({
			minerId,
			walletAddress: recipientAddress,
			amount: parsedAmount
		});
		amount = '';
	}

	function exportCsv() {
		const rows = minerWithdrawals.map((w) => ({
			id: w.id,
			status: w.status,
			amount: w.amount,
			fee: w.fee,
			walletAddress: w.walletAddress,
			requestedAt: w.requestedAt,
			completedAt: w.completedAt ?? '',
			txHash: w.txHash ?? ''
		}));
		const header = Object.keys(rows[0] ?? { id: '' }).join(',');
		const body = rows
			.map((r) =>
				Object.values(r)
					.map((v) => `"${String(v).replaceAll('"', '""')}"`)
					.join(',')
			)
			.join('\n');
		const csv = `${header}\n${body}\n`;
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `necter-withdrawals-${minerId}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function addAddress() {
		const addr = prompt('Add a new withdrawal address:');
		if (addr?.trim() && minerId) {
			backend.addWithdrawalAddress({ minerId, walletAddress: addr.trim() });
		}
	}
</script>

{#if !$actor || !$wallet}
	<!-- Hidden when no wallet -->
{:else}
	<div style="display: flex; flex-direction: column; gap: 32px;">
		<!-- Summary stats -->
		<div
			style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border-default); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
		>
			{#each [
				{
					label: 'Available',
					value: availableBalance.toFixed(4),
					sub: `≈ $${(availableBalance * NECTA_USD).toFixed(2)}`,
					color: 'var(--success)'
				},
				{
					label: 'Total Earned',
					value: totalEarned.toFixed(4),
					sub: `≈ $${(totalEarned * NECTA_USD).toFixed(2)}`,
					color: null
				},
				{
					label: 'Pending',
					value: pendingRewards.toFixed(4),
					sub: `≈ $${(pendingRewards * NECTA_USD).toFixed(2)}`,
					color: null,
					muted: true
				},
				{ label: 'This Month', value: thisMonth().toFixed(4), sub: null, color: null }
			] as stat}
				<div
					style="background: var(--surface-1); padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;"
				>
					<span
						style="font-size: 11px; font-weight: 500; color: var(--text-tertiary); letter-spacing: 0.02em; text-transform: uppercase;"
					>
						{stat.label}
					</span>
					<span
						style="font-size: 22px; font-weight: 600; font-family: var(--font-mono); color: {stat.color ??
							(stat.muted ? 'var(--text-secondary)' : 'var(--text-primary)')}; letter-spacing: -0.02em; line-height: 28px; font-feature-settings: 'tnum' 1;"
					>
						{stat.value}
					</span>
					<span style="font-size: 11px; color: var(--text-tertiary); letter-spacing: 0.02em;">
						{stat.sub ?? 'NECTA'}
					</span>
				</div>
			{/each}
		</div>

		<!-- Earnings chart with time range -->
		<div
			style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
		>
			<div
				style="padding: 12px 16px 8px; border-bottom: 1px solid var(--border-default); display: flex; align-items: center; justify-content: space-between;"
			>
				<span
					style="font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-tertiary);"
				>
					Earnings trend
				</span>
				<div style="display: flex; gap: 2px;">
					{#each ['7d', '30d', '90d', 'all'] as range}
						<button
							type="button"
							onclick={() => (timeRange = range as TimeRange)}
							style="height: 24px; padding: 0 8px; border-radius: 4px; font-size: 11px; font-weight: 500; border: none; cursor: pointer; background: {timeRange ===
							range
								? 'var(--accent-subtle)'
								: 'transparent'}; color: {timeRange === range
								? 'var(--text-accent)'
								: 'var(--text-tertiary)'}; transition: background 100ms ease-out, color 100ms ease-out;"
						>
							{range === 'all' ? 'All' : range}
						</button>
					{/each}
				</div>
			</div>
			<div style="padding: 16px 16px 12px;">
				<div style="margin-bottom: 12px;">
					<span
						style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: var(--text-primary); letter-spacing: -0.02em;"
					>
						{chartData.periodTotal.toFixed(4)}
					</span>
					<span style="font-size: 12px; color: var(--text-tertiary); margin-left: 6px;"
						>NECTA</span
					>
				</div>
				<div style="display: flex; align-items: flex-end; gap: 2px; height: 120px;">
					{#each chartData.bars as val, i}
						{@const h = val > 0 ? Math.max(4, (val / chartData.maxVal) * 120) : 2}
						<div
							title="{val.toFixed(4)} NECTA"
							style="flex: 1; height: {h}px; border-radius: 2px 2px 0 0; background: {i ===
							chartData.bars.length - 1
								? 'var(--accent-base)'
								: 'var(--accent-subtle)'}; transition: height 200ms ease-out; cursor: default;"
						></div>
					{/each}
				</div>
				<div style="display: flex; justify-content: space-between; margin-top: 6px;">
					<span
						style="font-size: 10px; color: var(--text-tertiary); font-family: var(--font-mono);"
					>
						{chartData.startLabel}
					</span>
					<span
						style="font-size: 10px; color: var(--text-tertiary); font-family: var(--font-mono);"
					>
						Today
					</span>
				</div>
			</div>
		</div>

		<!-- Withdraw + Withdrawals -->
		<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 32px;">
			<!-- Withdraw Funds -->
			<div
				style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 24px;"
			>
				<h2
					style="font-size: 14px; font-weight: 600; letter-spacing: -0.006em; color: var(--text-primary); margin-bottom: 24px;"
				>
					Withdraw Funds
				</h2>

				<div style="display: flex; flex-direction: column; gap: 20px;">
					<!-- Amount -->
					<div>
						<label
							style="display: block; font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;"
						>
							Withdrawal Amount
						</label>
						<div style="display: flex; gap: 8px;">
							<input
								type="number"
								bind:value={amount}
								placeholder="Enter amount (NECTA)"
								style="flex: 1; height: 32px; padding: 0 10px; font-size: 13px; font-family: var(--font-mono); background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 5px; color: var(--text-primary); outline: none;"
							/>
							<button
								type="button"
								onclick={() => (amount = availableBalance.toString())}
								style="height: 32px; padding: 0 12px; font-size: 13px; background: var(--surface-2); border: 1px solid var(--border-default); border-radius: 5px; color: var(--text-primary); cursor: pointer;"
							>
								Max
							</button>
						</div>
					</div>

					<!-- Destination -->
					<div>
						<label
							style="display: block; font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;"
						>
							Destination Wallet
						</label>
						<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
							<select
								bind:value={recipient}
								style="height: 32px; padding: 0 10px; font-size: 13px; font-family: var(--font-mono); background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 5px; color: var(--text-primary); outline: none;"
							>
								{#each savedRecipients as addr}
									<option value={addr}>{addr}</option>
								{/each}
							</select>
							<button
								type="button"
								onclick={addAddress}
								style="height: 32px; padding: 0 12px; font-size: 13px; background: var(--surface-2); border: 1px solid var(--border-default); border-radius: 5px; color: var(--text-primary); cursor: pointer;"
							>
								Add Address
							</button>
						</div>
					</div>

					<!-- Fee summary -->
					<div
						style="background: var(--surface-2); padding: 16px; border-radius: 8px; border: 1px solid var(--border-default);"
					>
						<div
							style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;"
						>
							<span style="color: var(--text-secondary);">Withdrawal Amount</span>
							<span
								style="font-weight: 500; color: var(--text-primary); font-family: var(--font-mono);"
								>{parsedAmount.toFixed(4)} NECTA</span
							>
						</div>
						<div
							style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;"
						>
							<span style="color: var(--text-secondary);">Network Fee</span>
							<span
								style="font-weight: 500; color: var(--text-primary); font-family: var(--font-mono);"
								>{feeNecta.toFixed(4)} NECTA</span
							>
						</div>
						<div
							style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;"
						>
							<span style="color: var(--text-secondary);">Estimated Gas</span>
							<span
								style="font-weight: 500; color: var(--text-primary); font-family: var(--font-mono);"
								>{gasNecta.toFixed(2)} NECTA</span
							>
						</div>
						<div
							style="display: flex; justify-content: space-between; font-size: 13px; border-top: 1px solid var(--border-default); padding-top: 8px; margin-top: 8px;"
						>
							<span style="font-weight: 500; color: var(--text-primary);">You Receive</span>
							<span
								style="font-weight: 600; color: var(--success); font-family: var(--font-mono);"
								>{Math.max(0, parsedAmount - totalFees).toFixed(4)} NECTA</span
							>
						</div>
						<div
							style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-tertiary); margin-top: 4px;"
						>
							<span>USD estimate</span>
							<span style="font-family: var(--font-mono);"
								>≈ ${(Math.max(0, parsedAmount - totalFees) * NECTA_USD).toFixed(2)} USD</span
							>
						</div>
					</div>

					<!-- Withdraw button -->
					<button
						type="button"
						onclick={handleWithdraw}
						disabled={!$wallet || !canWithdraw}
						class="btn-subscribe"
						style="width: 100%; height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 500;"
					>
						<ArrowUpRight size={16} strokeWidth={1.5} />
						Withdraw
					</button>
				</div>
			</div>

			<!-- Recent Withdrawals -->
			<div>
				<div
					style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;"
				>
					<h2
						style="font-size: 14px; font-weight: 600; letter-spacing: -0.006em; color: var(--text-primary);"
					>
						Recent Withdrawals
					</h2>
					<button
						type="button"
						onclick={exportCsv}
						disabled={minerWithdrawals.length === 0}
						style="height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); background: transparent; border: none; cursor: pointer; border-radius: 5px;"
					>
						<Download size={16} strokeWidth={1.5} />
						Export CSV
					</button>
				</div>
				<div style="display: flex; flex-direction: column; gap: 12px;">
					{#each minerWithdrawals as withdrawal}
						<button
							type="button"
							onclick={() => (selectedWithdrawalId = withdrawal.id)}
							style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px; cursor: pointer; text-align: left; transition: background 100ms ease-out;"
						>
							<div
								style="display: flex; justify-content: space-between; margin-bottom: 8px;"
							>
								<span
									style="font-size: 13px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono);"
									>{withdrawal.amount.toFixed(4)} NECTA</span
								>
								<span
									style="font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; background: {withdrawal.status ===
									'completed'
										? 'var(--success-subtle, rgba(0,200,100,0.1))'
										: 'var(--surface-2)'}; color: {withdrawal.status === 'completed'
										? 'var(--success)'
										: 'var(--text-secondary)'};"
								>
									{withdrawal.status}
								</span>
							</div>
							<p style="font-size: 11px; color: var(--text-tertiary);">
								{new Date(withdrawal.requestedAt).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}
							</p>
						</button>
					{/each}
					{#if minerWithdrawals.length === 0}
						<div
							style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 24px; text-align: center;"
						>
							<p style="font-size: 13px; color: var(--text-secondary);">
								No withdrawals yet
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Withdrawal detail modal -->
		{#if selectedWithdrawal}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				style="position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5);"
				onkeydown={(e) => {
					if (e.key === 'Escape') selectedWithdrawalId = null;
				}}
				onclick={() => (selectedWithdrawalId = null)}
			>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					style="background: var(--surface-2); border: 1px solid var(--border-default); border-radius: 12px; padding: 24px; max-width: 480px; width: 100%;"
					onclick={(e) => e.stopPropagation()}
				>
					<h3
						style="font-size: 14px; font-weight: 600; letter-spacing: -0.006em; color: var(--text-primary); margin-bottom: 16px;"
					>
						Withdrawal details
					</h3>
					<div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
						<div style="display: flex; justify-content: space-between;">
							<span style="color: var(--text-secondary);">Amount</span>
							<span
								style="font-weight: 500; color: var(--text-primary); font-family: var(--font-mono);"
								>{selectedWithdrawal.amount.toFixed(4)} NECTA</span
							>
						</div>
						<div style="display: flex; justify-content: space-between;">
							<span style="color: var(--text-secondary);">Fee</span>
							<span
								style="font-weight: 500; color: var(--text-primary); font-family: var(--font-mono);"
								>{selectedWithdrawal.fee.toFixed(4)} NECTA</span
							>
						</div>
						<div style="display: flex; justify-content: space-between;">
							<span style="color: var(--text-secondary);">Status</span>
							<span
								style="font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; background: {selectedWithdrawal.status ===
								'completed'
									? 'var(--success-subtle, rgba(0,200,100,0.1))'
									: 'var(--surface-3)'}; color: {selectedWithdrawal.status === 'completed'
									? 'var(--success)'
									: 'var(--text-secondary)'};"
							>
								{selectedWithdrawal.status}
							</span>
						</div>
						<div
							style="display: flex; justify-content: space-between; gap: 12px;"
						>
							<span style="color: var(--text-secondary);">Recipient</span>
							<span
								style="font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
								>{selectedWithdrawal.walletAddress}</span
							>
						</div>
						<div style="display: flex; justify-content: space-between;">
							<span style="color: var(--text-secondary);">Requested</span>
							<span style="color: var(--text-primary);"
								>{new Date(selectedWithdrawal.requestedAt).toLocaleString()}</span
							>
						</div>
						{#if selectedWithdrawal.completedAt}
							<div style="display: flex; justify-content: space-between;">
								<span style="color: var(--text-secondary);">Completed</span>
								<span style="color: var(--text-primary);"
									>{new Date(selectedWithdrawal.completedAt).toLocaleString()}</span
								>
							</div>
						{/if}
						{#if selectedWithdrawal.txHash}
							<div
								style="display: flex; align-items: center; justify-content: space-between; gap: 12px;"
							>
								<span style="color: var(--text-secondary);">Tx hash</span>
								<button
									type="button"
									onclick={() =>
										navigator.clipboard?.writeText(selectedWithdrawal?.txHash ?? '')}
									style="font-family: var(--font-mono); font-size: 12px; color: var(--text-accent); background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px;"
								>
									{selectedWithdrawal.txHash}
									<ExternalLink size={14} strokeWidth={1.5} />
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
