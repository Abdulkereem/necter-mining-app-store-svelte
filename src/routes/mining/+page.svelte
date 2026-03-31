<script lang="ts">
	import { page } from '$app/stores';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, wallet, showConnectModal } from '$lib/stores/wallet';
	import { appIconDataUri } from '$lib/app-icon';
	import { badgeIconDataUri } from '$lib/badge-icon';
	import EarningsPanel from '$lib/components/mining/EarningsPanel.svelte';
	import { ArrowUpRight } from 'lucide-svelte';
	import type { App } from '$lib/types';

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

	let minerBadges = $derived(minerId ? backend.listBadges(minerId) : []);

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

	// Proofs daily rate chart (last 14 days)
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
		const byDay = new Map<string, number>();
		for (const p of proofs) {
			const day = String(p.submittedAt).slice(0, 10);
			byDay.set(day, (byDay.get(day) ?? 0) + 1);
		}
		const bars = keys.map((k) => ({ date: k, count: byDay.get(k) ?? 0 }));
		const maxVal = Math.max(...bars.map((b) => b.count), 1);
		return { bars, maxVal };
	});

	// Proofs failure breakdown
	let failureBreakdown = $derived.by(() => {
		const rejected = proofs.filter((p) => p.status === 'rejected');
		const reasons = new Map<string, number>();
		for (const p of rejected) {
			const reason = (p as any).rejectReason ?? 'Unknown';
			reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
		}
		return [...reasons.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([reason, count]) => ({ reason, count }));
	});

	function statusColor(status: string): string {
		switch (status) {
			case 'active': return 'var(--success)';
			case 'proving': return 'var(--warning)';
			case 'slashed': return 'var(--error)';
			default: return 'var(--text-tertiary)';
		}
	}
</script>

