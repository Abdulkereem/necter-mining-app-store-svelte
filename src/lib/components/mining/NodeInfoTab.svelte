<script lang="ts">
	import type { App, Subscription, ProofSubmission } from '$lib/types';
	import type { MiningJob } from '$lib/mock-backend/types';
	import { CheckCircle2, Download } from 'lucide-svelte';
	import AreaChart from '$lib/components/AreaChart.svelte';

	let {
		subscription,
		app,
		proofsForApp,
		verifiedProofs,
		pendingProofs,
		rejectedProofs,
		totalEarnedNecta,
		pendingRewardsNecta,
		successRate,
		mockJobsForSubscription,
		mockJobsQueued,
		mockJobsRunning,
		mockJobsCompleted,
		recentEvents,
		perfChartData,
		metric,
		range,
		onMetricChange,
		onRangeChange,
		timeAgo
	}: {
		subscription: Subscription;
		app: App;
		proofsForApp: ProofSubmission[];
		verifiedProofs: ProofSubmission[];
		pendingProofs: ProofSubmission[];
		rejectedProofs: ProofSubmission[];
		totalEarnedNecta: number;
		pendingRewardsNecta: number;
		successRate: number;
		mockJobsForSubscription: MiningJob[];
		mockJobsQueued: MiningJob[];
		mockJobsRunning: MiningJob[];
		mockJobsCompleted: MiningJob[];
		recentEvents: Array<{ id: string; message: string; createdAt: string }>;
		perfChartData: { labels: string[]; data: number[] };
		metric: 'earnings' | 'proofs' | 'uptime';
		range: '7d' | '30d' | '90d';
		onMetricChange: (m: 'earnings' | 'proofs' | 'uptime') => void;
		onRangeChange: (r: '7d' | '30d' | '90d') => void;
		timeAgo: (dateStr: string) => string;
	} = $props();

	let workTab = $state('proofs');

	// Review form state
	let rating = $state(0);
	let hoverRating = $state(0);
	let comment = $state('');
	let submitted = $state(false);

	function handleSubmitReview() {
		if (rating === 0) return;
		submitted = true;
		setTimeout(() => {
			rating = 0;
			comment = '';
			submitted = false;
		}, 3000);
	}
</script>

