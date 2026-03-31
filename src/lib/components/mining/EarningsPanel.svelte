<script lang="ts">
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, wallet, showConnectModal } from '$lib/stores/wallet';
	import { ArrowUpRight, Download } from 'lucide-svelte';

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
		minerId
			? $backendState.withdrawals
					.filter((w) => w.minerId === minerId)
					.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
			: []
	);

	const statusColors: Record<string, { color: string; bg: string }> = {
		completed: { color: 'var(--success)', bg: 'rgba(76,183,130,0.12)' },
		pending: { color: 'var(--warning)', bg: 'rgba(242,153,74,0.12)' },
		processing: { color: 'var(--info)', bg: 'rgba(110,159,255,0.12)' },
		failed: { color: 'var(--error)', bg: 'rgba(239,68,68,0.12)' }
	};

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
</script>

{#if !$actor || !$wallet}
	<!-- Hidden when no wallet -->
{:else}
	<div style="display: flex; flex-direction: column; gap: 16px;">
		<!-- Summary stats -->
		<div
			class="grid grid-cols-2 md:grid-cols-4"
			style="gap: 1px; background: var(--border-default); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
		>
			{#each [
				{
					label: 'Available',
					value: availableBalance.toFixed(2),
					sub: `≈ $${(availableBalance * NECTA_USD).toFixed(2)}`,
					color: 'var(--success)'
				},
				{
					label: 'Total Earned',
					value: totalEarned.toFixed(2),
					sub: `≈ $${(totalEarned * NECTA_USD).toFixed(2)}`,
					color: null
				},
				{
					label: 'Pending',
					value: pendingRewards.toFixed(2),
					sub: `≈ $${(pendingRewards * NECTA_USD).toFixed(2)}`,
					color: null
				},
				{ label: 'This Month', value: thisMonth().toFixed(2), sub: 'NECTA', color: null }
			] as stat}
				<div
					style="background: var(--surface-1); padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;"
				>
					<span
						style="font-size: 10px; font-weight: 500; color: var(--text-tertiary); letter-spacing: 0.02em; text-transform: uppercase;"
					>
						{stat.label}
					</span>
					<span
						style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: {stat.color ?? 'var(--text-primary)'}; letter-spacing: -0.02em; line-height: 28px; font-feature-settings: 'tnum' 1;"
					>
						{stat.value}
					</span>
					<span style="font-size: 10px; color: var(--text-tertiary); letter-spacing: 0.02em;">
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
				style="padding: 12px 16px; border-bottom: 1px solid var(--border-default); display: flex; align-items: center; justify-content: space-between;"
			>
				<span
					style="font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-tertiary);"
				>
					Earnings Trend
				</span>
				<div style="display: flex; gap: 2px; background: var(--surface-2); border-radius: 5px; padding: 2px;">
					{#each ['7d', '30d', '90d', 'all'] as range}
						<button
							type="button"
							onclick={() => (timeRange = range as TimeRange)}
							style="height: 24px; padding: 0 8px; border-radius: 4px; font-size: 11px; font-weight: 500; border: none; cursor: pointer; background: {timeRange ===
							range
								? 'var(--surface-1)'
								: 'transparent'}; color: {timeRange === range
								? 'var(--text-primary)'
								: 'var(--text-tertiary)'}; box-shadow: {timeRange === range
								? '0 1px 3px rgba(0,0,0,0.2)'
								: 'none'}; transition: background 100ms ease-out, color 100ms ease-out;"
						>
							{range === 'all' ? 'All' : range}
						</button>
					{/each}
				</div>
			</div>
			<div style="padding: 16px;">
				<div style="margin-bottom: 12px;">
					<span
						style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: var(--text-primary); letter-spacing: -0.02em;"
					>
						{chartData.periodTotal.toFixed(2)}
					</span>
					<span style="font-size: 12px; color: var(--text-tertiary); margin-left: 6px;"
						>NECTA</span
					>
				</div>
				<div style="display: flex; align-items: flex-end; gap: 2px; height: 150px;">
					{#each chartData.bars as val, i}
						{@const h = val > 0 ? Math.max(4, (val / chartData.maxVal) * 140) : 2}
						<div
							title="{val.toFixed(2)} NECTA"
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
		<div class="mobile-stack" style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px;">
			<!-- Withdraw form -->
			<div
				style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;"
			>
				<h3
					style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px;"
				>
					Withdraw
				</h3>

				<!-- Amount -->
				<div style="margin-bottom: 12px;">
					<label
						style="display: block; font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;"
					>
						Amount
					</label>
					<div style="display: flex; gap: 6px;">
						<input
							type="number"
							bind:value={amount}
							placeholder="0.00"
							style="flex: 1; height: 36px; padding: 0 10px; font-size: 13px; font-family: var(--font-mono); background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 5px; color: var(--text-primary); outline: none;"
						/>
						<button
							type="button"
							onclick={() => (amount = availableBalance.toString())}
							style="height: 36px; padding: 0 12px; font-size: 11px; font-weight: 500; background: var(--surface-2); border: 1px solid var(--border-default); border-radius: 5px; color: var(--text-secondary); cursor: pointer;"
						>
							Max
						</button>
					</div>
				</div>

				<!-- Destination -->
				<div style="margin-bottom: 12px;">
					<label
						style="display: block; font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;"
					>
						Destination
					</label>
					<select
						bind:value={recipient}
						style="appearance: none; width: 100%; height: 36px; padding: 0 10px; font-size: 12px; font-family: var(--font-mono); background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 5px; color: var(--text-primary); outline: none; cursor: pointer;"
					>
						{#each savedRecipients as addr}
							<option value={addr}>{addr.slice(0, 10)}...{addr.slice(-6)}</option>
						{/each}
					</select>
				</div>

				<!-- Fee breakdown -->
				<div
					style="background: var(--surface-2); padding: 12px; border-radius: 6px; border: 1px solid var(--border-default); margin-bottom: 12px;"
				>
					{#each [
						{ label: 'Amount', value: `${parsedAmount.toFixed(2)} NECTA` },
						{ label: 'Network Fee', value: `${feeNecta.toFixed(4)} NECTA` },
						{ label: 'Gas', value: `${gasNecta.toFixed(2)} NECTA` }
					] as row}
						<div
							style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px;"
						>
							<span style="color: var(--text-tertiary);">{row.label}</span>
							<span
								style="color: var(--text-primary); font-family: var(--font-mono);"
								>{row.value}</span
							>
						</div>
					{/each}
					<div
						style="border-top: 1px solid var(--border-default); margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between; font-size: 13px;"
					>
						<span style="font-weight: 600; color: var(--text-primary);">You Receive</span>
						<span
							style="font-weight: 600; color: var(--success); font-family: var(--font-mono);"
							>{Math.max(0, parsedAmount - totalFees).toFixed(2)} NECTA</span
						>
					</div>
				</div>

				<!-- Withdraw button -->
				<button
					type="button"
					onclick={handleWithdraw}
					disabled={!$wallet || !canWithdraw}
					class="btn-subscribe"
					style="width: 100%; height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; opacity: {canWithdraw ? 1 : 0.4};"
				>
					<ArrowUpRight size={14} strokeWidth={2} />
					Withdraw
				</button>
			</div>

			<!-- Recent Withdrawals -->
			<div
				style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;"
			>
				<div
					style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;"
				>
					<h3
						style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0;"
					>
						Withdrawals
					</h3>
					{#if minerWithdrawals.length > 0}
						<button
							type="button"
							onclick={exportCsv}
							style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-tertiary); background: transparent; border: none; cursor: pointer;"
						>
							<Download size={12} strokeWidth={1.5} />
							CSV
						</button>
					{/if}
				</div>

				{#if minerWithdrawals.length === 0}
					<p style="font-size: 12px; color: var(--text-tertiary); text-align: center; padding: 24px 0;">
						No withdrawals yet
					</p>
				{:else}
					<div style="display: flex; flex-direction: column; gap: 6px;">
						{#each minerWithdrawals.slice(0, 8) as w}
							{@const sc = statusColors[w.status] ?? statusColors.pending}
							<div
								onclick={() => (selectedWithdrawalId = selectedWithdrawalId === w.id ? null : w.id)}
								style="padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-default); cursor: pointer; transition: background 100ms; background: {selectedWithdrawalId === w.id ? 'var(--surface-2)' : 'transparent'};"
								role="button"
								tabindex="0"
								onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectedWithdrawalId = selectedWithdrawalId === w.id ? null : w.id; }}
							>
								<div style="display: flex; align-items: center; justify-content: space-between;">
									<span
										style="font-size: 13px; font-weight: 600; font-family: var(--font-mono); color: var(--text-primary); font-feature-settings: 'tnum' 1;"
										>{w.amount.toFixed(2)} NECTA</span
									>
									<span
										style="font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; background: {sc.bg}; color: {sc.color};"
										>{w.status}</span
									>
								</div>
								<span style="font-size: 10px; color: var(--text-tertiary);">
									{new Date(w.requestedAt).toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										year: 'numeric'
									})}
								</span>

								<!-- Expanded detail -->
								{#if selectedWithdrawalId === w.id}
									<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-default); display: flex; flex-direction: column; gap: 4px;">
										{#each [
											{ label: 'Fee', value: `${w.fee.toFixed(4)} NECTA` },
											{ label: 'To', value: `${w.walletAddress.slice(0, 10)}...${w.walletAddress.slice(-6)}` },
											...(w.completedAt ? [{ label: 'Completed', value: new Date(w.completedAt).toLocaleDateString() }] : []),
											...(w.txHash ? [{ label: 'Tx', value: w.txHash.slice(0, 16) + '...' }] : [])
										] as row}
											<div style="display: flex; justify-content: space-between; font-size: 11px;">
												<span style="color: var(--text-tertiary);">{row.label}</span>
												<span style="color: var(--text-secondary); font-family: var(--font-mono);">{row.value}</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