{#if !$actor}
	<!-- Not connected state -->
	<div class="flex items-center justify-center min-h-[60vh] p-6">
		<div
			class="bg-honeycomb"
			style="background: var(--surface-1); background-image: var(--honeycomb-pattern); border: 1px solid var(--border-default); border-radius: 8px; padding: 48px 40px; text-align: center; max-width: 400px; width: 100%;"
		>
			<div style="width: 48px; height: 48px; margin: 0 auto 16px;">
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
			<p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; line-height: 20px;">
				Connect a wallet to view your mining dashboard.
			</p>
			<button
				class="btn-subscribe"
				onclick={() => showConnectModal.set(true)}
				style="font-size: 13px; height: 32px; padding: 0 16px;"
			>
				Connect Wallet
			</button>
		</div>
	</div>
{:else}
	<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-6 md:pb-12">

		<!-- ── Page header ── -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
			<div>
				<h1 class="text-[20px] font-semibold tracking-tight" style="color: var(--text-primary);">My Mining</h1>
				<p class="text-[12px] mt-0.5 hidden md:block" style="color: var(--text-tertiary);">
					<span style="color: var(--text-secondary);">{subs.length}</span> projects &middot;
					<span style="color: var(--text-secondary);">{activeCount}</span> active &middot;
					<span style="color: var(--text-secondary); font-family: var(--font-mono);">{totalEarned.toFixed(2)}</span> NECTA earned
				</p>
			</div>
			<div class="flex gap-1">
				{#each [
					{ id: 'networks' as TabId, label: 'Dashboard' },
					{ id: 'earnings' as TabId, label: 'Earnings' },
					{ id: 'proofs' as TabId, label: 'Proofs' }
				] as btn}
					<button
						type="button"
						onclick={() => (tab = btn.id)}
						class="inline-flex items-center h-[32px] px-3 rounded-[5px] text-[13px] font-medium border-none cursor-pointer transition-colors"
						style="background: {tab === btn.id ? 'var(--accent-subtle)' : 'var(--surface-1)'}; color: {tab === btn.id ? 'var(--text-accent)' : 'var(--text-secondary)'};"
					>
						{btn.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- ── Earnings tab ── -->
		{#if tab === 'earnings'}
			<EarningsPanel />
		{/if}

		<!-- ── Proofs tab ── -->
		{#if tab === 'proofs'}
			{#if !minerId}
				<div class="py-8 text-center">
					<p class="text-[13px]" style="color: var(--text-tertiary);">Connect a wallet to view proofs.</p>
				</div>
			{:else if proofs.length === 0}
				<div class="py-8 text-center">
					<p class="text-[13px]" style="color: var(--text-tertiary);">No proofs yet. Subscribe to a network and start mining to generate proofs.</p>
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					<!-- Proof stats: 5 cards -->
					<div class="grid grid-cols-2 md:grid-cols-5 gap-[1px] rounded-lg overflow-hidden border" style="background: var(--border-default); border-color: var(--border-default);">
						{#each [
							{ label: 'Verified', value: String(verifiedCount), color: 'var(--success)' },
							{ label: 'Pending', value: String(pendingCount), color: 'var(--text-secondary)' },
							{ label: 'Rejected', value: String(rejectedCount), color: 'var(--error)' },
							{ label: 'Success Rate', value: `${successRate}%`, color: parseFloat(successRate) >= 90 ? 'var(--success)' : parseFloat(successRate) >= 50 ? 'var(--text-primary)' : 'var(--error)' },
							{ label: 'Avg Verify', value: avgVerifyTime, color: 'var(--text-primary)' }
						] as stat}
							<div class="p-3 md:p-4 flex flex-col gap-1" style="background: var(--surface-1);">
								<span class="text-[10px] md:text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-tertiary);">{stat.label}</span>
								<span class="text-[18px] md:text-[22px] font-semibold leading-7 -tracking-wide" style="font-family: var(--font-mono); color: {stat.color}; font-feature-settings: 'tnum' 1;">{stat.value}</span>
							</div>
						{/each}
					</div>

					<!-- Daily rate chart -->
					<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
						<div class="px-3 md:px-4 py-2 md:py-3 border-b flex items-center justify-between" style="border-color: var(--border-default);">
							<span class="text-[11px] font-semibold tracking-widest uppercase" style="color: var(--text-tertiary);">Daily proof rate (14d)</span>
						</div>
						<div class="px-4 py-3">
							<div class="flex items-end gap-[3px]" style="height: 100px;">
								{#each proofsDailyRate.bars as bar, i}
									{@const h = bar.count > 0 ? Math.max(4, (bar.count / proofsDailyRate.maxVal) * 100) : 2}
									<div
										title="{bar.count} proofs on {bar.date}"
										style="flex: 1; height: {h}px; border-radius: 2px 2px 0 0; background: {i === proofsDailyRate.bars.length - 1 ? 'var(--accent-base)' : 'var(--accent-subtle)'}; transition: height 200ms ease-out; cursor: default;"
									></div>
								{/each}
							</div>
							<div class="flex justify-between mt-1.5">
								<span class="text-[10px]" style="color: var(--text-tertiary); font-family: var(--font-mono);">
									{(() => { const d = new Date(proofsDailyRate.bars[0]?.date ?? ''); return `${d.getMonth()+1}/${d.getDate()}`; })()}
								</span>
								<span class="text-[10px]" style="color: var(--text-tertiary); font-family: var(--font-mono);">Today</span>
							</div>
						</div>
					</div>

					<!-- Failure breakdown (if any rejections) -->
					{#if failureBreakdown.length > 0}
						<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
							<div class="px-3 md:px-4 py-2 md:py-3 border-b" style="border-color: var(--border-default);">
								<span class="text-[11px] font-semibold tracking-widest uppercase" style="color: var(--text-tertiary);">Failure breakdown</span>
							</div>
							<div class="p-3 md:p-4 flex flex-col gap-2">
								{#each failureBreakdown as item}
									<div class="flex items-center justify-between gap-3">
										<span class="text-[12px] font-medium" style="color: var(--text-secondary);">{item.reason}</span>
										<div class="flex items-center gap-2 flex-1 min-w-0 max-w-[200px]">
											<div class="flex-1 h-[6px] rounded-full overflow-hidden" style="background: var(--surface-2);">
												<div
													class="h-full rounded-full"
													style="width: {Math.min(100, (item.count / rejectedCount) * 100)}%; background: var(--error);"
												></div>
											</div>
											<span class="text-[11px] shrink-0" style="font-family: var(--font-mono); color: var(--text-tertiary);">{item.count}</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Proof table -->
					<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
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
										/>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--text-primary);">
											{proofApp?.name ?? proof.appId}
										</div>
										<div class="text-[11px]" style="color: var(--text-tertiary);">
											{proof.hash.slice(0, 10)}... &middot;
											{new Date(proof.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
										</div>
									</div>
									<div class="flex flex-col items-end gap-0.5 shrink-0">
										<span class="text-[11px] font-medium capitalize" style="color: {proofDisputeColor};">{proofStatusLabel}</span>
										<span class="text-[12px] font-semibold" style="font-family: var(--font-mono); color: var(--text-primary); font-feature-settings: 'tnum' 1;">${proof.reward.toFixed(2)}</span>
									</div>
								</a>
							{/each}
						</div>

						<!-- Desktop proof table -->
						<div class="hidden md:block">
							<div
								class="grid h-8 px-3 items-center border-b"
								style="grid-template-columns: 1fr 120px 80px 80px 80px; border-color: var(--border-default);"
							>
								{#each ['Network', 'Proof Hash', 'Status', 'Reward', 'Date'] as col, i}
									<span
										class="text-[10px] font-semibold tracking-widest uppercase"
										style="color: var(--text-tertiary); text-align: {i > 0 ? 'right' : 'left'};"
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
									class="grid h-10 px-3 items-center no-underline transition-colors hover:bg-[var(--surface-2)]"
									style="grid-template-columns: 1fr 120px 80px 80px 80px; {idx !== 0 ? 'border-top: 1px solid var(--border-default);' : ''}"
								>
									<div class="flex items-center gap-2 min-w-0">
										{#if proofApp}
											<img
												src={appIcon(proofApp)}
												alt={proofApp.name}
												width="22"
												height="22"
												class="rounded-[4px] shrink-0"
											/>
										{/if}
										<span class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--text-primary);">
											{proofApp?.name ?? proof.appId}
										</span>
									</div>
									<span class="text-[11px] text-right" style="font-family: var(--font-mono); color: var(--text-tertiary);">
										{proof.hash.slice(0, 10)}...
									</span>
									<span class="text-[11px] font-medium text-right capitalize" style="color: {proofDisputeColor};">
										{proofStatusLabel}
									</span>
									<span class="text-[12px] font-semibold text-right" style="font-family: var(--font-mono); color: var(--text-primary); font-feature-settings: 'tnum' 1;">
										${proof.reward.toFixed(2)}
									</span>
									<span class="text-[11px] text-right" style="color: var(--text-tertiary);">
										{new Date(proof.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
									</span>
								</a>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		{/if}

		<!-- ── Dashboard tab ── -->
		{#if tab === 'networks'}

			<!-- ════════════════════════════════════
			     MOBILE: Clean focused layout
			     ════════════════════════════════════ -->
			<div class="md:hidden flex flex-col gap-3">
				<!-- 3 key stats -->
				<div class="grid grid-cols-3 gap-2">
					{#each [
						{ label: 'Today', value: earnedToday.toFixed(2) },
						{ label: '7 Days', value: earned7d.toFixed(2) },
						{ label: '30 Days', value: earned30d.toFixed(2) }
					] as stat}
						<div class="p-3 rounded-lg border" style="background: var(--surface-1); border-color: var(--border-default);">
							<span class="text-[10px] font-medium uppercase tracking-wide block" style="color: var(--text-tertiary);">{stat.label}</span>
							<span class="text-[18px] font-semibold block mt-1" style="font-family: var(--font-mono); color: var(--text-primary); font-feature-settings: 'tnum' 1;">{stat.value}</span>
							<span class="text-[10px]" style="color: var(--text-tertiary);">NECTA</span>
						</div>
					{/each}
				</div>

				<!-- Chart on mobile: HTML bar chart -->
				<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
					<div class="px-3 py-2 border-b" style="border-color: var(--border-default);">
						<span class="text-[10px] font-semibold uppercase tracking-wide" style="color: var(--text-tertiary);">30-day earnings</span>
					</div>
					<div class="px-2 py-2">
						<div class="flex items-end gap-[2px]" style="height: 180px;">
							{#each earningsSeries as d, i}
								{@const h = d.value > 0 ? Math.max(3, (d.value / chartMax) * 170) : 2}
								<div
									title="{d.date}: {d.value.toFixed(4)} NECTA"
									style="flex: 1; height: {h}px; border-radius: 1.5px 1.5px 0 0; background: {i === earningsSeries.length - 1 ? 'var(--accent-base)' : 'var(--accent-subtle)'}; cursor: default;"
								></div>
							{/each}
						</div>
						<div class="flex justify-between mt-1">
							<span class="text-[9px]" style="color: var(--text-tertiary); font-family: var(--font-mono);">
								{(() => { const d = new Date(earningsSeries[0]?.date ?? ''); return `${d.getMonth()+1}/${d.getDate()}`; })()}
							</span>
							<span class="text-[9px]" style="color: var(--text-tertiary); font-family: var(--font-mono);">Today</span>
						</div>
					</div>
				</div>

				<!-- Subscriptions card (mobile) -->
				<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
					<div class="px-3 py-2.5 border-b flex items-center justify-between" style="border-color: var(--border-default);">
						<span class="text-[13px] font-semibold" style="color: var(--text-primary);">Subscriptions</span>
						<a href="/mining/subscriptions" class="text-[11px] font-medium no-underline" style="color: var(--text-accent);">
							View All
						</a>
					</div>

					{#if subs.length === 0}
						<div class="px-4 py-6 text-center">
							<p class="text-[13px] mb-3" style="color: var(--text-secondary);">You are not mining any networks yet.</p>
							<a href="/discover" class="btn-subscribe">Discover networks</a>
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
									<img src={iconSrc} alt={app.name} width="28" height="28" class="rounded-[5px] shrink-0" />
								{/if}
								<div class="min-w-0 flex-1">
									<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--text-primary);">
										{app?.name ?? s.appId}
									</div>
									<div class="text-[11px]" style="color: var(--text-tertiary);">
										{s.totalEarned.toFixed(2)} NECTA &middot; {s.uptime.toFixed(0)}%
									</div>
								</div>
								<div class="flex items-center gap-1.5 shrink-0">
									<span class={statusDotClass(s.status)}></span>
									<span class="text-[11px] font-medium capitalize" style="color: {statusColor(s.status)};">
										{s.status}
									</span>
								</div>
							</a>
						{/each}
					{/if}
				</div>
			</div>

			<!-- ════════════════════════════════════
			     DESKTOP: Full dashboard layout
			     ════════════════════════════════════ -->
			<div class="hidden md:flex flex-col gap-4">

				<!-- 5 stat cards -->
				<div
					class="grid gap-[1px] rounded-lg overflow-hidden border"
					style="grid-template-columns: repeat(5, 1fr); background: var(--border-default); border-color: var(--border-default);"
				>
					{#each [
						{ label: 'Today', value: earnedToday.toFixed(2), isReputation: false, muted: false },
						{ label: 'Last 7d', value: earned7d.toFixed(2), isReputation: false, muted: false },
						{ label: 'Last 30d', value: earned30d.toFixed(2), isReputation: false, muted: false },
						{ label: 'Pending', value: pendingRewards.toFixed(2), isReputation: false, muted: true },
						{ label: 'Reputation', value: reputation, isReputation: true, muted: false }
					] as stat}
						<div class="p-4 flex flex-col gap-0.5" style="background: var(--surface-1);">
							<span class="text-[10px] font-medium uppercase tracking-wide" style="color: var(--text-tertiary);">{stat.label}</span>
							<span
								class="text-[22px] font-semibold leading-7 -tracking-wide"
								style="font-family: var(--font-mono); font-feature-settings: 'tnum' 1; color: {stat.isReputation ? (parseFloat(stat.value) >= 80 ? 'var(--text-accent)' : 'var(--text-primary)') : stat.muted ? 'var(--text-secondary)' : 'var(--text-primary)'};"
							>
								{stat.value}
							</span>
							<span class="text-[11px]" style="color: var(--text-tertiary);">{stat.isReputation ? 'score' : 'NECTA'}</span>
						</div>
					{/each}
				</div>

				<!-- Chart + side panels -->
				<div class="grid gap-3 items-start" style="grid-template-columns: 1fr 300px;">

					<!-- Earnings bar chart -->
					<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
						<div class="px-4 py-3 border-b flex items-center justify-between" style="border-color: var(--border-default);">
							<span class="text-[11px] font-semibold tracking-widest uppercase" style="color: var(--text-tertiary);">30-day earnings</span>
						</div>
						<div class="px-4 py-3">
							<div class="flex items-end gap-[2px]" style="height: 260px;">
								{#each earningsSeries as d, i}
									{@const h = d.value > 0 ? Math.max(4, (d.value / chartMax) * 250) : 2}
									<div
										title="{d.date}: {d.value.toFixed(4)} NECTA"
										style="flex: 1; height: {h}px; border-radius: 2px 2px 0 0; background: {i === earningsSeries.length - 1 ? 'var(--accent-base)' : 'var(--accent-subtle)'}; transition: height 200ms ease-out; cursor: default;"
									></div>
								{/each}
							</div>
							<div class="flex justify-between mt-1.5">
								<span class="text-[10px]" style="color: var(--text-tertiary); font-family: var(--font-mono);">
									{(() => { const d = new Date(earningsSeries[0]?.date ?? ''); return `${d.getMonth()+1}/${d.getDate()}`; })()}
								</span>
								<span class="text-[10px]" style="color: var(--text-tertiary); font-family: var(--font-mono);">Today</span>
							</div>
						</div>
					</div>

					<!-- Side panels -->
					<div class="flex flex-col gap-2">
						<!-- Latest payouts -->
						<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
							<div class="px-3 py-2.5 border-b flex items-center gap-1.5" style="border-color: var(--border-default);">
								<span class="text-[11px] font-semibold tracking-widest uppercase" style="color: var(--text-tertiary);">Latest payouts</span>
							</div>
							<div class="py-1 max-h-44 overflow-y-auto">
								{#if latestPayouts.length === 0}
									<p class="text-xs px-3 py-2.5" style="color: var(--text-tertiary);">No payouts yet.</p>
								{:else}
									{#each latestPayouts as p}
										{@const href = p.subscriptionId ? `/mining/${encodeURIComponent(p.subscriptionId)}` : '/mining'}
										<a
											{href}
											class="flex items-center justify-between gap-2 h-8 px-3 no-underline transition-colors hover:bg-[var(--surface-2)]"
										>
											<span class="text-[11px] shrink-0" style="color: var(--text-tertiary); font-family: var(--font-mono);">{relativeTime(p.createdAt)}</span>
											<span class="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0" style="color: var(--text-secondary);" title={p.app?.name ?? p.appId}>
												{p.app?.name ?? p.appId}
											</span>
											<span class="text-[11px] font-semibold shrink-0" style="font-family: var(--font-mono); color: var(--success); font-feature-settings: 'tnum' 1;">
												+{Number(p.minerAmount).toFixed(4)}
											</span>
										</a>
									{/each}
								{/if}
							</div>
						</div>

						<!-- Top networks -->
						<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
							<div class="px-3 py-2.5 border-b" style="border-color: var(--border-default);">
								<span class="text-[11px] font-semibold tracking-widest uppercase" style="color: var(--text-tertiary);">Top networks</span>
							</div>
							<div class="py-1">
								{#if topNetworks.length === 0}
									<p class="text-xs px-3 py-2.5" style="color: var(--text-tertiary);">No payouts yet.</p>
								{:else}
									{#each topNetworks as x}
										<a
											href="/apps/{x.appId}"
											class="flex items-center justify-between h-9 px-3 gap-2 no-underline transition-colors hover:bg-[var(--surface-2)]"
										>
											<div class="min-w-0 flex-1">
												<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--text-primary);">
													{x.app?.name ?? x.appId}
												</div>
												<div class="text-[11px] overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--text-tertiary);">
													{x.app?.category ?? ''}
												</div>
											</div>
											<span class="text-[12px] shrink-0" style="font-family: var(--font-mono); color: var(--text-secondary); font-feature-settings: 'tnum' 1;">
												{x.amount.toFixed(4)}
											</span>
										</a>
									{/each}
								{/if}
							</div>
						</div>

						<!-- Badges -->
						<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
							<div class="px-3 py-2.5 border-b flex items-center gap-1.5" style="border-color: var(--border-default);">
								<span class="text-[11px] font-semibold tracking-widest uppercase flex-1" style="color: var(--text-tertiary);">Badges</span>
								<a href="/mining/badges" class="text-[11px] no-underline" style="color: var(--text-accent);">View all &rarr;</a>
							</div>
							<div class="p-2.5 flex flex-col gap-1.5">
								{#if minerBadges.length === 0}
									<p class="text-[12px] leading-4" style="color: var(--text-tertiary);">No badges yet. Complete tasks to earn milestone badges.</p>
								{:else}
									{#each minerBadges.slice(0, 8) as b}
										<div class="flex items-center gap-2.5 p-1.5 rounded-[5px]" style="background: var(--surface-2);">
											<img src={badgeIconDataUri(b.name, b.kind, 64)} alt="" class="w-8 h-8 shrink-0" />
											<div class="min-w-0">
												<div class="text-[12px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--text-primary);">{b.name}</div>
												<div class="text-[11px] overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--text-tertiary);">{b.description}</div>
											</div>
										</div>
									{/each}
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Subscriptions card (desktop) -->
				<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
					<div class="px-4 pt-3.5 pb-3 border-b flex items-center justify-between" style="border-color: var(--border-default);">
						<div>
							<h3 class="text-sm font-semibold m-0 -tracking-tight" style="color: var(--text-primary);">Subscriptions</h3>
							<p class="text-[11px] mt-0.5 mb-0" style="color: var(--text-tertiary);">Click a row to open its detail page</p>
						</div>
						<a href="/mining/subscriptions" class="text-xs font-medium no-underline shrink-0" style="color: var(--text-accent);">
							View All ({subs.length})
						</a>
					</div>

					{#if subs.length === 0}
						<div class="text-center overflow-hidden">
							<div class="w-full h-[140px] overflow-hidden">
								<img src="/brand/hero-honeycomb.png" alt="" class="w-full h-full object-cover object-bottom opacity-60" />
							</div>
							<div class="px-6 pt-5 pb-7">
								<p class="text-[13px] mb-4" style="color: var(--text-secondary);">You are not mining any projects yet.</p>
								<a href="/discover" class="btn-subscribe">Discover projects</a>
							</div>
						</div>
					{:else}
						<!-- Grid table header -->
						<div
							class="grid h-8 px-3 items-center border-b"
							style="grid-template-columns: 1fr 80px 80px 80px 80px 80px; border-color: var(--border-default);"
						>
							{#each ['Network', 'Status', 'Earned', 'Tasks', 'Uptime', ''] as col, i}
								<span
									class="text-[10px] font-semibold tracking-widest uppercase"
									style="color: var(--text-tertiary); text-align: {i > 0 ? 'right' : 'left'}; {i > 0 && i < 5 ? 'padding-right: 8px;' : ''}"
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
								class="grid h-11 px-3 items-center no-underline transition-colors hover:bg-[var(--surface-2)]"
								style="grid-template-columns: 1fr 80px 80px 80px 80px 80px; {idx !== 0 ? 'border-top: 1px solid var(--border-default);' : ''}"
							>
								<!-- App name + icon -->
								<div class="flex items-center gap-2.5 min-w-0">
									{#if app}
										<img src={iconSrc} alt={app.name} width="28" height="28" class="rounded-[5px] shrink-0" />
									{/if}
									<div class="min-w-0">
										<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--text-primary);">{app?.name ?? s.appId}</div>
										<div class="text-[11px] overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--text-tertiary);">{app?.developer ?? ''}</div>
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
								<span class="text-[12px] text-right pr-2" style="font-family: var(--font-mono); color: var(--text-primary); font-feature-settings: 'tnum' 1;">
									{s.totalEarned.toFixed(2)}
								</span>

								<!-- Tasks -->
								<span class="text-[12px] text-right pr-2" style="font-family: var(--font-mono); color: var(--text-secondary); font-feature-settings: 'tnum' 1;">
									{s.tasksCompleted}
								</span>

								<!-- Uptime -->
								<span class="text-[12px] text-right pr-2" style="font-family: var(--font-mono); color: var(--text-secondary); font-feature-settings: 'tnum' 1;">
									{s.uptime.toFixed(1)}%
								</span>

								<!-- Arrow -->
								<div class="flex justify-end">
									<ArrowUpRight size={14} strokeWidth={1.5} style="color: var(--text-tertiary);" />
								</div>
							</a>
						{/each}
					{/if}
				</div>

				<!-- Recommendations -->
				{#if recommendations.length > 0}
					<div class="rounded-lg overflow-hidden border" style="background: var(--surface-1); border-color: var(--border-default);">
						<div class="px-4 py-2.5 border-b flex items-center justify-between gap-3" style="border-color: var(--border-default);">
							<div>
								<span class="text-[14px] font-semibold -tracking-tight" style="color: var(--text-primary);">Recommended for you</span>
								<p class="text-[12px] mt-0.5" style="color: var(--text-tertiary);">Based on your hardware profile and network performance</p>
							</div>
							<a href="/discover" class="inline-flex items-center gap-1 text-[12px] no-underline shrink-0" style="color: var(--text-accent);">
								Browse all
								<ArrowUpRight size={12} strokeWidth={1.5} />
							</a>
						</div>
						<div class="grid gap-[1px]" style="grid-template-columns: repeat(3, 1fr); background: var(--border-default);">
							{#each recommendations as app}
								<a
									href="/apps/{app.id}"
									class="flex items-center gap-2.5 p-3 no-underline transition-colors hover:bg-[var(--surface-2)]"
									style="background: var(--surface-1);"
								>
									<img src={appIcon(app)} alt={app.name} width="32" height="32" class="rounded-[5px] shrink-0" />
									<div class="min-w-0 flex-1">
										<div class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style="color: var(--text-primary);">
											{app.name}
										</div>
										<div class="text-[11px]" style="color: var(--text-tertiary); font-family: var(--font-mono); font-feature-settings: 'tnum' 1;">
											${app.avgEarningsPerDay.toFixed(2)}/day &middot; {app.reputationScore.toFixed(0)} rep
										</div>
									</div>
									<span class="btn-subscribe" style="pointer-events: none;">Subscribe</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
