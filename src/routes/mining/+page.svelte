<script lang="ts">
	import { page } from '$app/stores';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, wallet, showConnectModal } from '$lib/stores/wallet';
	import { appIconDataUri } from '$lib/app-icon';
	import EarningsPanel from '$lib/components/mining/EarningsPanel.svelte';
	import { ArrowUpRight } from 'lucide-svelte';
	import type { App } from '$lib/types';
	import { Button, Card, StatCard } from '$lib/components/ui';

	type TabId = 'networks' | 'earnings' | 'proofs';

	let initialTab = $derived(
		($page.url.searchParams.get('tab') as TabId) || 'networks'
	);

	let tab = $state<TabId>('networks');
	$effect(() => {
		tab = initialTab;
	});

	let minerId = $derived($actor?.minerId ?? null);
	let walletAddress = $derived($wallet?.address ?? $actor?.walletAddress ?? '');

	let subs = $derived(
		minerId ? $backendState.subscriptions.filter((s) => s.minerId === minerId) : []
	);

	let appsById = $derived(new Map($backendState.apps.map((a) => [a.id, a])));
	let activeCount = $derived(subs.filter((s) => s.status === 'active').length);
	let totalEarned = $derived(subs.reduce((sum, s) => sum + (s.totalEarned ?? 0), 0));

	let recentEvents = $derived(
		minerId ? backend.listEvents({ minerId, limit: 40 }) : []
	);

	let hw = $derived(
		minerId ? ($backendState.hardwareProfileByMinerId?.[minerId] ?? null) : null
	);

	// 30-day earnings series
	let earningsSeries = $derived.by(() => {
		if (!minerId) return [];
		const days = 30;
		const now = new Date();
		const utcAnchor = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
		);
		const keys: string[] = [];
		for (let i = days - 1; i >= 0; i--) {
			const d = new Date(utcAnchor);
			d.setUTCDate(utcAnchor.getUTCDate() - i);
			keys.push(d.toISOString().slice(0, 10));
		}
		const byDay = new Map<string, number>();
		for (const p of ($backendState as any).payouts ?? []) {
			if (p.minerId !== minerId) continue;
			const day = String(p.createdAt).slice(0, 10);
			byDay.set(day, (byDay.get(day) ?? 0) + Number(p.minerAmount ?? 0));
		}
		return keys.map((k) => ({
			date: k,
			value: Number((byDay.get(k) ?? 0).toFixed(4))
		}));
	});

	function sumLastNDays(n: number) {
		return earningsSeries
			.slice(Math.max(0, earningsSeries.length - n))
			.reduce((s, p) => s + p.value, 0);
	}

	let earned30d = $derived(sumLastNDays(30));
	let earned7d = $derived(sumLastNDays(7));
	let earnedToday = $derived(
		earningsSeries.length > 0 ? earningsSeries[earningsSeries.length - 1]!.value : 0
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

	let reputation = $derived.by(() => {
		const rep = minerId
			? ($backendState.minerReputationByMinerId?.[minerId] ?? 0)
			: 0;
		return typeof rep === 'number' ? rep.toFixed(1) : '0.0';
	});

	let topNetworks = $derived.by(() => {
		if (!minerId) return [];
		const byApp = new Map<string, number>();
		for (const p of ($backendState as any).payouts ?? []) {
			if (p.minerId !== minerId) continue;
			byApp.set(p.appId, (byApp.get(p.appId) ?? 0) + Number(p.minerAmount ?? 0));
		}
		return [...byApp.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([appId, amount]) => ({
				appId,
				amount: Number(amount.toFixed(4)),
				app: appsById.get(appId) ?? null
			}));
	});


	let latestPayouts = $derived.by(() => {
		if (!minerId) return [];
		const payouts = (($backendState as any).payouts ?? []) as Array<{
			id?: string;
			createdAt: string;
			appId: string;
			minerId: string;
			minerAmount: number;
			subscriptionId?: string;
		}>;
		return payouts
			.filter((p) => p.minerId === minerId)
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			)
			.slice(0, 8)
			.map((p) => ({
				...p,
				app: appsById.get(p.appId),
				subscriptionId:
					p.subscriptionId ??
					subs.find((s) => s.appId === p.appId && s.minerId === minerId)?.id
			}));
	});

	let recommendations = $derived.by(() => {
		if (!minerId) return [];
		const subsAppIds = new Set(subs.map((s) => s.appId));
		const candidates = backend.listApps().filter((a) => !subsAppIds.has(a.id));

		const score = (a: any) => {
			let s = 0;
			if (a.requirements?.gpu) s += hw?.gpuModel ? 3 : -2;
			if (a.requirements?.storage) s += (hw?.storageGb ?? 0) >= 500 ? 1 : 0;
			if (a.requirements?.bandwidth) s += (hw?.networkMbps ?? 0) >= 50 ? 1 : 0;
			s += Math.min(5, (a.avgEarningsPerDay ?? 0) / 50);
			s += Math.min(3, (a.reputationScore ?? 0) / 40);
			return s;
		};

		return candidates
			.slice()
			.sort((a, b) => score(b) - score(a))
			.slice(0, 6);
	});

	function statusDotClass(status: string) {
		switch (status) {
			case 'active':
				return 'status-dot status-dot-active status-dot-pulse';
			case 'proving':
				return 'status-dot status-dot-proving';
			case 'paused':
				return 'status-dot status-dot-paused';
			case 'slashed':
				return 'status-dot status-dot-slashed';
			case 'pending':
				return 'status-dot status-dot-pending';
			default:
				return 'status-dot status-dot-paused';
		}
	}

	function relativeTime(dateStr: string) {
		const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
		if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
		if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
		if (sec < 172800) return 'Yesterday';
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	function appIcon(app: App): string {
		return app.icon && app.icon !== '/placeholder.svg'
			? app.icon
			: appIconDataUri({ id: app.id, name: app.name });
	}

	// Chart helper: max value for bar chart scaling
	let chartMax = $derived(Math.max(...earningsSeries.map((d) => d.value), 0.001));

	// Tooltip state for HTML bar charts
	let mobileTooltip = $state<{ index: number; x: number } | null>(null);
	let desktopTooltip = $state<{ index: number; x: number } | null>(null);

	// Proofs data
	let proofs = $derived(
		minerId ? $backendState.proofs.filter((p) => p.minerId === minerId) : []
	);
	let sortedProofs = $derived(
		proofs.slice().sort(
			(a, b) =>
				new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
		)
	);
	let verifiedCount = $derived(proofs.filter((p) => p.status === 'verified').length);
	let pendingCount = $derived(proofs.filter((p) => p.status === 'pending').length);
	let rejectedCount = $derived(proofs.filter((p) => p.status === 'rejected').length);
	let disputedCount = $derived(proofs.filter((p) => p.disputeFiledAt).length);
	let successRate = $derived(
		proofs.length > 0 ? ((verifiedCount / proofs.length) * 100).toFixed(1) : '0.0'
	);
	let avgVerifyTime = $derived.by(() => {
		const verified = proofs.filter((p) => p.status === 'verified' && p.verifiedAt);
		if (verified.length === 0) return '0s';
		const avg =
			verified.reduce(
				(sum, p) =>
					sum +
					(new Date(p.verifiedAt!).getTime() - new Date(p.submittedAt).getTime()) / 1000,
				0
			) / verified.length;
		if (avg < 60) return `${avg.toFixed(0)}s`;
		if (avg < 3600) return `${(avg / 60).toFixed(1)}m`;
		return `${(avg / 3600).toFixed(1)}h`;
	});

	// Proofs daily rate chart (last 14 days) — stacked submitted vs verified
	let proofsDailyRate = $derived.by(() => {
		const days = 14;
		const now = new Date();
		const utcAnchor = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
		);
		const keys: string[] = [];
		for (let i = days - 1; i >= 0; i--) {
			const d = new Date(utcAnchor);
			d.setUTCDate(utcAnchor.getUTCDate() - i);
			keys.push(d.toISOString().slice(0, 10));
		}
		const submittedByDay = new Map<string, number>();
		const verifiedByDay = new Map<string, number>();
		for (const p of proofs) {
			const day = String(p.submittedAt).slice(0, 10);
			submittedByDay.set(day, (submittedByDay.get(day) ?? 0) + 1);
			if (p.status === 'verified') {
				verifiedByDay.set(day, (verifiedByDay.get(day) ?? 0) + 1);
			}
		}
		const bars = keys.map((k) => ({
			date: k,
			submitted: submittedByDay.get(k) ?? 0,
			verified: verifiedByDay.get(k) ?? 0
		}));
		const maxVal = Math.max(...bars.map((b) => b.submitted), 1);
		return { bars, maxVal };
	});

	// Failure rate by project
	let failureByProject = $derived.by(() => {
		const byApp = new Map<string, { total: number; failed: number }>();
		for (const p of proofs) {
			const entry = byApp.get(p.appId) ?? { total: 0, failed: 0 };
			entry.total++;
			if (p.status === 'rejected') entry.failed++;
			byApp.set(p.appId, entry);
		}
		return [...byApp.entries()]
			.filter(([, v]) => v.failed > 0)
			.sort((a, b) => b[1].failed - a[1].failed)
			.map(([appId, { total, failed }]) => ({
				appId,
				appName: appsById.get(appId)?.name ?? appId,
				total,
				failed
			}));
	});

	function statusColor(status: string): string {
		switch (status) {
			case 'active': return 'var(--success)';
			case 'proving': return 'var(--warning)';
			case 'slashed': return 'var(--error)';
			default: return 'var(--text-tertiary)';
		}
	}

	// Activity feed helpers
	function eventLabel(type: string): string {
		const labels: Record<string, string> = {
			proof_verified: 'Proof verified',
			payout_distributed: 'Payout',
			job_completed: 'Job completed',
			job_started: 'Job started',
			job_queued: 'Job queued',
			job_failed: 'Job failed',
			slash_applied: 'Slashing',
			proof_submitted: 'Proof submitted',
			proof_disputed: 'Dispute filed',
			proof_dispute_resolved: 'Dispute resolved',
			subscription_created: 'Subscribed',
			subscription_paused: 'Paused',
			subscription_resumed: 'Resumed',
			subscription_blocked: 'Blocked',
			withdrawal_requested: 'Withdrawal requested',
			withdrawal_completed: 'Withdrawal completed',
			wallet_connected: 'Wallet connected',
			badge_awarded: 'Badge earned'
		};
		return labels[type] ?? type.replace(/_/g, ' ');
	}

	function eventIconColor(type: string): string {
		const destructive = ['slash_applied', 'job_failed', 'subscription_blocked'];
		const success = ['proof_verified', 'payout_distributed', 'withdrawal_completed', 'badge_awarded'];
		if (destructive.includes(type)) return 'var(--error)';
		if (success.includes(type)) return 'var(--success)';
		return 'var(--text-secondary)';
	}

	// Toast helper
	let toastMessage = $state<string | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;
	function showToast(msg: string) {
		toastMessage = msg;
		if (toastTimeout) clearTimeout(toastTimeout);
		toastTimeout = setTimeout(() => { toastMessage = null; }, 3000);
	}
