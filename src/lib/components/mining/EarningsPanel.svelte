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

	// Tooltip state for earnings bar chart
	let earningsTooltip = $state<{ index: number; x: number } | null>(null);

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
		const barLabels = Array.from({ length: barCount }, (_, i) => {
			const daysAgo = (barCount - 1 - i) * bucketSize;
			const d = new Date(now.getTime() - daysAgo * 86400000);
			return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		});

		return { bars, maxVal, periodTotal, barCount, startLabel, barLabels };
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
	<div class="flex flex-col gap-4">
		<!-- Summary stats -->
		<div
			class="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded-[8px] overflow-hidden"
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
					class="bg-[var(--surface-1)] px-4 py-3.5 flex flex-col gap-1"
				>
					<span
						class="text-[10px] font-medium text-[var(--text-tertiary)] tracking-[0.02em] uppercase"
					>
						{stat.label}
					</span>
					<span
						class="text-[20px] font-semibold font-mono tracking-[-0.02em] leading-7 tabular-nums"
						style="color: {stat.color ?? 'var(--text-primary)'};"
					>
						{stat.value}
					</span>
					<span class="text-[10px] text-[var(--text-tertiary)] tracking-[0.02em]">
						{stat.sub ?? 'NECTA'}
					</span>
				</div>
			{/each}
		</div>

		<!-- Earnings chart with time range -->
		<div
			class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] overflow-hidden"
		>
			<div
				class="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between"
			>
				<span
					class="text-[11px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]"
				>
					Earnings Trend
				</span>
				<div class="flex gap-0.5 bg-[var(--surface-2)] rounded-[5px] p-0.5">
					{#each ['7d', '30d', '90d', 'all'] as range}
						<button
							type="button"
							onclick={() => (timeRange = range as TimeRange)}
							class="h-6 px-2 rounded text-[11px] font-medium border-none cursor-pointer transition-all duration-100"
							style="background: {timeRange ===
							range
								? 'var(--surface-1)'
								: 'transparent'}; color: {timeRange === range
								? 'var(--text-primary)'
								: 'var(--text-tertiary)'}; box-shadow: {timeRange === range
								? '0 1px 3px rgba(0,0,0,0.2)'
								: 'none'};"
						>
							{range === 'all' ? 'All' : range}
						</button>
					{/each}
				</div>
			</div>
			<div class="p-4">
				<div class="mb-3">
					<span
						class="text-[20px] font-semibold font-mono text-[var(--text-primary)] tracking-[-0.02em]"
					>
						{chartData.periodTotal.toFixed(2)}
					</span>
					<span class="text-[12px] text-[var(--text-tertiary)] ml-1.5"
						>NECTA</span
					>
				</div>
				<div class="relative h-[150px]">
					{#if earningsTooltip !== null}
						{@const tVal = chartData.bars[earningsTooltip.index]}
						{@const tLabel = chartData.barLabels[earningsTooltip.index]}
						<div
							class="absolute z-10 pointer-events-none bottom-full -translate-x-1/2 mb-1 whitespace-nowrap bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] font-mono"
							style="left: {earningsTooltip.x}px;"
						>
							<span class="text-[var(--text-tertiary)]">{tLabel}</span>: {tVal.toFixed(2)} NECTA
						</div>
					{/if}
					<div class="flex items-end gap-0.5 h-full">
						{#each chartData.bars as val, i}
							{@const h = val > 0 ? Math.max(4, (val / chartData.maxVal) * 140) : 2}
							<div
								role="img"
								aria-label="{chartData.barLabels[i]}: {val.toFixed(2)} NECTA"
								class="flex-1 rounded-t-sm transition-all cursor-default"
								style="height: {h}px; background: {earningsTooltip?.index === i ? 'var(--accent-base)' : i ===
								chartData.bars.length - 1
									? 'var(--accent-base)'
									: 'var(--accent-subtle)'};"
								onmouseenter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const parent = e.currentTarget.parentElement!.getBoundingClientRect(); earningsTooltip = { index: i, x: rect.left - parent.left + rect.width / 2 }; }}
								onmouseleave={() => { earningsTooltip = null; }}
							></div>
						{/each}
					</div>
				</div>
				<div class="flex justify-between mt-1.5">
					<span
						class="text-[10px] text-[var(--text-tertiary)] font-mono"
					>
						{chartData.startLabel}
					</span>
					<span
						class="text-[10px] text-[var(--text-tertiary)] font-mono"
					>
						Today
					</span>
				</div>
			</div>
		</div>

		<!-- Withdraw + Withdrawals -->
		<div class="mobile-stack grid gap-4" style="grid-template-columns: 1.2fr 1fr;">
			<!-- Withdraw form -->
			<div
				class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5"
			>
				<h3
					class="text-[14px] font-semibold text-[var(--text-primary)] mb-4"
				>
					Withdraw
				</h3>

				<!-- Amount -->
				<div class="mb-3">
					<label
						class="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5"
					>
						Amount
					</label>
					<div class="flex gap-1.5">
						<input
							type="number"
							bind:value={amount}
							placeholder="0.00"
							class="flex-1 h-9 px-2.5 text-[13px] font-mono bg-[var(--surface-0)] border border-[var(--border-default)] rounded-[5px] text-[var(--text-primary)] outline-none"
						/>
						<button
							type="button"
							onclick={() => (amount = availableBalance.toString())}
							class="h-9 px-3 text-[11px] font-medium bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[5px] text-[var(--text-secondary)] cursor-pointer"
						>
							Max
						</button>
					</div>
				</div>

				<!-- Destination -->
				<div class="mb-3">
					<label
						class="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-1.5"
					>
						Destination
					</label>
					<select
						bind:value={recipient}
						class="appearance-none w-full h-9 px-2.5 text-[12px] font-mono bg-[var(--surface-0)] border border-[var(--border-default)] rounded-[5px] text-[var(--text-primary)] outline-none cursor-pointer"
					>
						{#each savedRecipients as addr}
							<option value={addr}>{addr.slice(0, 10)}...{addr.slice(-6)}</option>
						{/each}
					</select>
				</div>

				<!-- Fee breakdown -->
				<div
					class="bg-[var(--surface-2)] p-3 rounded-[6px] border border-[var(--border-default)] mb-3"
				>
					{#each [
						{ label: 'Amount', value: `${parsedAmount.toFixed(2)} NECTA` },
						{ label: 'Network Fee', value: `${feeNecta.toFixed(4)} NECTA` },
						{ label: 'Gas', value: `${gasNecta.toFixed(2)} NECTA` }
					] as row}
						<div
							class="flex justify-between py-0.5 text-[12px]"
						>
							<span class="text-[var(--text-tertiary)]">{row.label}</span>
							<span
								class="text-[var(--text-primary)] font-mono"
								>{row.value}</span
							>
						</div>
					{/each}
					<div
						class="border-t border-[var(--border-default)] mt-1.5 pt-1.5 flex justify-between text-[13px]"
					>
						<span class="font-semibold text-[var(--text-primary)]">You Receive</span>
						<span
							class="font-semibold text-[var(--success)] font-mono"
							>{Math.max(0, parsedAmount - totalFees).toFixed(2)} NECTA</span
						>
					</div>
				</div>

				<!-- Withdraw button -->
				<button
					type="button"
					onclick={handleWithdraw}
					disabled={!$wallet || !canWithdraw}
					class="btn-subscribe w-full h-[38px] inline-flex items-center justify-center gap-1.5"
					style="opacity: {canWithdraw ? 1 : 0.4};"
				>
					<ArrowUpRight size={14} strokeWidth={2} />
					Withdraw
				</button>
			</div>

			<!-- Recent Withdrawals -->
			<div
				class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-5"
			>
				<div
					class="flex items-center justify-between mb-3"
				>
					<h3
						class="text-[14px] font-semibold text-[var(--text-primary)]"
					>
						Withdrawals
					</h3>
					{#if minerWithdrawals.length > 0}
						<button
							type="button"
							onclick={exportCsv}
							class="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] bg-transparent border-none cursor-pointer"
						>
							<Download size={12} strokeWidth={1.5} />
							CSV
						</button>
					{/if}
				</div>

				{#if minerWithdrawals.length === 0}
					<p class="text-[12px] text-[var(--text-tertiary)] text-center py-6">
						No withdrawals yet
					</p>
				{:else}
					<div class="flex flex-col gap-1.5">
						{#each minerWithdrawals.slice(0, 8) as w}
							{@const sc = statusColors[w.status] ?? statusColors.pending}
							<div
								onclick={() => (selectedWithdrawalId = selectedWithdrawalId === w.id ? null : w.id)}
								class="px-3 py-2.5 rounded-[6px] border border-[var(--border-default)] cursor-pointer transition-colors"
								style="background: {selectedWithdrawalId === w.id ? 'var(--surface-2)' : 'transparent'};"
								role="button"
								tabindex="0"
								onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectedWithdrawalId = selectedWithdrawalId === w.id ? null : w.id; }}
							>
								<div class="flex items-center justify-between">
									<span
										class="text-[13px] font-semibold font-mono text-[var(--text-primary)] tabular-nums"
										>{w.amount.toFixed(2)} NECTA</span
									>
									<span
										class="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-[3px]"
										style="background: {sc.bg}; color: {sc.color};"
										>{w.status}</span
									>
								</div>
								<span class="text-[10px] text-[var(--text-tertiary)]">
									{new Date(w.requestedAt).toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										year: 'numeric'
									})}
								</span>

								<!-- Expanded detail -->
								{#if selectedWithdrawalId === w.id}
									<div class="mt-2.5 pt-2.5 border-t border-[var(--border-default)] flex flex-col gap-1">
										{#each [
											{ label: 'Fee', value: `${w.fee.toFixed(4)} NECTA` },
											{ label: 'To', value: `${w.walletAddress.slice(0, 10)}...${w.walletAddress.slice(-6)}` },
											...(w.completedAt ? [{ label: 'Completed', value: new Date(w.completedAt).toLocaleDateString() }] : []),
											...(w.txHash ? [{ label: 'Tx', value: w.txHash.slice(0, 16) + '...' }] : [])
										] as row}
											<div class="flex justify-between text-[11px]">
												<span class="text-[var(--text-tertiary)]">{row.label}</span>
												<span class="text-[var(--text-secondary)] font-mono">{row.value}</span>
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
