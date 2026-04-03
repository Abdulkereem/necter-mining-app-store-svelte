<script lang="ts">
	import {
		Star,
		Shield,
		Share2,
		Flag,
		Play,
		Pause,
		Activity,
	} from 'lucide-svelte';

	const variantClasses: Record<string, string> = {
		neutral: 'bg-[var(--surface-3)] text-[var(--text-secondary)]',
		accent: 'bg-[var(--accent-subtle)] text-[var(--text-accent)]',
		success: 'bg-[rgba(76,183,130,0.12)] text-[var(--success)]',
		warning: 'bg-[rgba(242,153,74,0.12)] text-[var(--warning)]',
		error: 'bg-[rgba(235,87,87,0.12)] text-[var(--error)]',
		info: 'bg-[rgba(110,159,255,0.12)] text-[var(--info)]',
	};

	type MiningStatus = 'not-subscribed' | 'subscribed' | 'mining';
	type MiningStats = { tasksCompleted: number; earnings: number; uptime: number; proofs: number };

	let {
		app,
		appIconSrc,
		miningStatus,
		miningStats,
		stakeAmount,
		trustScore,
		listingStatus,
		developerVerificationStatus,
		onSubscribe,
		onStartMining,
		onStopMining,
		onPrimary,
		onShare,
		onReport,
	}: {
		app: any;
		appIconSrc: string;
		miningStatus: MiningStatus;
		miningStats: MiningStats;
		stakeAmount: number;
		trustScore: any;
		listingStatus: string;
		developerVerificationStatus: string;
		onSubscribe: () => void;
		onStartMining: () => void;
		onStopMining: () => void;
		onPrimary: () => void;
		onShare: () => void;
		onReport: () => void;
	} = $props();

	function getTrustLabel(score: number) {
		if (score >= 90) return 'Platinum';
		if (score >= 80) return 'Gold';
		if (score >= 70) return 'Verified';
		return 'Unverified';
	}

	function getTrustVariant(score: number): string {
		if (score >= 90) return 'success';
		if (score >= 75) return 'warning';
		return 'error';
	}
</script>

