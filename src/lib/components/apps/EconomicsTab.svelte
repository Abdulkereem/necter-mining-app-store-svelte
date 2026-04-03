<script lang="ts">
	let {
		app,
		hoursPerDay = $bindable(24),
		estimatedDaily,
		estimatedMonthly,
		estimatedYearly,
		pricingModel,
		baseRewardPerTask,
		minRewardPerTask,
		maxRewardPerTask,
		feeMinerPct,
		feeDevPct,
		feeTreasuryPct,
		feeValid,
	}: {
		app: any;
		hoursPerDay: number;
		estimatedDaily: number;
		estimatedMonthly: number;
		estimatedYearly: number;
		pricingModel: string | null;
		baseRewardPerTask: number | null;
		minRewardPerTask: number | null;
		maxRewardPerTask: number | null;
		feeMinerPct: number;
		feeDevPct: number;
		feeTreasuryPct: number;
		feeValid: boolean;
	} = $props();
</script>

<div class="flex flex-col gap-4">
	<!-- Earnings Estimator -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
			Earnings Estimator
		</p>
		<p class="text-[12px] text-[var(--text-tertiary)] mb-4">
			Estimate your potential earnings based on hours online per day.
		</p>
		<div class="flex flex-col gap-3">
			<div class="flex items-center gap-3">
				<label for="hours-slider" class="text-[13px] text-[var(--text-secondary)] shrink-0 w-[120px]"
					>Hours / day</label
				>
				<input
					id="hours-slider"
					type="range"
					min="1"
					max="24"
					step="1"
					bind:value={hoursPerDay}
					class="flex-1 accent-[var(--accent-base)]"
				/>
				<span class="text-[13px] font-mono text-[var(--text-primary)] w-[36px] text-right"
					>{hoursPerDay}h</span
				>
			</div>
			<div class="grid grid-cols-3 gap-2">
				<div
					class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[6px] px-3 py-[10px] text-center"
				>
					<p class="text-[16px] font-semibold text-[var(--text-accent)] font-mono">
						${estimatedDaily.toFixed(2)}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">per day</p>
				</div>
				<div
					class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[6px] px-3 py-[10px] text-center"
				>
					<p class="text-[16px] font-semibold text-[var(--text-accent)] font-mono">
						${estimatedMonthly.toFixed(0)}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">per month</p>
				</div>
				<div
					class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[6px] px-3 py-[10px] text-center"
				>
					<p class="text-[16px] font-semibold text-[var(--text-accent)] font-mono">
						${estimatedYearly.toFixed(0)}
					</p>
					<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">per year</p>
				</div>
			</div>
			<p class="text-[11px] text-[var(--text-tertiary)]">
				Estimates based on average {app.rewardToken} earnings. Actual results vary by hardware and network
				conditions.
			</p>
		</div>
	</div>

	<!-- Reward Structure -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
			Reward Structure
		</p>
		<div class="flex flex-col gap-2">
			{#each [
				{ label: 'Model', value: app.rewardModel },
				{ label: 'Pricing', value: pricingModel ?? 'fixed' },
				...(baseRewardPerTask != null
					? [
							{
								label: 'Per-Task Reward',
								value: `${baseRewardPerTask.toFixed(4)} ${app.rewardToken}${minRewardPerTask != null && maxRewardPerTask != null ? ` (${minRewardPerTask.toFixed(4)}--${maxRewardPerTask.toFixed(4)})` : ''}`,
							},
						]
					: []),
				{ label: 'Miner Split', value: `${feeValid ? feeMinerPct : 80}%` },
				{ label: 'Developer Split', value: `${feeValid ? feeDevPct : 15}%` },
				{ label: 'Treasury Split', value: `${feeValid ? feeTreasuryPct : 5}%` },
				{ label: 'Daily Average', value: `$${app.avgEarningsPerDay.toFixed(2)} / miner` },
				{
					label: 'Monthly Average',
					value: `$${(app.avgEarningsPerDay * 30).toFixed(2)} / miner`,
				},
			] as row}
				<div class="flex justify-between items-center py-2 border-b border-[var(--border-default)]">
					<span class="text-[13px] text-[var(--text-tertiary)]">{row.label}</span>
					<span class="text-[13px] text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']"
						>{row.value}</span
					>
				</div>
			{/each}
		</div>
		<p class="text-[12px] text-[var(--text-tertiary)] mt-3">
			Payouts secured via JobEscrow. Top miners may receive a progressive pool bonus.
		</p>
	</div>

	<!-- Reward Tiers -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
			Reward Tiers
		</p>
		<p class="text-[12px] text-[var(--text-tertiary)] mb-3">
			Progressive reward pools incentivize top-performing miners with higher multipliers.
		</p>
		<div class="flex flex-col">
			{#each [
				{
					tier: 'Tier 1',
					range: 'Top 10%',
					multiplier: '1.5x',
					color: 'var(--text-accent)',
					bg: 'var(--accent-subtle)',
				},
				{
					tier: 'Tier 2',
					range: 'Top 25%',
					multiplier: '1.25x',
					color: 'var(--success)',
					bg: 'rgba(76,183,130,0.12)',
				},
				{
					tier: 'Tier 3',
					range: 'Top 50%',
					multiplier: '1.0x',
					color: 'var(--text-primary)',
					bg: 'var(--surface-3)',
				},
				{
					tier: 'Tier 4',
					range: 'Bottom 50%',
					multiplier: '0.85x',
					color: 'var(--text-secondary)',
					bg: 'var(--surface-3)',
				},
			] as t, i}
				<div
					class="flex items-center justify-between py-[10px] {i < 3
						? 'border-b border-[var(--border-default)]'
						: ''}"
				>
					<div class="flex items-center gap-3">
						<span
							class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap"
							style="background: {t.bg}; color: {t.color};"
						>
							{t.tier}
						</span>
						<span class="text-[13px] text-[var(--text-tertiary)]">{t.range}</span>
					</div>
					<div class="flex items-center gap-4">
						<span
							class="text-[13px] font-semibold font-mono [font-feature-settings:'tnum']"
							style="color: {t.color};"
						>
							{t.multiplier}
						</span>
						<span
							class="text-[12px] text-[var(--text-tertiary)] font-mono [font-feature-settings:'tnum'] w-[90px] text-right"
						>
							~${(app.avgEarningsPerDay * parseFloat(t.multiplier.replace('x', ''))).toFixed(2)}/day
						</span>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- SLA -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
			SLA & Penalties
		</p>
		<div class="flex flex-col gap-2">
			{#each [
				{
					label: 'Minimum Uptime Required',
					value: `${app.slaRequirements?.minUptime || 95}%`,
				},
				{
					label: 'Slashing Penalty',
					value: `${app.slaRequirements?.slashingPenalty || 5}%`,
				},
				{ label: 'Max Latency', value: `${app.slaRequirements?.maxLatency || 500}ms` },
			] as row}
				<div class="flex justify-between py-2 border-b border-[var(--border-default)]">
					<span class="text-[13px] text-[var(--text-tertiary)]">{row.label}</span>
					<span class="text-[13px] text-[var(--text-primary)] font-mono">{row.value}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