<div class="space-y-6">
	<!-- Performance chart -->
	<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
		<div
			class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4"
		>
			<h3
				class="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-2"
			>
				Performance
			</h3>
			<div class="flex flex-wrap gap-2">
				{#each ['earnings', 'proofs', 'uptime'] as m}
					<button
						type="button"
						class="rounded-[5px] text-[12px] font-medium h-7 px-2 {metric === m
							? 'bg-[var(--accent)] text-[#0C0C0E]'
							: 'bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
						onclick={() => onMetricChange(m as any)}
					>
						{m === 'earnings' ? 'Earnings' : m === 'proofs' ? 'Proofs' : 'Uptime'}
					</button>
				{/each}
				<span class="w-px bg-[var(--border)] mx-1 hidden sm:block"></span>
				{#each ['7d', '30d', '90d'] as r}
					<button
						type="button"
						class="rounded-[5px] text-[12px] font-medium h-7 px-2 {range === r
							? 'bg-[var(--accent)] text-[#0C0C0E]'
							: 'bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
						onclick={() => onRangeChange(r as any)}
					>
						{r}
					</button>
				{/each}
			</div>
		</div>
		<div class="rounded-[8px] bg-[var(--surface-2)] overflow-hidden">
			<AreaChart data={perfChartData.data} labels={perfChartData.labels} color={metric === 'earnings' ? '#FFBF00' : metric === 'proofs' ? '#6E9FFF' : '#4CB782'} height={220} />
		</div>
	</div>

	<!-- Node & project | Earnings side by side -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<!-- Node & project -->
		<div
			class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h3
				class="text-[14px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"
			>
				Node & project
			</h3>
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
				<div>
					<p
						class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium"
					>
						Status
					</p>
					<span
						class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[var(--success)]/15 text-[var(--success)]"
					>
						<span
							class="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse"
						></span>
						{subscription.status === 'active' ? 'Running' : 'Paused'}
					</span>
				</div>
				<div>
					<p
						class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium"
					>
						Health
					</p>
					<span
						class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]"
					>
						<CheckCircle2 class="h-3 w-3 text-[var(--success)]" />
						Healthy
					</span>
				</div>
				<div>
					<p
						class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium"
					>
						Last heartbeat
					</p>
					<p class="font-mono text-[12px] text-[var(--text-primary)]">2s ago</p>
				</div>
				<div>
					<p
						class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium"
					>
						Uptime (30d)
					</p>
					<p class="text-[13px] font-semibold text-[var(--text-primary)] font-mono">
						{(subscription.uptime ?? 0).toFixed(1)}%
					</p>
				</div>
				<div>
					<p
						class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium"
					>
						Node ID
					</p>
					<p
						class="font-mono text-[11px] text-[var(--text-primary)] truncate"
						title="node-{subscription.id}-{app.id}"
					>
						node-{subscription.id.slice(0, 8)}...
					</p>
				</div>
				<div>
					<p
						class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium"
					>
						Version
					</p>
					<p class="font-mono text-[12px] text-[var(--text-primary)]">
						{app.miningProfile?.version || '1.2.0'}
					</p>
				</div>
				<div>
					<p
						class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium"
					>
						Consensus
					</p>
					<span
						class="inline-flex text-xs px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]"
						>{app.consensusMechanism || 'PoW'}</span
					>
				</div>
				<div>
					<p
						class="text-[11px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wide font-medium"
					>
						Reward token
					</p>
					<p class="text-[13px] font-semibold text-[var(--text-primary)]">
						{app.rewardToken}
					</p>
				</div>
				<div class="col-span-2 md:col-span-3">
					<div
						class="flex justify-between text-[var(--text-tertiary)] text-[11px] mb-1"
					>
						<span>Success rate</span>
						<span class="font-mono"
							>{successRate ? `${successRate.toFixed(1)}%` : '—'}</span
						>
					</div>
					<div class="w-full bg-[var(--surface-2)] rounded-full h-1.5">
						<div
							class="bg-[var(--accent)] h-1.5 rounded-full transition-all"
							style:width="{successRate}%"
						></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Earnings -->
		<div
			class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h3
				class="text-[14px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"
			>
				Earnings
			</h3>
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<span class="text-[13px] text-[var(--text-secondary)]">Verified</span>
					<span
						class="text-[13px] font-semibold text-[var(--text-primary)] font-mono"
						>{totalEarnedNecta.toFixed(4)} NECTA</span
					>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-[13px] text-[var(--text-secondary)]">Pending</span>
					<span
						class="text-[13px] font-semibold text-[var(--text-primary)] font-mono"
						>{pendingRewardsNecta.toFixed(4)} NECTA</span
					>
				</div>
				<a href="/withdraw" class="btn-subscribe w-full mt-3 block text-center"
					>Withdraw / manage payouts</a
				>
			</div>
			<div class="mt-4 pt-4 border-t border-[var(--border)]">
				<div class="flex items-center gap-2 mb-1">
					<Download class="h-4 w-4 text-[var(--text-accent)]" />
					<span class="text-[13px] font-semibold text-[var(--text-primary)]"
						>Latest payouts</span
					>
				</div>
				<p class="text-[11px] text-[var(--text-tertiary)] mb-3">
					Recent verified payouts for this project.
				</p>
				<div class="space-y-1.5 max-h-40 overflow-y-auto">
					{#each verifiedProofs
						.slice()
						.sort((a, b) => new Date(b.verifiedAt ?? b.submittedAt).getTime() - new Date(a.verifiedAt ?? a.submittedAt).getTime())
						.slice(0, 6) as p (p.id)}
						<div
							class="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0"
						>
							<span class="text-[11px] text-[var(--text-tertiary)]"
								>{timeAgo(p.verifiedAt ?? p.submittedAt)}</span
							>
							<span
								class="text-[12px] font-semibold font-mono text-[var(--text-primary)] tabular-nums"
								>{p.reward.toFixed(4)} NECTA</span
							>
						</div>
					{:else}
						<p
							class="py-3 text-center text-[11px] text-[var(--text-tertiary)]"
						>
							No payouts yet. Complete jobs and get proofs verified.
						</p>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<!-- Work & proofs -->
	<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
		<h3
			class="text-[14px] font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2"
		>
			Work & proofs
		</h3>
		<p class="text-[13px] text-[var(--text-secondary)] mb-4">
			Jobs are tasks assigned to your node. Proofs are evidence you did the work; when
			verified, you get paid.
		</p>
		<div class="flex gap-2 mb-4">
			<button
				type="button"
				class="rounded-[5px] text-[12px] font-medium h-7 px-3 {workTab === 'proofs'
					? 'bg-[var(--accent)] text-[#0C0C0E]'
					: 'bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
				onclick={() => (workTab = 'proofs')}
			>
				Proofs
			</button>
			<button
				type="button"
				class="rounded-[5px] text-[12px] font-medium h-7 px-3 {workTab === 'jobs'
					? 'bg-[var(--accent)] text-[#0C0C0E]'
					: 'bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
				onclick={() => (workTab = 'jobs')}
			>
				Jobs
			</button>
		</div>

		{#if workTab === 'proofs'}
			<div class="flex flex-wrap gap-2 mb-3">
				<span
					class="inline-flex text-[11px] px-2 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)]"
					>Verified: {verifiedProofs.length}</span
				>
				<span
					class="inline-flex text-[11px] px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]"
					>Pending: {pendingProofs.length}</span
				>
				{#if rejectedProofs.length > 0}
					<span
						class="inline-flex text-[11px] px-2 py-0.5 rounded bg-[var(--error)]/15 text-[var(--error)]"
						>Rejected: {rejectedProofs.length}</span
					>
				{/if}
			</div>
			<div class="space-y-1.5 max-h-48 overflow-y-auto">
				{#if proofsForApp.length === 0}
					<p class="text-[13px] text-[var(--text-secondary)]">
						No proofs yet. Proofs appear when your node completes work and submits
						evidence.
					</p>
				{:else}
					{#each proofsForApp
						.slice()
						.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
						.slice(0, 10) as proof (proof.id)}
						<a
							href="/mining/proofs/{proof.id}"
							class="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0 text-[12px] no-underline hover:bg-[var(--surface-2)] -mx-1 px-1 rounded transition-colors"
						>
							<span
								class="font-mono truncate flex-1 text-[var(--text-primary)]"
								>{proof.hash.slice(0, 14)}...</span
							>
							<span
								class="text-[11px] text-[var(--text-tertiary)] mx-2 shrink-0"
								>{new Date(proof.submittedAt).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric'
								})}</span
							>
							<span
								class="shrink-0 text-[10px] capitalize px-2 py-0.5 rounded {proof.status === 'verified'
									? 'bg-[var(--accent)]/15 text-[var(--accent)]'
									: proof.status === 'rejected'
										? 'bg-[var(--error)]/15 text-[var(--error)]'
										: 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}"
							>
								{proof.status}
							</span>
							{#if proof.disputeFiledAt}
								<span class="ml-1 text-[10px] text-[var(--warning)]"
									>Disputed</span
								>
							{/if}
							<span class="text-[var(--text-secondary)] ml-2 font-mono shrink-0"
								>${proof.reward.toFixed(2)}</span
							>
						</a>
					{/each}
				{/if}
			</div>
		{:else}
			<!-- Jobs tab -->
			{#if mockJobsForSubscription.length > 0}
				<div class="flex flex-wrap gap-2 mb-3">
					<span
						class="inline-flex text-[11px] px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]"
						>Queued: {mockJobsQueued.length}</span
					>
					<span
						class="inline-flex text-[11px] px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]"
						>Running: {mockJobsRunning.length}</span
					>
					<span
						class="inline-flex text-[11px] px-2 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)]"
						>Done: {mockJobsCompleted.length}</span
					>
				</div>
				<div class="space-y-1.5 max-h-32 overflow-y-auto">
					{#each mockJobsForSubscription
						.slice()
						.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
						.slice(0, 5) as job (job.id)}
						<div
							class="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0 text-[12px]"
						>
							<span
								class="font-mono truncate flex-1 text-[var(--text-primary)]"
								>{job.id.slice(0, 12)}...</span
							>
							<span
								class="shrink-0 text-[10px] capitalize px-2 py-0.5 rounded {job.status === 'completed'
									? 'bg-[var(--accent)]/15 text-[var(--accent)]'
									: 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}"
							>
								{job.status}
							</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-[13px] text-[var(--text-secondary)]">
					No jobs yet. They appear when the project assigns work.
				</p>
			{/if}
		{/if}
	</div>

	<!-- Recent activity -->
	<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
		<h3
			class="text-[14px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"
		>
			Recent activity
		</h3>
		{#if recentEvents.length === 0}
			<p class="text-[13px] text-[var(--text-secondary)]">
				No activity for this project yet.
			</p>
		{:else}
			<div class="space-y-1.5 max-h-64 overflow-y-auto">
				{#each recentEvents.slice(0, 20) as ev (ev.id)}
					<div
						class="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0 text-[12px]"
					>
						<span class="text-[var(--text-primary)] truncate flex-1"
							>{ev.message}</span
						>
						<span class="text-[11px] text-[var(--text-tertiary)] shrink-0 ml-2"
							>{timeAgo(ev.createdAt)}</span
						>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Leave a Review -->
	{#if subscription.status === 'active'}
		<div
			class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
		>
			<h3
				class="text-[14px] font-semibold text-[var(--text-primary)] mb-1 tracking-[-0.006em]"
			>
				Leave a Review
			</h3>
			<p class="text-[13px] text-[var(--text-secondary)] mb-4">
				Share your experience mining on this project.
			</p>

			{#if submitted}
				<div
					class="px-4 py-6 text-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]"
				>
					<p
						class="text-[14px] font-semibold text-[var(--success)]"
					>
						Review submitted, thank you!
					</p>
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					<!-- Star rating -->
					<div>
						<label
							class="block text-[13px] font-medium text-[var(--text-primary)] mb-2"
						>
							Rating
						</label>
						<div class="flex gap-1">
							{#each [1, 2, 3, 4, 5] as star}
								{@const filled = star <= (hoverRating || rating)}
								<button
									type="button"
									onclick={() => (rating = star)}
									onmouseenter={() => (hoverRating = star)}
									onmouseleave={() => (hoverRating = 0)}
									class="bg-transparent border-none cursor-pointer p-0.5 text-2xl leading-none transition-all duration-100"
									style="color:{filled
										? '#F2C94C'
										: 'var(--text-tertiary)'};transform:{filled
										? 'scale(1.1)'
										: 'scale(1)'};"
									aria-label="Rate {star} star{star > 1 ? 's' : ''}"
								>
									&#9733;
								</button>
							{/each}
							{#if rating > 0}
								<span
									class="text-[12px] text-[var(--text-secondary)] ml-2 self-center"
								>
									{rating}/5
								</span>
							{/if}
						</div>
					</div>

					<!-- Comment textarea -->
					<div>
						<label
							class="block text-[13px] font-medium text-[var(--text-primary)] mb-2"
						>
							Comment (optional)
						</label>
						<textarea
							bind:value={comment}
							placeholder="Tell other miners about your experience..."
							rows="3"
							class="w-full px-3 py-2 text-[13px] rounded-[5px] border border-[var(--border)] bg-[var(--surface-0)] text-[var(--text-primary)] resize-y outline-none font-inherit box-border"
						></textarea>
					</div>

					<!-- Submit button -->
					<button
						type="button"
						onclick={handleSubmitReview}
						disabled={rating === 0}
						class="h-9 px-5 rounded-[5px] border-none text-[13px] font-semibold transition-colors duration-100 self-start"
						style="cursor:{rating === 0
							? 'not-allowed'
							: 'pointer'};background:{rating === 0
							? 'var(--surface-2)'
							: 'var(--accent)'};color:{rating === 0
							? 'var(--text-tertiary)'
							: '#0C0C0E'};"
					>
						Submit Review
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
