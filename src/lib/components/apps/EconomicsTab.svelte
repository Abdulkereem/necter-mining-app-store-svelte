<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import type { Project, ProjectEconomics, ProjectStats } from '$lib/api/types';
	import { addressUrl, bpToPercent, formatAmount, formatDuration, formatMs, formatNumber, isAmount, rewardModelLabel, shortAddress } from '$lib/format';

	/** Collateral is always bonded in NECTA (18 decimals) on the Staking contract. */
	const NECTA = { symbol: 'NECTA', decimals: 18 };

	let {
		project,
		economics,
		stats,
		explorer
	}: {
		project: Project;
		economics: ProjectEconomics | null;
		stats: ProjectStats | null;
		explorer: string;
	} = $props();

	let hoursPerDay = $state(24);

	const manifestEco = $derived(project.consensus.economics);
	const token = $derived(economics?.token ?? project.token);
	const fmt = (wei: string | null | undefined, frac = 4) =>
		isAmount(wei) ? `${formatAmount(wei, token.decimals, { maxFrac: frac })} ${token.symbol}` : '—';
	const fmtNecta = (wei: string | null | undefined) =>
		isAmount(wei) ? `${formatAmount(wei, NECTA.decimals, { maxFrac: 4 })} ${NECTA.symbol}` : '—';

	const avgDaily = $derived.by(() => {
		const v = stats?.avg_daily_reward_per_miner ?? project.avg_daily_reward_per_miner;
		return isAmount(v) && v !== '0' ? BigInt(v) : null;
	});
	const estDaily = $derived(avgDaily === null ? null : (avgDaily * BigInt(hoursPerDay)) / 24n);
	const estMonthly = $derived(estDaily === null ? null : estDaily * 30n);
	const estYearly = $derived(estDaily === null ? null : estDaily * 365n);

	const split = $derived(economics?.fee_split_bp ?? manifestEco.fee_split_bp);
	const slashing = $derived(economics?.slashing_bp ?? manifestEco.slashing_bp);
	const vault = $derived(economics?.vault ?? null);
	const vaultAddress = $derived(vault?.address ?? project.vault ?? null);

	const rewardRows = $derived([
		{ label: 'Model', value: rewardModelLabel(economics?.reward_model ?? manifestEco.reward_model) },
		{ label: 'Reward token', value: token.name ? `${token.symbol} (${token.name})` : token.symbol },
		{ label: 'Reward per unit', value: fmt(economics?.reward_per_unit ?? manifestEco.reward_per_unit, 6) },
		{ label: 'Daily emission', value: fmt(economics?.daily_emission ?? manifestEco.daily_emission) },
		{ label: 'Epoch length', value: formatDuration(economics?.epoch_secs ?? project.consensus.work.epoch_secs) },
		{ label: 'Epoch cap', value: fmt(economics?.epoch_cap) },
		{ label: 'Miner split', value: bpToPercent(split.miner) },
		{ label: 'Developer split', value: bpToPercent(split.developer) },
		{ label: 'Treasury split', value: bpToPercent(split.treasury) }
	]);

	const slaRows = $derived([
		{ label: 'Minimum collateral', value: fmtNecta(economics?.min_collateral ?? manifestEco.min_collateral) },
		{ label: 'Minimum uptime required', value: bpToPercent(project.scheduling.sla.min_uptime_bp) },
		{ label: 'Max latency', value: formatMs(project.scheduling.sla.max_latency_ms) },
		{ label: 'Slashing — invalid result', value: bpToPercent(slashing.invalid_result) },
		{ label: 'Slashing — missed SLA', value: bpToPercent(slashing.missed_sla) },
		{ label: 'Dispute window', value: formatDuration(economics?.dispute_window_secs ?? project.consensus.work.dispute_window_secs) }
	]);

	const vaultRows = $derived(
		vault
			? [
					{ label: 'Balance', value: fmt(vault.balance) },
					{ label: 'Reserved for payouts', value: fmt(vault.reserved) },
					{ label: 'Runway', value: vault.runway_days != null ? `${formatNumber(vault.runway_days, 1)} days` : '—' },
					{ label: 'Paid to date', value: fmt(vault.total_paid) }
				]
			: []
	);
</script>

