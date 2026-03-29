<script lang="ts">
	import { page } from '$app/stores';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, wallet, showConnectModal } from '$lib/stores/wallet';
	import { appIconDataUri } from '$lib/app-icon';
	import {
		ArrowLeft,
		CheckCircle2,
		HardDrive,
		Shield,
		ShieldAlert,
		Clock,
		TrendingUp,
		Download,
		AlertTriangle,
		Send,
		RefreshCw,
		Wallet,
		Cpu,
		Activity,
		Server,
		Boxes
	} from 'lucide-svelte';

	let subscriptionId = $derived($page.params.id);

	let subscription = $derived(
		$backendState.subscriptions.find((s) => s.id === subscriptionId) ?? null
	);

	let minerId = $derived($actor?.minerId ?? null);

	let wrongWallet = $derived.by(() => {
		if (!subscription) return false;
		if (!minerId) return false;
		return subscription.minerId !== minerId;
	});

	let app = $derived(
		subscription ? $backendState.apps.find((a) => a.id === subscription.appId) ?? null : null
	);

	let iconSrc = $derived.by(() => {
		if (!app) return '/placeholder.svg';
		if (app.icon && app.icon !== '/placeholder.svg') return app.icon;
		return appIconDataUri({ id: app.id, name: app.name });
	});

	let proofsForApp = $derived.by(() => {
		if (!subscription) return [];
		const mid = minerId ?? subscription.minerId;
		return $backendState.proofs.filter((p) => p.minerId === mid && p.appId === subscription!.appId);
	});

	let verifiedProofs = $derived(proofsForApp.filter((p) => p.status === 'verified'));
	let pendingProofs = $derived(proofsForApp.filter((p) => p.status === 'pending'));
	let rejectedProofs = $derived(proofsForApp.filter((p) => p.status === 'rejected'));
	let totalProofs = $derived(proofsForApp.length);
	let successRate = $derived(totalProofs > 0 ? (verifiedProofs.length / totalProofs) * 100 : 0);
	let totalEarnedNecta = $derived(verifiedProofs.reduce((sum, p) => sum + p.reward, 0));

	let mockJobsForSubscription = $derived.by(() => {
		if (!subscription || !minerId) return [];
		return $backendState.jobs.filter(
			(j) => j.subscriptionId === subscription!.id && j.minerId === minerId
		);
	});
	let mockJobsQueued = $derived(mockJobsForSubscription.filter((j) => j.status === 'queued'));
	let mockJobsRunning = $derived(mockJobsForSubscription.filter((j) => j.status === 'running'));
	let mockJobsCompleted = $derived(
		mockJobsForSubscription.filter((j) => j.status === 'completed')
	);

	let range = $state<'7d' | '30d' | '90d'>('30d');
	let metric = $state<'earnings' | 'proofs' | 'uptime'>('earnings');
	let resourceAllocation = $state({ cpu: 25, memory: 25, storage: 25, gpu: 25 });
	let usageRange = $state<'24h' | '7d' | '30d'>('7d');
	type ResourceChartMetric = 'cpu' | 'gpu' | 'memory' | 'storage' | 'network';
	let resourceChartMetric = $state<ResourceChartMetric>('cpu');
	let activeTab = $state('node');
	let workTab = $state('proofs');

	// Review form state
	let rating = $state(0);
	let hoverRating = $state(0);
	let comment = $state('');
	let submitted = $state(false);

	let mid = $derived(minerId ?? subscription?.minerId ?? null);

	let pendingRewardsNecta = $derived.by(() => {
		if (!subscription) return 0;
		const m = minerId ?? subscription.minerId;
		return $backendState.jobs
			.filter(
				(j) =>
					(j.status === 'queued' || j.status === 'running') &&
					j.minerId === m &&
					j.appId === subscription!.appId
			)
			.reduce((sum, j) => sum + j.reward, 0);
	});

	let slashingHistory = $derived.by(() => {
		if (!subscription) return [];
		return backend.listSlashingEvents({
			minerId: subscription.minerId,
			appId: subscription.appId,
			limit: 25
		});
	});

	let payoutsForSubscription = $derived.by(() => {
		if (!subscription || !mid) return [];
		return (($backendState as any).payouts ?? []).filter(
			(p: any) => p.appId === subscription!.appId && p.minerId === mid
		);
	});

	let withdrawalsForMiner = $derived.by(() => {
		if (!mid) return [];
		return (($backendState as any).withdrawals ?? [])
			.filter((w: any) => w.minerId === mid)
			.sort(
				(a: any, b: any) =>
					new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
			);
	});

	let totalWithdrawn = $derived(
		withdrawalsForMiner
			.filter((w: any) => w.status === 'completed')
			.reduce((sum: number, w: any) => sum + w.amount, 0)
	);

	let financialTransactions = $derived.by(() => {
		const tx: Array<{
			id: string;
			type: 'payout' | 'withdrawal' | 'slash';
			date: string;
			label: string;
			amount: number;
			meta?: string;
		}> = [];
		payoutsForSubscription.slice(0, 20).forEach((p: any) => {
			tx.push({
				id: p.id,
				type: 'payout',
				date: p.createdAt,
				label: 'Payout',
				amount: p.minerAmount ?? 0,
				meta: p.proofId ?? undefined
			});
		});
		withdrawalsForMiner.slice(0, 15).forEach((w: any) => {
			tx.push({
				id: w.id,
				type: 'withdrawal',
				date: w.requestedAt,
				label: `Withdrawal (${w.status})`,
				amount: -w.amount,
				meta: w.status
			});
		});
		slashingHistory.slice(0, 10).forEach((s: any) => {
			tx.push({
				id: `slash-${s.id}`,
				type: 'slash',
				date: s.createdAt,
				label: 'Slashing',
				amount: -s.amount,
				meta: s.reason
			});
		});
		return tx
			.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
			.slice(0, 30);
	});

	let recentEvents = $derived.by(() => {
		if (!subscription) return [];
		const m = minerId ?? subscription.minerId;
		return backend.listEvents({ minerId: m, appId: subscription.appId, limit: 40 });
	});

	function safe(fn: () => void) {
		try {
			fn();
		} catch (e: any) {
			alert(e?.message ?? 'Action failed');
		}
	}

	function timeAgo(dateStr: string) {
		const created = new Date(dateStr);
		const sec = Math.floor((Date.now() - created.getTime()) / 1000);
		if (sec < 60) return 'Just now';
		if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
		if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
		if (sec < 172800) return 'Yesterday';
		return created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function handleSubmitReview() {
		if (rating === 0) return;
		submitted = true;
		setTimeout(() => {
			rating = 0;
			comment = '';
			submitted = false;
		}, 3000);
	}

	const resourceChartLabel: Record<ResourceChartMetric, string> = {
		cpu: 'CPU usage',
		gpu: 'GPU usage',
		memory: 'Memory usage',
		storage: 'Storage usage',
		network: 'Network usage'
	};
</script>

{#if !$actor}
	<!-- No wallet connected -->
	<div class="min-h-screen bg-[var(--surface-0)]">
		<div class="max-w-7xl mx-auto px-8 py-16">
			<div
				class="p-12 text-center bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
			>
				<p class="text-[13px] text-[var(--text-secondary)]">
					Connect a wallet to view network details.
				</p>
				<div class="mt-4">
					<button type="button" class="btn-pill" onclick={() => showConnectModal.set(true)}>
						Connect Wallet
					</button>
				</div>
			</div>
		</div>
	</div>
{:else if !subscription || !app}
	<!-- Subscription not found -->
	<div class="min-h-screen bg-[var(--surface-0)]">
		<div class="max-w-7xl mx-auto px-8 py-16">
			<a href="/mining" class="btn-secondary mb-8 inline-flex items-center gap-2">
				<ArrowLeft class="h-4 w-4" />
				Back to My Mining
			</a>
			<div
				class="p-12 text-center bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
			>
				<p class="text-[13px] text-[var(--text-secondary)]">Network not found</p>
				<p class="text-[12px] text-[var(--text-tertiary)] mt-2">
					This subscription id may not exist in your current demo state.
				</p>
			</div>
		</div>
	</div>
{:else}
	<div class="min-h-screen bg-[var(--surface-0)]">
		<div class="max-w-7xl mx-auto px-8 py-16 space-y-8">
			<!-- Back Button -->
			<a
				href="/mining"
				class="inline-flex items-center gap-2 bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-[5px] text-[13px] px-3 py-1.5"
			>
				<ArrowLeft class="h-4 w-4" />
				Back to My Mining
			</a>

			<!-- Header -->
			<div class="flex items-start gap-6">
				<img
					src={iconSrc}
					alt={app.name}
					width="100"
					height="100"
					class="rounded-[8px] w-[100px] h-[100px] object-cover"
				/>
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-2">
						<h1 class="text-[24px] font-semibold text-[var(--text-primary)]">{app.name}</h1>
						<span
							class="inline-flex items-center gap-2 text-xs px-2 py-0.5 rounded capitalize {subscription.status === 'active'
								? 'bg-[var(--success)]/15 text-[var(--success)]'
								: 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}"
						>
							{#if subscription.status === 'active'}
								<span class="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse"></span>
							{/if}
							{subscription.status}
						</span>
					</div>
					<div
						class="text-[13px] text-[var(--text-secondary)] mb-4 flex flex-wrap items-center gap-2"
					>
						<span>
							Network subscription: <span
								class="font-mono text-[12px] text-[var(--text-primary)]">{subscription.id}</span
							>
						</span>
					</div>

					{#if wrongWallet}
						<div
							class="p-4 mb-4 bg-[var(--surface-1)] border border-[rgba(242,153,74,0.30)] rounded-[8px]"
						>
							<div class="flex items-start gap-3">
								<AlertTriangle class="h-5 w-5 text-[var(--warning)] mt-0.5" />
								<div>
									<div class="text-[13px] font-medium text-[var(--text-primary)]">
										This network belongs to a different wallet
									</div>
									<div class="text-[12px] text-[var(--text-secondary)] mt-1">
										Connect the wallet for miner <span class="font-mono"
											>{subscription.minerId}</span
										> to manage it.
									</div>
								</div>
							</div>
						</div>
					{/if}

					<div class="flex flex-wrap gap-2 mb-6">
						{#if subscription.status === 'active'}
							<button
								type="button"
								class="btn-secondary"
								onclick={() => safe(() => backend.pauseSubscription(subscription!.id))}
								disabled={wrongWallet}
								style:opacity={wrongWallet ? 0.4 : 1}
							>
								Pause
							</button>
						{:else}
							<button
								type="button"
								class="btn-subscribe"
								onclick={() => safe(() => backend.resumeSubscription(subscription!.id))}
								disabled={wrongWallet}
								style:opacity={wrongWallet ? 0.4 : 1}
							>
								Resume
							</button>
						{/if}
						<a href="/apps/{app.id}" class="btn-secondary">View app page</a>
						<a href="/withdraw" class="btn-secondary">Withdraw</a>
					</div>

					<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div>
							<p class="text-[12px] text-[var(--text-secondary)]">Total Earned</p>
							<p class="text-[20px] font-bold text-[var(--text-accent)] font-mono">
								{totalEarnedNecta.toFixed(4)} NECTA
							</p>
						</div>
						<div>
							<p class="text-[12px] text-[var(--text-secondary)]">Tasks completed</p>
							<p class="text-[11px] text-[var(--text-tertiary)]">Verified proofs</p>
							<p class="text-[20px] font-bold text-[var(--text-primary)] font-mono">
								{verifiedProofs.length.toLocaleString('en-US')}
							</p>
						</div>
						<div>
							<p class="text-[12px] text-[var(--text-secondary)]">Uptime</p>
							<p class="text-[20px] font-bold text-[var(--text-primary)] font-mono">
								{(subscription.uptime ?? 0).toFixed(1)}%
							</p>
						</div>
						<div>
							<p class="text-[12px] text-[var(--text-secondary)]">Daily Average</p>
							<p class="text-[20px] font-bold text-[var(--text-primary)] font-mono">
								{(totalEarnedNecta / 30).toFixed(4)} NECTA
							</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Tabs -->
			<div class="w-full">
				<div class="grid w-full grid-cols-2 md:grid-cols-4 mb-6 gap-1">
					{#each [
						{ id: 'node', label: 'Node Information', Icon: HardDrive },
						{ id: 'financial', label: 'Financial Summary', Icon: Wallet },
						{ id: 'resources', label: 'NDSR Runtime', Icon: Boxes },
						{ id: 'security', label: 'Security & Health', Icon: ShieldAlert }
					] as tabDef}
						<button
							type="button"
							class="flex items-center justify-center gap-2 px-3 py-2 text-[13px] rounded-[5px] border transition-colors {activeTab === tabDef.id
								? 'bg-[var(--accent)] text-[#0C0C0E] border-[var(--accent)]'
								: 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
							onclick={() => (activeTab = tabDef.id)}
						>
							<tabDef.Icon class="h-4 w-4" />
							{tabDef.label}
						</button>
					{/each}
				</div>

				<!-- NODE INFORMATION TAB -->
				{#if activeTab === 'node'}
					<div class="space-y-6">
						<!-- Performance chart placeholder -->
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
											onclick={() => (metric = m as any)}
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
											onclick={() => (range = r as any)}
										>
											{r}
										</button>
									{/each}
								</div>
							</div>
							<!-- Chart placeholder -->
							<div
								class="h-[220px] rounded-[8px] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-tertiary)] text-[13px]"
							>
								{metric === 'earnings'
									? 'Earnings'
									: metric === 'proofs'
										? 'Proofs'
										: 'Uptime'} chart ({range}) — chart placeholder
							</div>
						</div>

						<!-- Node & network | Earnings side by side -->
						<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
							<!-- Node & network -->
							<div
								class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h3
									class="text-[14px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"
								>
									Node & network
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
										Recent verified payouts for this network.
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
										No jobs yet. They appear when the network assigns work.
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
									No activity for this network yet.
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
									style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;letter-spacing:-0.006em;"
								>
									Leave a Review
								</h3>
								<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
									Share your experience mining on this network.
								</p>

								{#if submitted}
									<div
										style="padding:24px 16px;text-align:center;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);"
									>
										<p
											style="font-size:14px;font-weight:600;color:var(--success);margin:0;"
										>
											Review submitted, thank you!
										</p>
									</div>
								{:else}
									<div style="display:flex;flex-direction:column;gap:16px;">
										<!-- Star rating -->
										<div>
											<label
												style="display:block;font-size:13px;font-weight:500;color:var(--text-primary);margin-bottom:8px;"
											>
												Rating
											</label>
											<div style="display:flex;gap:4px;">
												{#each [1, 2, 3, 4, 5] as star}
													{@const filled = star <= (hoverRating || rating)}
													<button
														type="button"
														onclick={() => (rating = star)}
														onmouseenter={() => (hoverRating = star)}
														onmouseleave={() => (hoverRating = 0)}
														style="background:none;border:none;cursor:pointer;padding:2px;font-size:24px;line-height:1;color:{filled
															? '#F2C94C'
															: 'var(--text-tertiary)'};transition:color 100ms ease-out,transform 100ms ease-out;transform:{filled
															? 'scale(1.1)'
															: 'scale(1)'};"
														aria-label="Rate {star} star{star > 1 ? 's' : ''}"
													>
														&#9733;
													</button>
												{/each}
												{#if rating > 0}
													<span
														style="font-size:12px;color:var(--text-secondary);margin-left:8px;align-self:center;"
													>
														{rating}/5
													</span>
												{/if}
											</div>
										</div>

										<!-- Comment textarea -->
										<div>
											<label
												style="display:block;font-size:13px;font-weight:500;color:var(--text-primary);margin-bottom:8px;"
											>
												Comment (optional)
											</label>
											<textarea
												bind:value={comment}
												placeholder="Tell other miners about your experience..."
												rows="3"
												style="width:100%;padding:8px 12px;font-size:13px;border-radius:5px;border:1px solid var(--border);background:var(--surface-0);color:var(--text-primary);resize:vertical;outline:none;font-family:inherit;box-sizing:border-box;"
											></textarea>
										</div>

										<!-- Submit button -->
										<button
											type="button"
											onclick={handleSubmitReview}
											disabled={rating === 0}
											style="height:36px;padding:0 20px;border-radius:5px;border:none;font-size:13px;font-weight:600;cursor:{rating === 0
												? 'not-allowed'
												: 'pointer'};background:{rating === 0
												? 'var(--surface-2)'
												: 'var(--accent)'};color:{rating === 0
												? 'var(--text-tertiary)'
												: '#0C0C0E'};transition:background 100ms ease-out;align-self:flex-start;"
										>
											Submit Review
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- FINANCIAL SUMMARY TAB -->
				{:else if activeTab === 'financial'}
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

					<!-- NDSR RUNTIME TAB -->
				{:else if activeTab === 'resources'}
					<div class="space-y-6">
						<!-- Resource usage chart placeholder + reallocation -->
						<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
							<h3
								class="text-[14px] font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"
							>
								NDSR Container Resources
							</h3>
							<p class="text-[13px] text-[var(--text-secondary)] mb-4">
								Resource usage and allocation for your NDSR container on this network.
							</p>

							<div class="mb-3">
								<p
									class="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2"
								>
									Chart: usage over time
								</p>
								<div class="flex flex-wrap gap-2">
									{#each ['cpu', 'gpu', 'memory', 'storage', 'network'] as m}
										<button
											type="button"
											class="rounded-[5px] text-[12px] font-medium h-7 px-2 flex items-center gap-1.5 {resourceChartMetric === m
												? 'bg-[var(--accent)] text-[#0C0C0E]'
												: 'bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
											onclick={() => (resourceChartMetric = m as ResourceChartMetric)}
										>
											{#if m === 'cpu'}<Cpu class="h-3.5 w-3.5" />{/if}
											{#if m === 'storage'}<HardDrive class="h-3.5 w-3.5" />{/if}
											{#if m === 'network'}<Activity class="h-3.5 w-3.5" />{/if}
											{m === 'cpu'
												? 'CPU'
												: m === 'gpu'
													? 'GPU'
													: m === 'memory'
														? 'Memory'
														: m === 'storage'
															? 'Storage'
															: 'Network'}
										</button>
									{/each}
								</div>
							</div>
							<div class="flex flex-wrap gap-2 mb-4">
								{#each ['24h', '7d', '30d'] as r}
									<button
										type="button"
										class="rounded-[5px] text-[12px] font-medium h-7 px-2 {usageRange === r
											? 'bg-[var(--accent)] text-[#0C0C0E]'
											: 'bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
										onclick={() => (usageRange = r as any)}
									>
										{r}
									</button>
								{/each}
							</div>
							<!-- Chart placeholder -->
							<div
								class="h-[220px] rounded-[8px] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-tertiary)] text-[13px]"
							>
								{resourceChartLabel[resourceChartMetric]} chart ({usageRange}) — chart placeholder
							</div>

							<div class="mt-6 pt-6 border-t border-[var(--border)]">
								<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
									Reallocate resources (partition for this network)
								</h4>
								<p class="text-[13px] text-[var(--text-secondary)] mb-4">
									Set the share of each resource type dedicated to this subscription.
								</p>
								<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
									{#each ['cpu', 'memory', 'storage', 'gpu'] as key}
										<div>
											<label
												class="text-[13px] font-medium text-[var(--text-primary)] capitalize"
												>{key}</label
											>
											<div class="flex items-center gap-3 mt-2">
												<input
													type="range"
													min="0"
													max="100"
													step="5"
													value={resourceAllocation[key as keyof typeof resourceAllocation]}
													oninput={(e) =>
														(resourceAllocation[key as keyof typeof resourceAllocation] =
															Number((e.target as HTMLInputElement).value))}
													class="w-full"
												/>
												<span
													class="text-[13px] font-semibold font-mono text-[var(--text-primary)] tabular-nums w-10"
													>{resourceAllocation[key as keyof typeof resourceAllocation]}%</span
												>
											</div>
										</div>
									{/each}
								</div>
								<button
									type="button"
									class="btn-subscribe mt-4"
									onclick={() => alert('Allocation updated. Resource partition applied.')}
								>
									Apply allocation
								</button>
							</div>
						</div>

						<!-- NDSR Container status -->
						<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
							<h3
								class="text-[14px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"
							>
								NDSR Container
							</h3>
							<div class="flex flex-wrap items-center gap-4">
								<span
									class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[var(--success)]/15 text-[var(--success)]"
								>
									<span
										class="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse"
									></span>
									Running
								</span>
								<span class="text-[13px] text-[var(--text-secondary)]"
									>Container: ndsr-{subscription?.id?.slice(0, 8) ?? '—'}</span
								>
								<span class="text-[13px] text-[var(--text-secondary)] font-mono"
									>Uptime: {(subscription?.uptime ?? 0).toFixed(1)}%</span
								>
							</div>
						</div>

						<!-- Detailed resource metrics -->
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							<!-- Storage -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4
									class="text-[13px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"
								>
									<HardDrive class="h-4 w-4 text-[var(--text-tertiary)]" /> Storage
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">Disk (HDD):</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>120 GB / 500 GB (24%)</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">SSD:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>45 GB / 256 GB (18%)</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">Object storage:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>2.1 TB used</span
										>
									</div>
									<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
										<div
											class="bg-[var(--accent)] h-2 rounded-full"
											style="width:24%"
										></div>
									</div>
								</div>
							</div>
							<!-- Network -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4
									class="text-[13px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"
								>
									<Activity class="h-4 w-4 text-[var(--text-tertiary)]" /> Network
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">Bandwidth:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>~85 Mbps</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">Throughput:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>0.5 MB/s read, 0.2 MB/s write</span
										>
									</div>
									<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
										<div
											class="bg-[var(--accent)] h-2 rounded-full"
											style="width:32%"
										></div>
									</div>
								</div>
							</div>
							<!-- I/O -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4
									class="text-[13px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"
								>
									<Cpu class="h-4 w-4 text-[var(--text-tertiary)]" /> I/O (IOPS)
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">Read:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>1.2k IOPS</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">Write:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>480 IOPS</span
										>
									</div>
									<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
										<div
											class="bg-[var(--accent)] h-2 rounded-full"
											style="width:28%"
										></div>
									</div>
								</div>
							</div>
							<!-- GPU -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
									GPU / Accelerators
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">GPU:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>RTX 3080 - 42% util</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">TPU/NPU:</span>
										<span class="font-medium text-[var(--text-primary)]">—</span>
									</div>
									<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
										<div
											class="bg-[var(--accent)] h-2 rounded-full"
											style="width:42%"
										></div>
									</div>
								</div>
							</div>
							<!-- Latency -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
									Latency & compute
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">Latency (p99):</span>
										<span class="font-medium text-[var(--text-primary)] font-mono">12 ms</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">Compute time:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>~0.8s/task</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">Cycles:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>2.1B/s</span
										>
									</div>
								</div>
							</div>
							<!-- Power -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
									Power & energy
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">Power draw:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono">~85 W</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">Energy (24h):</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>~2.0 kWh</span
										>
									</div>
									<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
										<div
											class="bg-[var(--accent)] h-2 rounded-full"
											style="width:35%"
										></div>
									</div>
								</div>
							</div>
							<!-- Concurrency -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
									Concurrency / threads
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">Threads:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>24 active / 32 max</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">Concurrent tasks:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono">8</span>
									</div>
									<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
										<div
											class="bg-[var(--accent)] h-2 rounded-full"
											style="width:75%"
										></div>
									</div>
								</div>
							</div>
							<!-- Cache -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
									Cache
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">L1/L2 hit rate:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono">94%</span>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">Cache size:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono">32 MB</span
										>
									</div>
									<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
										<div
											class="bg-[var(--accent)] h-2 rounded-full"
											style="width:94%"
										></div>
									</div>
								</div>
							</div>
							<!-- Interconnect -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
									Interconnect / bus
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">Bus bandwidth:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>~8 GB/s</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">PCIe:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>Gen4 x16</span
										>
									</div>
								</div>
							</div>
							<!-- Persistent memory -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
									Persistent memory
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">NVMe:</span>
										<span class="font-medium text-[var(--text-primary)] font-mono"
											>256 GB - 18% used</span
										>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">PMem:</span>
										<span class="font-medium text-[var(--text-primary)]">—</span>
									</div>
									<div class="w-full bg-[var(--surface-2)] rounded-full h-2 mt-2">
										<div
											class="bg-[var(--accent)] h-2 rounded-full"
											style="width:18%"
										></div>
									</div>
								</div>
							</div>
							<!-- Specialized -->
							<div
								class="p-5 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]"
							>
								<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
									Specialized hardware
								</h4>
								<div class="space-y-3 text-[13px]">
									<div>
										<span class="text-[var(--text-secondary)]">FPGA:</span>
										<span class="font-medium text-[var(--text-primary)]">—</span>
									</div>
									<div>
										<span class="text-[var(--text-secondary)]">ASIC:</span>
										<span class="font-medium text-[var(--text-primary)]">—</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- SECURITY & HEALTH TAB -->
				{:else if activeTab === 'security'}
					<div class="space-y-6">
						<!-- Health check -->
						<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
							<h3
								class="text-[14px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"
							>
								Health check
							</h3>
							<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div
									class="flex items-center gap-3 p-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]"
								>
									<CheckCircle2 class="h-8 w-8 text-[var(--success)] shrink-0" />
									<div>
										<p class="text-[13px] font-medium text-[var(--text-primary)]">
											Node healthy
										</p>
										<p class="text-[12px] text-[var(--text-secondary)]">Last check: 2s ago</p>
									</div>
								</div>
								<div
									class="flex items-center gap-3 p-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]"
								>
									<CheckCircle2 class="h-8 w-8 text-[var(--success)] shrink-0" />
									<div>
										<p class="text-[13px] font-medium text-[var(--text-primary)]">
											Attestation valid
										</p>
										<p class="text-[12px] text-[var(--text-secondary)]">TEE + TPM verified</p>
									</div>
								</div>
								<div
									class="flex items-center gap-3 p-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]"
								>
									<CheckCircle2 class="h-8 w-8 text-[var(--success)] shrink-0" />
									<div>
										<p class="text-[13px] font-medium text-[var(--text-primary)]">
											No security flags
										</p>
										<p class="text-[12px] text-[var(--text-secondary)]">
											No disputes or slashing pending
										</p>
									</div>
								</div>
							</div>
						</div>

						<!-- Recent cases -->
						<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
							<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-4">
								Recent cases
							</h4>
							<p class="text-[13px] text-[var(--text-secondary)] mb-4">
								Slashing and dispute events for this network.
							</p>
							{#if slashingHistory.length === 0}
								<div
									class="py-8 text-center rounded-[8px] border border-[var(--border)] border-dashed bg-[var(--surface-2)] text-[13px] text-[var(--text-secondary)]"
								>
									No recent cases.
								</div>
							{:else}
								<div class="space-y-2">
									{#each slashingHistory.slice(0, 10) as s (s.id)}
										<div
											class="flex items-center justify-between p-4 rounded-[8px] border border-[rgba(235,87,87,0.30)] bg-[rgba(235,87,87,0.05)]"
										>
											<div>
												<p class="text-[13px] font-medium text-[var(--error)]">Slashing</p>
												<p class="text-[12px] text-[var(--text-secondary)]">{s.reason}</p>
												<p class="text-[11px] text-[var(--text-tertiary)] mt-1">
													{new Date(s.createdAt).toLocaleString('en-US')}
												</p>
											</div>
											<span
												class="text-[13px] font-semibold text-[var(--error)] font-mono"
												>-{s.amount.toFixed(4)} NECTA</span
											>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- System alerts -->
						<div class="p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px]">
							<h4 class="text-[13px] font-semibold text-[var(--text-primary)] mb-4">
								System alerts
							</h4>
							<div class="space-y-2">
								<div
									class="flex items-center gap-3 p-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]"
								>
									<AlertTriangle class="h-4 w-4 text-[var(--warning)] shrink-0" />
									<div>
										<p class="text-[13px] font-medium text-[var(--text-primary)]">
											High memory usage
										</p>
										<p class="text-[12px] text-[var(--text-secondary)]">
											Memory &gt; 80%. Consider scaling. Last: 2h ago
										</p>
									</div>
								</div>
								<div
									class="flex items-center gap-3 p-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]"
								>
									<CheckCircle2 class="h-4 w-4 text-[var(--success)] shrink-0" />
									<div>
										<p class="text-[13px] font-medium text-[var(--text-primary)]">
											Heartbeat OK
										</p>
										<p class="text-[12px] text-[var(--text-secondary)]">
											Node responded within SLA. Last: 2s ago
										</p>
									</div>
								</div>
								<div
									class="flex items-center gap-3 p-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]"
								>
									<CheckCircle2 class="h-4 w-4 text-[var(--success)] shrink-0" />
									<div>
										<p class="text-[13px] font-medium text-[var(--text-primary)]">
											Proof verification passed
										</p>
										<p class="text-[12px] text-[var(--text-secondary)]">
											Last proof accepted. No disputes.
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