<div class="mb-5 md:mb-7">
	<div class="flex gap-3 md:gap-4 items-center">
		<!-- Icon -->
		<div class="shrink-0">
			<img
				src={appIconSrc}
				alt={app.name}
				width="48"
				height="48"
				class="rounded-[10px] block w-12 h-12 md:w-16 md:h-16 md:rounded-[12px]"
			/>
		</div>

		<!-- Name + developer + rating -->
		<div class="flex-1 min-w-0">
			<h1
				class="text-[18px] md:text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] m-0 leading-6 md:leading-8 truncate"
			>
				{app.name}
			</h1>
			<a
				href="/profiles/{app.developerAddress}"
				class="text-[12px] md:text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-colors mt-0.5 block no-underline truncate"
			>
				{app.developer}
			</a>
			<div class="flex items-center gap-[3px] mt-1 overflow-hidden">
				{#each Array(5) as _, i}
					<Star
						size={10}
						strokeWidth={0}
						fill={i < Math.round(app.averageRating || 4.5) ? 'var(--accent-base)' : 'var(--surface-3)'}
						class="shrink-0"
					/>
				{/each}
				<span class="text-[11px] text-[var(--text-tertiary)] font-mono ml-1 shrink-0"
					>{(app.averageRating || 4.5).toFixed(1)}</span
				>
				<span class="text-[11px] text-[var(--text-tertiary)] ml-1 truncate">· {app.category}</span>
			</div>
		</div>

		<!-- CTA + share -- mobile only -->
		<div class="flex md:hidden items-center gap-2 shrink-0">
			{#if miningStatus === 'not-subscribed'}
				<button class="btn-subscribe font-semibold" onclick={onSubscribe}>Subscribe</button>
			{/if}
			{#if miningStatus === 'subscribed'}
				<button
					class="inline-flex items-center gap-1 h-8 px-3 rounded-[6px] border border-[var(--success)] bg-[rgba(76,183,130,0.12)] text-[var(--success)] text-[12px] font-semibold cursor-pointer"
					onclick={onStartMining}
				>
					<Play size={11} /> Start
				</button>
			{/if}
			{#if miningStatus === 'mining'}
				<button
					class="inline-flex items-center gap-1 h-8 px-3 rounded-[6px] border border-[var(--error)] bg-[rgba(235,87,87,0.12)] text-[var(--error)] text-[12px] font-semibold cursor-pointer"
					onclick={onStopMining}
				>
					<Pause size={11} /> Stop
				</button>
			{/if}
			<button
				class="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-2)] cursor-pointer"
				onclick={onShare}
			>
				<Share2 size={14} strokeWidth={1.5} class="text-[var(--text-secondary)]" />
			</button>
		</div>
	</div>

	<!-- Badges + Share + Report -- desktop only -->
	<div class="hidden md:flex items-center gap-2 mt-3 flex-wrap">
		<span
			class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.accent}"
			>{app.category}</span
		>
		{#if app.attestations > 0}
			<span class="inline-flex items-center gap-1 h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap bg-[rgba(255,191,0,0.06)] text-[var(--text-accent)]">
				<Shield size={10} strokeWidth={2} /> {app.attestations} verified
			</span>
		{/if}
		{#if trustScore}
			<span
				class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses[getTrustVariant(trustScore.overallScore)]}"
				>{getTrustLabel(trustScore.overallScore)}</span
			>
		{/if}
		<span
			class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses[developerVerificationStatus === 'verified' ? 'success' : developerVerificationStatus === 'pending' ? 'warning' : 'neutral']}"
		>
			{developerVerificationStatus === 'verified'
				? 'Verified Dev'
				: developerVerificationStatus === 'pending'
					? 'Verification Pending'
					: 'Unverified'}
		</span>
		{#if listingStatus === 'beta'}
			<span
				class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.warning}"
				>Beta</span
			>
		{/if}
		<div class="flex-1"></div>
		<button
			onclick={onPrimary}
			class="inline-flex items-center gap-1 h-7 px-[10px] rounded-[5px] text-[12px] font-semibold cursor-pointer border-0
				{miningStatus === 'not-subscribed'
				? 'bg-[var(--accent-base)] text-[#0C0C0E]'
				: miningStatus === 'subscribed'
					? 'bg-[var(--success)] text-[#0C0C0E]'
					: 'bg-[var(--error)] text-white'}"
		>
			{#if miningStatus === 'not-subscribed'}Subscribe{:else if miningStatus === 'subscribed'}Start Mining{:else}Stop Mining{/if}
		</button>
		<button
			onclick={onShare}
			class="inline-flex items-center gap-1 h-7 px-[10px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] cursor-pointer"
		>
			<Share2 size={12} strokeWidth={1.5} />
			Share
		</button>
		<button
			onclick={onReport}
			class="inline-flex items-center gap-1 h-7 px-[10px] rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-tertiary)] text-[12px] cursor-pointer"
		>
			<Flag size={12} strokeWidth={1.5} />
			Report
		</button>
	</div>

	<!-- Status hint -- desktop only -->
	<p class="hidden md:block text-[12px] text-[var(--text-tertiary)] mt-2">
		{#if miningStatus === 'not-subscribed'}Subscribe to run guided node setup, then jobs and proofs start flowing.{/if}
		{#if miningStatus === 'subscribed'}Node configured. Start mining to queue jobs and generate proofs.{/if}
		{#if miningStatus === 'mining'}Mining active. Jobs queued, proofs verified, rewards credited.{/if}
	</p>
</div>

<!-- Quick Stats Row -->
<div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-8">
	<div
		class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1"
	>
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Earnings / Day</p>
		<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
			${app.avgEarningsPerDay.toFixed(2)}
		</p>
		<p class="text-[11px] text-[var(--text-tertiary)]">avg per miner</p>
	</div>
	<div
		class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1"
	>
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Stake Required</p>
		<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
			{stakeAmount > 0 ? `${stakeAmount.toLocaleString()} NCT` : 'None'}
		</p>
		<p class="text-[11px] text-[var(--text-tertiary)]">{stakeAmount > 0 ? 'slashing applies' : 'no stake needed'}</p>
	</div>
	<div
		class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1"
	>
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Miners</p>
		<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
			{app.totalMiners >= 1000 ? `${(app.totalMiners / 1000).toFixed(1)}K` : app.totalMiners}
		</p>
		<p class="text-[11px] text-[var(--text-tertiary)]">active nodes</p>
	</div>
	<div
		class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1"
	>
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Uptime SLA</p>
		<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
			{app.slaRequirements?.minUptime ?? 95}%
		</p>
		<p class="text-[11px] text-[var(--text-tertiary)]">minimum required</p>
	</div>
	<div
		class="bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-4 py-[14px] flex flex-col gap-1"
	>
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)]">Attestations</p>
		<p class="text-[16px] font-semibold text-[var(--text-primary)] font-mono [font-feature-settings:'tnum']">
			{app.attestations}
		</p>
		<p class="text-[11px] text-[var(--text-tertiary)]">on-chain verified</p>
	</div>
</div>

<!-- Active Mining Status Banner -->
{#if miningStatus !== 'not-subscribed'}
	<div
		class="rounded-[8px] px-4 md:px-5 py-4 mb-7"
		style="background: {miningStatus === 'mining'
			? 'rgba(76,183,130,0.06)'
			: 'rgba(242,153,74,0.06)'}; border: 1px solid {miningStatus === 'mining'
			? 'rgba(76,183,130,0.20)'
			: 'rgba(242,153,74,0.20)'};"
	>
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-2">
				<span
					class={miningStatus === 'mining' ? 'status-dot status-dot-active' : 'status-dot status-dot-proving'}
				></span>
				<span
					class="text-[13px] font-semibold"
					style="color: {miningStatus === 'mining' ? 'var(--success)' : 'var(--warning)'}"
				>
					{miningStatus === 'mining' ? 'Mining Active' : 'Subscribed, Ready to Start'}
				</span>
			</div>
			<span
				class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses[miningStatus === 'mining' ? 'success' : 'warning']}"
			>
				<Activity size={10} class="mr-1" />
				{miningStatus === 'mining' ? 'Live' : 'Idle'}
			</span>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
			{#each [
				{ label: 'Tasks Done', value: miningStats.tasksCompleted },
				{ label: 'Earned', value: `$${miningStats.earnings.toFixed(2)}` },
				{ label: 'Uptime', value: `${miningStats.uptime.toFixed(1)}%` },
				{ label: 'Proofs', value: miningStats.proofs },
			] as s}
				<div class="bg-[var(--surface-0)] border border-[var(--border-default)] rounded-[6px] px-[14px] py-[10px]">
					<p class="text-[18px] font-semibold text-[var(--text-primary)] font-mono">{s.value}</p>
					<p class="text-[11px] text-[var(--text-tertiary)] mt-0.5">{s.label}</p>
				</div>
			{/each}
		</div>

		{#if miningStatus === 'subscribed'}
			<p class="text-[12px] text-[var(--warning)] bg-[rgba(242,153,74,0.10)] rounded-[5px] px-3 py-2 mb-3">
				Click "Start" to begin earning rewards. Confirm your hardware meets requirements below.
			</p>
		{/if}

		<div class="flex gap-2 flex-wrap">
			<a
				href="/mining"
				class="inline-flex items-center h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
				>Mining Dashboard</a
			>
			<a
				href="/mining?tab=proofs"
				class="inline-flex items-center h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
				>Proof Queue</a
			>
			<a
				href="/mining/earnings"
				class="inline-flex items-center h-8 px-3 rounded-[5px] border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-[12px] no-underline"
				>Earnings</a
			>
			{#if miningStatus === 'subscribed'}
				<button
					onclick={onStartMining}
					class="inline-flex items-center gap-1 h-8 px-3 rounded-[5px] bg-[var(--success)] text-[#0C0C0E] text-[12px] font-semibold cursor-pointer border-0"
				>
					<Play size={11} />
					Start jobs
				</button>
			{/if}
		</div>
	</div>
{/if}