<div class="flex flex-col gap-4">
	<!-- Earnings Estimator -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Earnings Estimator</p>
		{#if avgDaily === null}
			<p class="text-[12px] text-[var(--text-tertiary)] m-0">
				No reward history yet. Estimates appear once miners have been paid for at least one epoch.
			</p>
		{:else}
			<p class="text-[12px] text-[var(--text-tertiary)] mb-4">Scales the recent average reward per miner by your hours online per day.</p>
			<div class="flex flex-col gap-3">
				<div class="flex items-center gap-3">
					<label for="hours-slider" class="text-[13px] text-[var(--text-secondary)] shrink-0 w-[120px]">Hours / day</label>
					<input
						id="hours-slider"
						type="range"
						min="1"
						max="24"
						step="1"
						bind:value={hoursPerDay}
						class="flex-1 accent-[var(--accent-base)]"
					/>
					<span class="text-[13px] font-mono text-[var(--text-primary)] w-[36px] text-right">{hoursPerDay}h</span>
				</div>
				<div class="grid grid-cols-3 gap-2">
					{#each [
						{ v: estDaily, l: 'per day' },
						{ v: estMonthly, l: 'per month' },
						{ v: estYearly, l: 'per year' }
					] as e (e.l)}
						<div class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[6px] px-3 py-[10px] text-center min-w-0">
							<p class="text-[16px] font-semibold text-[var(--text-accent)] font-mono truncate">
								{formatAmount(e.v, token.decimals, { maxFrac: 2, compact: true })}
							</p>
							<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">{token.symbol} {e.l}</p>
						</div>
					{/each}
				</div>
				<p class="text-[11px] text-[var(--text-tertiary)]">
					Based on the recent average of {formatAmount(avgDaily, token.decimals, { maxFrac: 4 })}
					{token.symbol} per miner per day{stats?.period ? ` (${stats.period})` : ''}. This is not a promise: rewards depend on the rounds
					your device is assigned, its uptime and how many miners share the epoch.
				</p>
			</div>
		{/if}
	</div>

	<!-- Reward Structure -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Reward Structure</p>
		<div class="flex flex-col gap-2">
			{#each rewardRows as row (row.label)}
				<div class="flex justify-between items-center gap-3 py-2 border-b border-[var(--border-default)]">
					<span class="text-[13px] text-[var(--text-tertiary)]">{row.label}</span>
					<span class="text-[13px] text-[var(--text-primary)] font-mono [font-feature-settings:'tnum'] text-right break-all">{row.value}</span>
				</div>
			{/each}
		</div>
		<p class="text-[12px] text-[var(--text-tertiary)] mt-3">
			Rewards are paid per epoch from the project's vault and claimed gaslessly with a Merkle proof.
		</p>
	</div>

	<!-- Vault -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
		<div class="flex items-center justify-between gap-3 mb-3">
			<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] m-0">Reward Vault</p>
			{#if vaultAddress}
				<a
					href={addressUrl(vaultAddress, explorer)}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-accent)] no-underline"
				>
					{shortAddress(vaultAddress)}
					<ExternalLink size={10} strokeWidth={1.5} />
				</a>
			{/if}
		</div>
		{#if vault && vault.deployed === false}
			<p class="text-[12px] text-[var(--warning)] bg-[rgba(242,153,74,0.10)] rounded-[5px] px-3 py-2 m-0">
				The vault is not deployed yet. Rewards start once the developer funds it.
			</p>
		{:else if vaultRows.length > 0}
			<div class="flex flex-col gap-2">
				{#each vaultRows as row (row.label)}
					<div class="flex justify-between items-center gap-3 py-2 border-b border-[var(--border-default)]">
						<span class="text-[13px] text-[var(--text-tertiary)]">{row.label}</span>
						<span class="text-[13px] text-[var(--text-primary)] font-mono [font-feature-settings:'tnum'] text-right">{row.value}</span>
					</div>
				{/each}
			</div>
			{#if vault?.config_matches_manifest === false}
				<p class="text-[12px] text-[var(--warning)] mt-3 m-0">The vault's on-chain config doesn't match the published manifest.</p>
			{/if}
		{:else}
			<p class="text-[12px] text-[var(--text-tertiary)] m-0">Vault figures are unavailable right now.</p>
		{/if}
	</div>

	<!-- SLA -->
	<div class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5">
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">Collateral, SLA & Penalties</p>
		<div class="flex flex-col gap-2">
			{#each slaRows as row (row.label)}
				<div class="flex justify-between gap-3 py-2 border-b border-[var(--border-default)]">
					<span class="text-[13px] text-[var(--text-tertiary)]">{row.label}</span>
					<span class="text-[13px] text-[var(--text-primary)] font-mono text-right">{row.value}</span>
				</div>
			{/each}
		</div>
		<p class="text-[12px] text-[var(--text-tertiary)] mt-3">
			Slashing takes the stated share of your bonded collateral. Slashes can be disputed within the dispute window.
		</p>
	</div>
</div>