</script>

<svelte:head>
	<title>My Mining — Necter Mining App Store</title>
</svelte:head>

{#if !$actor}
	<!-- Not connected state -->
	<div class="flex items-center justify-center min-h-[60vh] p-6">
		<div
			class="bg-honeycomb bg-[var(--surface-1)] [background-image:var(--honeycomb-pattern)] border border-[var(--border-default)] rounded-lg px-10 py-12 text-center max-w-[400px] w-full"
		>
			<div class="w-12 h-12 mx-auto mb-4">
				<svg viewBox="0 0 48 48" fill="none">
					<polygon
						points="24,2 44.8,12.5 44.8,35.5 24,46 3.2,35.5 3.2,12.5"
						fill="var(--accent-subtle)"
						stroke="var(--accent-base)"
						stroke-width="1"
					/>
					<polygon
						points="24,12 33,17 33,27 24,32 15,27 15,17"
						fill="none"
						stroke="var(--accent-base)"
						stroke-width="0.8"
						opacity="0.4"
					/>
					<circle cx="24" cy="24" r="3" fill="var(--accent-base)" />
				</svg>
			</div>
			<p class="text-[13px] text-[var(--text-secondary)] mb-4 leading-5">
				Connect a wallet to view your mining dashboard.
			</p>
			<Button size="sm" class="text-[13px] px-4" onclick={() => showConnectModal.set(true)}>
				Connect Wallet
			</Button>
		</div>
	</div>
{:else}
	<div class="animate-fadeIn px-0 md:px-6 pt-4 md:pt-6 pb-6 md:pb-12">

		<!-- ── Page header ── -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 px-4 md:px-0">
			<div>
				<h1 class="text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">My Mining</h1>
				<p class="text-[12px] mt-0.5 hidden md:block text-[var(--text-tertiary)]">
					<span class="text-[var(--text-secondary)]">{subs.length}</span> projects &middot;
					<span class="text-[var(--text-secondary)]">{activeCount}</span> active &middot;
					<span class="text-[var(--text-secondary)] font-mono">{totalEarned.toFixed(2)}</span> NECTA earned
				</p>
			</div>
			<div class="flex gap-1">
				{#each [
					{ id: 'networks' as TabId, label: 'Dashboard' },
					{ id: 'earnings' as TabId, label: 'Earnings' },
					{ id: 'proofs' as TabId, label: 'Proofs' }
				] as btn}
					<Button
						variant="ghost"
						size="md"
						onclick={() => (tab = btn.id)}
						class="text-[13px] {tab === btn.id ? '!bg-[var(--accent-subtle)] !text-[var(--text-accent)]' : ''}"
					>
						{btn.label}
					</Button>
				{/each}
			</div>
		</div>

		<!-- ── Earnings tab ── -->
		{#if tab === 'earnings'}
			<div class="px-4 md:px-0">
				<EarningsPanel />
			</div>
		{/if}

		<!-- ── Proofs tab ── -->
		{#if tab === 'proofs'}
			<div class="px-4 md:px-0">
			{#if !minerId}
				<div class="py-8 text-center">
					<p class="text-[13px] text-[var(--text-tertiary)]">Connect a wallet to view proofs.</p>
				</div>
			{:else if proofs.length === 0}
				<div class="py-8 text-center">
					<p class="text-[13px] text-[var(--text-tertiary)]">No proofs yet. Subscribe to a project and start mining to generate proofs.</p>
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					<!-- Proof stats: 5 cards -->
					<div class="grid grid-cols-2 md:grid-cols-5 gap-[1px] rounded-lg overflow-hidden border bg-[var(--border-default)] border-[var(--border-default)]">
						{#each [
							{ label: 'Verified', value: String(verifiedCount), color: 'var(--success)' },
							{ label: 'Pending', value: String(pendingCount), color: 'var(--text-secondary)' },
							{ label: 'Rejected', value: String(rejectedCount), color: 'var(--error)' },
							{ label: 'Success Rate', value: `${successRate}%`, color: parseFloat(successRate) >= 90 ? 'var(--success)' : parseFloat(successRate) >= 50 ? 'var(--text-primary)' : 'var(--error)' },
							{ label: 'Avg Verify', value: avgVerifyTime, color: 'var(--text-primary)' }
						] as stat}
							<div class="p-3 md:p-4 flex flex-col gap-1 bg-[var(--surface-1)]">
								<span class="text-[10px] md:text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{stat.label}</span>
								<span class="text-[18px] md:text-[22px] font-semibold leading-7 -tracking-wide font-mono tabular-nums" style="color: {stat.color};">{stat.value}</span>
							</div>
						{/each}
					</div>

					<!-- Daily rate chart — stacked submitted/verified -->
					{#if proofsDailyRate.bars.length > 0}
						<Card padding="px-4 py-3.5" class="overflow-hidden">
							<div class="flex items-center justify-between mb-2.5">
								<span class="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">Proof Rate (14d)</span>
							</div>
							<div class="flex items-end gap-[3px]" style="height: 60px;">
								{#each proofsDailyRate.bars as bar}
									{@const totalH = bar.submitted > 0 ? (bar.submitted / proofsDailyRate.maxVal) * 60 : 0}
									{@const verifiedH = bar.verified > 0 ? (bar.verified / proofsDailyRate.maxVal) * 60 : 0}
									<div
										title="{bar.date}: {bar.verified}/{bar.submitted}"
										style="flex: 1; position: relative; height: {totalH}px; cursor: default; transition: transform 100ms;"
									>
										<div style="position: absolute; bottom: 0; left: 0; right: 0; height: {totalH}px; border-radius: 2px 2px 0 0; background: var(--surface-3);"></div>
										<div style="position: absolute; bottom: 0; left: 0; right: 0; height: {verifiedH}px; border-radius: 2px 2px 0 0; background: var(--success); opacity: 0.7;"></div>
									</div>
								{/each}
							</div>
							<div class="flex items-center gap-3 mt-1.5">
								<div class="flex items-center gap-1">
									<div class="w-2 h-2 rounded-sm bg-[var(--surface-3)]"></div>
									<span class="text-[10px] text-[var(--text-tertiary)]">Submitted</span>
								</div>
								<div class="flex items-center gap-1">
									<div class="w-2 h-2 rounded-sm bg-[var(--success)] opacity-70"></div>
									<span class="text-[10px] text-[var(--text-tertiary)]">Verified</span>
								</div>
							</div>
						</Card>
					{/if}

					<!-- Failure Rate by Project -->
					{#if failureByProject.length > 0}
						<Card padding="px-4 py-3.5" class="overflow-hidden">
							<span class="text-[11px] font-semibold tracking-widest uppercase block mb-2.5 text-[var(--text-tertiary)]">Failure Rate by Project</span>
							<div class="flex flex-col gap-2">
								{#each failureByProject as p}
									{@const failRate = p.total > 0 ? (p.failed / p.total) * 100 : 0}
									<div class="flex items-center gap-2.5">
										<span class="text-[12px] w-[120px] overflow-hidden text-ellipsis whitespace-nowrap shrink-0 text-[var(--text-primary)]">{p.appName}</span>
										<div class="flex-1 h-1 rounded-sm overflow-hidden bg-[var(--surface-3)]">
											<div class="h-1 rounded-sm bg-[var(--error)] opacity-70" style="width: {failRate}%;"></div>
										</div>
										<span class="text-[11px] w-[55px] text-right shrink-0 font-mono text-[var(--error)]">{p.failed}/{p.total}</span>
									</div>
								{/each}
							</div>
						</Card>
					{/if}

					<!-- Proof table -->
					<Card padding="p-0" class="overflow-hidden">
						<!-- Mobile proof list -->
						<div class="md:hidden">
							{#each sortedProofs as proof, idx}
								{@const proofApp = appsById.get(proof.appId)}
								{@const proofStatusColor = proof.status === 'verified' ? 'var(--success)' : proof.status === 'rejected' ? 'var(--error)' : 'var(--text-secondary)'}
								{@const proofStatusLabel = proof.disputeFiledAt ? (proof.disputeResolvedAt ? (proof.disputeOutcome === 'accepted' ? 'Won' : 'Denied') : 'Disputed') : proof.status}
								{@const proofDisputeColor = proof.disputeFiledAt ? (proof.disputeResolvedAt ? (proof.disputeOutcome === 'accepted' ? 'var(--success)' : 'var(--error)') : 'var(--warning)') : proofStatusColor}
								<a
									href="/mining/proofs/{proof.id}"
									class="flex items-center gap-3 px-3 py-2.5 no-underline transition-colors hover:bg-[var(--surface-2)]"
									style="{idx !== 0 ? 'border-top: 1px solid var(--border-default);' : ''}"
								>
									{#if proofApp}
										<img
											src={appIcon(proofApp)}
											alt={proofApp.name}
											width="28"
											height="28"
											class="rounded-[5px] shrink-0"
											loading="lazy"
										/>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">
											{proofApp?.name ?? proof.appId}
										</div>
										<div class="text-[11px] text-[var(--text-tertiary)]">
											{proof.hash.slice(0, 10)}... &middot;
											{new Date(proof.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
										</div>
									</div>
									<div class="flex flex-col items-end gap-0.5 shrink-0">
										<span class="text-[11px] font-medium capitalize" style="color: {proofDisputeColor};">{proofStatusLabel}</span>
										<span class="text-[12px] font-semibold font-mono text-[var(--text-primary)] tabular-nums">${proof.reward.toFixed(2)}</span>
									</div>
								</a>
							{/each}
						</div>

						<!-- Desktop proof table -->
						<div class="hidden md:block">
							<div
								class="grid h-8 px-3 items-center border-b border-[var(--border-default)] [grid-template-columns:1fr_120px_80px_80px_80px]"
							>
								{#each ['Project', 'Proof Hash', 'Status', 'Reward', 'Date'] as col, i}
									<span
										class="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]"
										style="text-align: {i > 0 ? 'right' : 'left'};"
									>
										{col}
									</span>
								{/each}
							</div>
							{#each sortedProofs as proof, idx}
								{@const proofApp = appsById.get(proof.appId)}
								{@const proofStatusColor = proof.status === 'verified' ? 'var(--success)' : proof.status === 'rejected' ? 'var(--error)' : 'var(--text-secondary)'}
								{@const proofStatusLabel = proof.disputeFiledAt ? (proof.disputeResolvedAt ? (proof.disputeOutcome === 'accepted' ? 'Won' : 'Denied') : 'Disputed') : proof.status}
								{@const proofDisputeColor = proof.disputeFiledAt ? (proof.disputeResolvedAt ? (proof.disputeOutcome === 'accepted' ? 'var(--success)' : 'var(--error)') : 'var(--warning)') : proofStatusColor}
								<a
									href="/mining/proofs/{proof.id}"
									class="grid h-10 px-3 items-center no-underline transition-colors hover:bg-[var(--surface-2)] [grid-template-columns:1fr_120px_80px_80px_80px]"
									style="{idx !== 0 ? 'border-top: 1px solid var(--border-default);' : ''}"
								>
									<div class="flex items-center gap-2 min-w-0">
										{#if proofApp}
											<img
												src={appIcon(proofApp)}
												alt={proofApp.name}
												width="22"
												height="22"
												class="rounded-[4px] shrink-0"
												loading="lazy"
											/>
										{/if}
										<span class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">
											{proofApp?.name ?? proof.appId}
										</span>
									</div>
									<span class="text-[11px] text-right font-mono text-[var(--text-tertiary)]">
										{proof.hash.slice(0, 10)}...
									</span>
									<span class="text-[11px] font-medium text-right capitalize" style="color: {proofDisputeColor};">
										{proofStatusLabel}
									</span>
									<span class="text-[12px] font-semibold text-right font-mono text-[var(--text-primary)] tabular-nums">
										${proof.reward.toFixed(2)}
									</span>
									<span class="text-[11px] text-right text-[var(--text-tertiary)]">
										{new Date(proof.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
									</span>
								</a>
							{/each}
						</div>
					</Card>
				</div>
			{/if}
			</div>
		{/if}

		<!-- ── Dashboard tab ── -->
		{#if tab === 'networks'}

			<!-- ════════════════════════════════════
			     MOBILE: Clean focused layout
			     ════════════════════════════════════ -->
			<div class="md:hidden flex flex-col gap-3 px-4">
				<!-- 3 key stats -->
				<div class="grid grid-cols-3 gap-2">
					<StatCard label="Today" value={earnedToday.toFixed(2)} />
					<StatCard label="7 Days" value={earned7d.toFixed(2)} />
					<StatCard label="30 Days" value={earned30d.toFixed(2)} />
				</div>

				<!-- Chart on mobile: HTML bar chart -->
				<Card padding="p-0" class="overflow-hidden">
					<div class="px-3 py-2 border-b border-[var(--border-default)]">
						<span class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">30-day earnings</span>
					</div>
					<div class="px-2 py-2">
						<div class="relative" style="height: 180px;">
							{#if mobileTooltip !== null}
								{@const d = earningsSeries[mobileTooltip.index]}
								<div
									class="absolute z-10 pointer-events-none bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] font-mono whitespace-nowrap mb-1"
								style="bottom: 100%; left: {mobileTooltip.x}px; transform: translateX(-50%);"
								>
									<span class="text-[var(--text-tertiary)]">{d.date}</span>: {d.value.toFixed(4)} NECTA
								</div>
							{/if}
							<div class="flex items-end gap-[2px] h-full">
								{#each earningsSeries as d, i}
									{@const h = d.value > 0 ? Math.max(3, (d.value / chartMax) * 170) : 2}
									<div
										role="img"
										aria-label="{d.date}: {d.value.toFixed(4)} NECTA"
										style="flex: 1; height: {h}px; border-radius: 1.5px 1.5px 0 0; background: {mobileTooltip?.index === i ? 'var(--accent-base)' : i === earningsSeries.length - 1 ? 'var(--accent-base)' : 'var(--accent-subtle)'}; cursor: default; transition: background 80ms;"
										onmouseenter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const parent = e.currentTarget.parentElement!.getBoundingClientRect(); mobileTooltip = { index: i, x: rect.left - parent.left + rect.width / 2 }; }}
										onmouseleave={() => { mobileTooltip = null; }}
									></div>
								{/each}
							</div>
						</div>
						<div class="flex justify-between mt-1">
							<span class="text-[9px] text-[var(--text-tertiary)] font-mono">
								{(() => { const d = new Date(earningsSeries[0]?.date ?? ''); return `${d.getMonth()+1}/${d.getDate()}`; })()}
							</span>
							<span class="text-[9px] text-[var(--text-tertiary)] font-mono">Today</span>
						</div>
					</div>
				</Card>

				<!-- Subscriptions card (mobile) -->
				<Card padding="p-0" class="overflow-hidden">
					<div class="px-3 py-2.5 border-b border-[var(--border-default)] flex items-center justify-between">
						<span class="text-[13px] font-semibold text-[var(--text-primary)]">Subscriptions</span>
						<a href="/mining/subscriptions" class="text-[11px] font-medium no-underline text-[var(--text-accent)]">
							View All ({subs.length})
						</a>
					</div>

					{#if subs.length === 0}
						<div class="text-center overflow-hidden">
							<div class="w-full h-[140px] overflow-hidden">
								<img src="/brand/hero-honeycomb.png" alt="" class="w-full h-full object-cover object-bottom opacity-60" loading="lazy" />
							</div>
							<div class="px-4 pt-4 pb-6">
								<p class="text-[13px] mb-3 text-[var(--text-secondary)]">You are not mining any projects yet.</p>
								<a href="/discover"><Button>Discover projects</Button></a>
							</div>
						</div>
					{:else}
						{#each subs as s, idx}
							{@const app = appsById.get(s.appId)}
							{@const iconSrc = app?.icon && app.icon !== '/placeholder.svg' ? app.icon : app ? appIconDataUri({ id: app.id, name: app.name }) : '/placeholder.svg'}
							<a
								href="/mining/{encodeURIComponent(s.id)}"
								class="flex items-center gap-2.5 px-3 py-2.5 no-underline transition-colors hover:bg-[var(--surface-2)]"
								style="{idx !== 0 ? 'border-top: 1px solid var(--border-default);' : ''}"
							>
								{#if app}
									<img src={iconSrc} alt={app.name} width="28" height="28" class="rounded-[5px] shrink-0" loading="lazy" />
								{/if}
								<div class="min-w-0 flex-1">
									<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">
										{app?.name ?? s.appId}
									</div>
									<div class="text-[11px] text-[var(--text-tertiary)]">
										{s.totalEarned.toFixed(2)} NECTA &middot; {s.uptime.toFixed(0)}%
									</div>
								</div>
							</a>
						{/each}
					{/if}
				</Card>
			</div>

			<!-- ════════════════════════════════════
			     DESKTOP: Full dashboard layout
			     ════════════════════════════════════ -->
			<div class="hidden md:flex flex-col gap-4">

				<!-- 5 stat cards -->
				<div
					class="grid gap-[1px] rounded-lg overflow-hidden border grid-cols-5 bg-[var(--border-default)] border-[var(--border-default)]"
				>
					{#each [
						{ label: 'Today', value: earnedToday.toFixed(2), isReputation: false, muted: false },
						{ label: 'Last 7d', value: earned7d.toFixed(2), isReputation: false, muted: false },
						{ label: 'Last 30d', value: earned30d.toFixed(2), isReputation: false, muted: false },
						{ label: 'Pending', value: pendingRewards.toFixed(2), isReputation: false, muted: true },
						{ label: 'Reputation', value: reputation, isReputation: true, muted: false }
					] as stat}
						<div class="p-4 flex flex-col gap-0.5 bg-[var(--surface-1)]">
							<span class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{stat.label}</span>
							<span
								class="text-[22px] font-semibold leading-7 -tracking-wide font-mono tabular-nums"
								style="color: {stat.isReputation ? (parseFloat(stat.value) >= 80 ? 'var(--text-accent)' : 'var(--text-primary)') : stat.muted ? 'var(--text-secondary)' : 'var(--text-primary)'};"
							>
								{stat.value}
							</span>
							<span class="text-[11px] text-[var(--text-tertiary)]">{stat.isReputation ? 'score' : 'NECTA'}</span>
						</div>
					{/each}
				</div>

				<!-- Chart + side panels -->
				<div class="grid gap-3 items-start [grid-template-columns:1fr_300px]">

					<!-- Earnings bar chart -->
					<Card padding="p-0" class="overflow-hidden">
						<div class="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
							<span class="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">30-day earnings</span>
						</div>
						<div class="px-4 py-3">
							<div class="relative" style="height: 340px;">
								{#if desktopTooltip !== null}
									{@const td = earningsSeries[desktopTooltip.index]}
									<div
										class="absolute z-10 pointer-events-none bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] font-mono whitespace-nowrap mb-1"
										style="bottom: 100%; left: {desktopTooltip.x}px; transform: translateX(-50%);"
									>
										<span class="text-[var(--text-tertiary)]">{td.date}</span>: {td.value.toFixed(4)} NECTA
									</div>
								{/if}
								<div class="flex items-end gap-[2px] h-full">
									{#each earningsSeries as d, i}
										{@const h = d.value > 0 ? Math.max(4, (d.value / chartMax) * 330) : 2}
										<div
											role="img"
											aria-label="{d.date}: {d.value.toFixed(4)} NECTA"
											style="flex: 1; height: {h}px; border-radius: 2px 2px 0 0; background: {desktopTooltip?.index === i ? 'var(--accent-base)' : i === earningsSeries.length - 1 ? 'var(--accent-base)' : 'var(--accent-subtle)'}; transition: height 200ms ease-out, background 80ms; cursor: default;"
											onmouseenter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const parent = e.currentTarget.parentElement!.getBoundingClientRect(); desktopTooltip = { index: i, x: rect.left - parent.left + rect.width / 2 }; }}
											onmouseleave={() => { desktopTooltip = null; }}
										></div>
									{/each}
								</div>
							</div>
							<div class="flex justify-between mt-1.5">
								<span class="text-[10px] text-[var(--text-tertiary)] font-mono">
									{(() => { const d = new Date(earningsSeries[0]?.date ?? ''); return `${d.getMonth()+1}/${d.getDate()}`; })()}
								</span>
								<span class="text-[10px] text-[var(--text-tertiary)] font-mono">Today</span>
							</div>
						</div>
					</Card>

					<!-- Side panels -->
					<div class="flex flex-col gap-2">
						<!-- Latest payouts -->
						<Card padding="p-0" class="overflow-hidden">
							<div class="px-3 py-2.5 border-b border-[var(--border-default)] flex items-center gap-1.5">
								<span class="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">Latest payouts</span>
							</div>
							<div class="py-1 max-h-44 overflow-y-auto">
								{#if latestPayouts.length === 0}
									<p class="text-xs px-3 py-2.5 text-[var(--text-tertiary)]">No payouts yet.</p>
								{:else}
									{#each latestPayouts as p}
										{@const href = p.subscriptionId ? `/mining/${encodeURIComponent(p.subscriptionId)}` : '/mining'}
										<a
											{href}
											class="flex items-center justify-between gap-2 h-8 px-3 no-underline transition-colors hover:bg-[var(--surface-2)]"
										>
											<span class="text-[11px] shrink-0 text-[var(--text-tertiary)] font-mono">{relativeTime(p.createdAt)}</span>
											<span class="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0 text-[var(--text-secondary)]" title={p.app?.name ?? p.appId}>
												{p.app?.name ?? p.appId}
											</span>
											<span class="text-[11px] font-semibold shrink-0 font-mono text-[var(--success)] tabular-nums">
												+{Number(p.minerAmount).toFixed(4)}
											</span>
										</a>
									{/each}
								{/if}
							</div>
						</Card>

						<!-- Top projects -->
						<Card padding="p-0" class="overflow-hidden">
							<div class="px-3 py-2.5 border-b border-[var(--border-default)]">
								<span class="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">Top projects</span>
							</div>
							<div class="py-1">
								{#if topNetworks.length === 0}
									<p class="text-xs px-3 py-2.5 text-[var(--text-tertiary)]">No payouts yet.</p>
								{:else}
									{#each topNetworks as x}
										<a
											href="/apps/{x.appId}"
											class="flex items-center justify-between h-9 px-3 gap-2 no-underline transition-colors hover:bg-[var(--surface-2)]"
										>
											<div class="min-w-0 flex-1">
												<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">
													{x.app?.name ?? x.appId}
												</div>
												<div class="text-[11px] overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-tertiary)]">
													{x.app?.category ?? ''}
												</div>
											</div>
											<span class="text-[12px] shrink-0 font-mono text-[var(--text-secondary)] tabular-nums">
												{x.amount.toFixed(4)}
											</span>
										</a>
									{/each}
								{/if}
							</div>
						</Card>

					</div>
				</div>

				<!-- Subscriptions card (desktop) -->
				<Card padding="p-0" class="overflow-hidden">
					<div class="px-4 pt-3.5 pb-3 border-b border-[var(--border-default)] flex items-center justify-between">
						<div>
							<h3 class="text-sm font-semibold m-0 -tracking-tight text-[var(--text-primary)]">Subscriptions</h3>
							<p class="text-[11px] mt-0.5 mb-0 text-[var(--text-tertiary)]">Click a row to open its detail page</p>
						</div>
						<a href="/mining/subscriptions" class="text-xs font-medium no-underline shrink-0 text-[var(--text-accent)]">
							View All ({subs.length})
						</a>
					</div>

					{#if subs.length === 0}
						<div class="text-center overflow-hidden">
							<div class="w-full h-[140px] overflow-hidden">
								<img src="/brand/hero-honeycomb.png" alt="" class="w-full h-full object-cover object-bottom opacity-60" loading="lazy" />
							</div>
							<div class="px-6 pt-5 pb-7">
								<p class="text-[13px] mb-4 text-[var(--text-secondary)]">You are not mining any projects yet.</p>
								<a href="/discover"><Button>Discover projects</Button></a>
							</div>
						</div>
					{:else}
						<!-- Grid table header -->
						<div
							class="grid h-8 px-3 items-center border-b border-[var(--border-default)] [grid-template-columns:1fr_80px_80px_80px_80px_80px]"
						>
							{#each ['Project', 'Status', 'Earned', 'Tasks', 'Uptime', ''] as col, i}
								<span
									class="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]"
									style="text-align: {i > 0 ? 'right' : 'left'}; {i > 0 && i < 5 ? 'padding-right: 8px;' : ''}"
								>
									{col}
								</span>
							{/each}
						</div>

						{#each subs as s, idx}
							{@const app = appsById.get(s.appId)}
							{@const iconSrc = app?.icon && app.icon !== '/placeholder.svg' ? app.icon : app ? appIconDataUri({ id: app.id, name: app.name }) : '/placeholder.svg'}
							<a
								href="/mining/{encodeURIComponent(s.id)}"
								class="grid h-11 px-3 items-center no-underline transition-colors hover:bg-[var(--surface-2)] [grid-template-columns:1fr_80px_80px_80px_80px_80px]"
								style="{idx !== 0 ? 'border-top: 1px solid var(--border-default);' : ''}"
							>
								<!-- App name + icon -->
								<div class="flex items-center gap-2.5 min-w-0">
									{#if app}
										<img src={iconSrc} alt={app.name} width="28" height="28" class="rounded-[5px] shrink-0" loading="lazy" />
									{/if}
									<div class="min-w-0">
										<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">{app?.name ?? s.appId}</div>
										<div class="text-[11px] overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-tertiary)]">{app?.developer ?? ''}</div>
									</div>
								</div>

								<!-- Status -->
								<div class="flex items-center justify-end gap-[5px] pr-2">
									<span class={statusDotClass(s.status)}></span>
									<span class="text-[11px] font-medium capitalize" style="color: {statusColor(s.status)};">
										{s.status}
									</span>
								</div>

								<!-- Earned -->
								<span class="text-[12px] text-right pr-2 font-mono text-[var(--text-primary)] tabular-nums">
									{s.totalEarned.toFixed(2)}
								</span>

								<!-- Tasks -->
								<span class="text-[12px] text-right pr-2 font-mono text-[var(--text-secondary)] tabular-nums">
									{s.tasksCompleted}
								</span>

								<!-- Uptime -->
								<span class="text-[12px] text-right pr-2 font-mono text-[var(--text-secondary)] tabular-nums">
									{s.uptime.toFixed(1)}%
								</span>

								<!-- Arrow -->
								<div class="flex justify-end">
									<ArrowUpRight size={14} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
								</div>
							</a>
						{/each}
					{/if}
				</Card>

				<!-- Recommendations -->
				{#if recommendations.length > 0}
					<Card padding="p-0" class="overflow-hidden">
						<div class="px-4 py-2.5 border-b border-[var(--border-default)] flex items-center justify-between gap-3">
							<div>
								<span class="text-[14px] font-semibold -tracking-tight text-[var(--text-primary)]">Recommended for you</span>
								<p class="text-[12px] mt-0.5 text-[var(--text-tertiary)]">Based on your hardware profile and project performance</p>
							</div>
							<a href="/discover" class="inline-flex items-center gap-1 text-[12px] no-underline shrink-0 text-[var(--text-accent)]">
								Browse all
								<ArrowUpRight size={12} strokeWidth={1.5} />
							</a>
						</div>
						<div class="grid gap-[1px] grid-cols-3 bg-[var(--border-default)]">
							{#each recommendations as app}
								<a
									href="/apps/{app.id}"
									class="flex items-center gap-2.5 p-3 no-underline transition-colors hover:bg-[var(--surface-2)] bg-[var(--surface-1)]"
								>
									<img src={appIcon(app)} alt={app.name} width="32" height="32" class="rounded-[5px] shrink-0" loading="lazy" />
									<div class="min-w-0 flex-1">
										<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)]">
											{app.name}
										</div>
										<div class="text-[11px] text-[var(--text-tertiary)] font-mono tabular-nums">
											${app.avgEarningsPerDay.toFixed(2)}/day &middot; {app.reputationScore.toFixed(0)} rep
										</div>
									</div>
									<Button size="sm" class="shrink-0" onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (!$actor) { showConnectModal.set(true); return; } if (minerId) { try { backend.subscribeToApp({ appId: app.id, minerId }); showToast(`Subscribed to ${app.name}`); } catch {} } }}>Subscribe</Button>
								</a>
							{/each}
						</div>
					</Card>
				{/if}

				<!-- Recent Activity — desktop only -->
				{#if recentEvents.length > 0}
					<Card padding="p-0" class="hidden md:block overflow-hidden">
						<div class="px-4 py-2.5 border-b border-[var(--border-default)] flex items-center justify-between">
							<span class="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</span>
							<span class="text-[12px] tabular-nums text-[var(--text-secondary)]">{recentEvents.length}</span>
						</div>
						<div class="divide-y divide-[var(--border-default)]">
							{#each recentEvents.slice(0, 4) as evt}
								<div class="flex items-center gap-3 px-4 py-2.5">
									<span
										class="inline-flex h-6 w-6 items-center justify-center rounded shrink-0 bg-[var(--surface-2)]"
									>
										<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
											<circle cx="6" cy="6" r="3" fill={eventIconColor(evt.type)} />
										</svg>
									</span>
									<div class="min-w-0 flex-1">
										<span class="text-[12px] block overflow-hidden text-ellipsis whitespace-nowrap">
											<span class="font-medium text-[var(--text-primary)]">{eventLabel(evt.type)}</span>
											<span class="text-[var(--text-secondary)]"> &middot; {evt.message}</span>
										</span>
									</div>
									<span class="text-[11px] shrink-0 text-[var(--text-secondary)]">{relativeTime(evt.createdAt)}</span>
								</div>
							{/each}
						</div>
					</Card>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Toast notification -->
	{#if toastMessage}
		<div
			class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-[13px] font-medium shadow-lg bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border-default)]"
		>
			{toastMessage}
		</div>
	{/if}
{/if}
