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

	let reputation = $derived(() => {
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
	let pendingCount = $derived(proofs.filter((p) => p.status === 'pending').length);
	let verifiedCount = $derived(proofs.filter((p) => p.status === 'verified').length);
	let rejectedCount = $derived(proofs.filter((p) => p.status === 'rejected').length);
	let disputedCount = $derived(proofs.filter((p) => p.disputeFiledAt).length);
</script>

{#if !$actor}
	<!-- Not connected state -->
	<div
		style="display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 24px;"
	>
		<div
			class="bg-honeycomb"
			style="background: var(--surface-1); background-image: var(--honeycomb-pattern); border: 1px solid var(--border-default); border-radius: 8px; padding: 48px 40px; text-align: center; max-width: 400px; width: 100%;"
		>
			<!-- Hex icon -->
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
			<p
				style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; line-height: 20px;"
			>
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
	<div style="padding: 0 0 48px;">
		<div
			style="max-width: 1152px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; gap: 24px;"
		>
			<!-- Page header row -->
			<div
				style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;"
			>
				<div>
					<h1
						style="font-size: 20px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.015em; line-height: 28px; margin: 0;"
					>
						My Mining
					</h1>
					<p
						style="font-size: 12px; color: var(--text-tertiary); margin-top: 2px; line-height: 16px;"
					>
						<span style="color: var(--text-secondary);">{subs.length}</span> networks
						&ensp;&middot;&ensp;
						<span style="color: var(--text-secondary);">{activeCount}</span> active
						&ensp;&middot;&ensp;
						<span
							style="color: var(--text-secondary); font-family: var(--font-mono);"
						>
							{totalEarned.toFixed(4)}
						</span>
						NECTA earned
					</p>
				</div>
				<div style="display: flex; gap: 8px; flex-wrap: wrap;">
					{#each [
						{ id: 'networks' as TabId, label: 'Dashboard' },
						{ id: 'earnings' as TabId, label: 'Earnings' },
						{ id: 'proofs' as TabId, label: 'Proofs' }
					] as btn}
						<button
							type="button"
							onclick={() => (tab = btn.id)}
							style="display: inline-flex; align-items: center; height: 32px; padding: 0 12px; font-size: 13px; font-weight: 500; color: {tab ===
							btn.id
								? 'var(--text-accent)'
								: 'var(--text-secondary)'}; background: {tab === btn.id
								? 'var(--accent-subtle)'
								: 'var(--surface-2)'}; border: {tab === btn.id
								? '1px solid var(--accent-base)'
								: '1px solid var(--border-default)'}; border-radius: 5px; cursor: pointer; transition: all 100ms ease-out;"
						>
							{btn.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Earnings tab -->
			{#if tab === 'earnings'}
				<EarningsPanel />
			{/if}

			<!-- Networks (Dashboard) tab -->
			{#if tab === 'networks'}
				<!-- Earnings stats row -->
				<div style="display: flex; flex-direction: column; gap: 12px;">
					<div
						style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: var(--border-default); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
					>
						{#each [
							{ label: 'Today', value: earnedToday.toFixed(4), isReputation: false, muted: false },
							{ label: 'Last 7d', value: earned7d.toFixed(4), isReputation: false, muted: false },
							{ label: 'Last 30d', value: earned30d.toFixed(4), isReputation: false, muted: false },
							{ label: 'Pending', value: pendingRewards.toFixed(4), isReputation: false, muted: true },
							{ label: 'Reputation', value: reputation(), isReputation: true, muted: false }
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
									style="font-size: 22px; font-weight: 600; font-family: var(--font-mono); color: {stat.isReputation
										? parseFloat(stat.value) >= 80
											? 'var(--text-accent)'
											: parseFloat(stat.value) >= 50
												? 'var(--text-primary)'
												: 'var(--warning)'
										: stat.muted
											? 'var(--text-secondary)'
											: 'var(--text-primary)'}; letter-spacing: -0.02em; line-height: 28px; font-feature-settings: 'tnum' 1;"
								>
									{stat.value}
								</span>
								<span
									style="font-size: 11px; color: var(--text-tertiary); letter-spacing: 0.02em;"
								>
									{stat.isReputation ? 'score' : 'NECTA'}
								</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- Chart + side panels -->
				<div
					style="display: grid; grid-template-columns: 1fr 300px; gap: 12px; align-items: start;"
				>
					<!-- Earnings chart placeholder -->
					<div
						style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
					>
						<div
							style="padding: 12px 16px 8px; border-bottom: 1px solid var(--border-default); display: flex; align-items: center; justify-content: space-between;"
						>
							<span
								style="font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-tertiary);"
							>
								30-day earnings
							</span>
						</div>
						<!-- Chart placeholder - will add charting library later -->
						<div
							style="height: 256px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); font-size: 12px; padding: 8px 4px 0;"
						>
							<span style="opacity: 0.5;">Chart placeholder — charting library TBD</span>
						</div>
					</div>

					<!-- Side panels -->
					<div style="display: flex; flex-direction: column; gap: 8px;">
						<!-- Latest payouts -->
						<div
							style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
						>
							<div
								style="padding: 10px 12px; border-bottom: 1px solid var(--border-default); display: flex; align-items: center; gap: 6px;"
							>
								<span
									style="font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-tertiary);"
								>
									Latest payouts
								</span>
							</div>
							<div style="padding: 4px 0; max-height: 176px; overflow-y: auto;">
								{#if latestPayouts.length === 0}
									<p
										style="font-size: 12px; color: var(--text-tertiary); padding: 10px 12px;"
									>
										No payouts yet.
									</p>
								{:else}
									{#each latestPayouts as p}
										{@const href = p.subscriptionId
											? `/mining/${encodeURIComponent(p.subscriptionId)}`
											: `/mining`}
										<a
											{href}
											style="display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 32px; padding: 0 12px; text-decoration: none; transition: background 100ms ease-out;"
											onmouseenter={(e) => {
												(e.currentTarget as HTMLElement).style.background =
													'var(--surface-2)';
											}}
											onmouseleave={(e) => {
												(e.currentTarget as HTMLElement).style.background =
													'transparent';
											}}
										>
											<span
												style="font-size: 11px; color: var(--text-tertiary); flex-shrink: 0; font-family: var(--font-mono);"
											>
												{relativeTime(p.createdAt)}
											</span>
											<span
												style="font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;"
												title={p.app?.name ?? p.appId}
											>
												{p.app?.name ?? p.appId}
											</span>
											<span
												style="font-size: 11px; font-weight: 600; font-family: var(--font-mono); color: var(--success); flex-shrink: 0; font-feature-settings: 'tnum' 1;"
											>
												+{Number(p.minerAmount).toFixed(4)}
											</span>
										</a>
									{/each}
								{/if}
							</div>
						</div>

						<!-- Top networks -->
						<div
							style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
						>
							<div
								style="padding: 10px 12px; border-bottom: 1px solid var(--border-default);"
							>
								<span
									style="font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-tertiary);"
								>
									Top networks
								</span>
							</div>
							<div style="padding: 4px 0;">
								{#if topNetworks.length === 0}
									<p
										style="font-size: 12px; color: var(--text-tertiary); padding: 10px 12px;"
									>
										No payouts yet.
									</p>
								{:else}
									{#each topNetworks as x}
										<a
											href="/apps/{x.appId}"
											style="display: flex; align-items: center; justify-content: space-between; height: 36px; padding: 0 12px; gap: 8px; text-decoration: none; transition: background 100ms ease-out;"
											onmouseenter={(e) => {
												(e.currentTarget as HTMLElement).style.background =
													'var(--surface-2)';
											}}
											onmouseleave={(e) => {
												(e.currentTarget as HTMLElement).style.background =
													'transparent';
											}}
										>
											<div style="min-width: 0; flex: 1;">
												<div
													style="font-size: 13px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
												>
													{x.app?.name ?? x.appId}
												</div>
												<div
													style="font-size: 11px; color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
												>
													{x.app?.category ?? ''}
												</div>
											</div>
											<span
												style="font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary); flex-shrink: 0; font-feature-settings: 'tnum' 1;"
											>
												{x.amount.toFixed(4)}
											</span>
										</a>
									{/each}
								{/if}
							</div>
						</div>

						<!-- Badges -->
						<div
							style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
						>
							<div
								style="padding: 10px 12px; border-bottom: 1px solid var(--border-default); display: flex; align-items: center; gap: 6px;"
							>
								<span
									style="font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-tertiary); flex: 1;"
								>
									Badges
								</span>
								<a
									href="/mining/badges"
									style="font-size: 11px; color: var(--text-accent); text-decoration: none;"
								>
									View all &rarr;
								</a>
							</div>
							<div
								style="padding: 8px 12px; display: flex; flex-direction: column; gap: 6px;"
							>
								{#if minerBadges.length === 0}
									<p
										style="font-size: 12px; color: var(--text-tertiary); line-height: 16px;"
									>
										No badges yet. Complete tasks to earn milestone badges.
									</p>
								{:else}
									{#each minerBadges.slice(0, 8) as b}
										<div
											style="display: flex; align-items: center; gap: 10px; padding: 6px 8px; background: var(--surface-2); border-radius: 5px;"
										>
											<img
												src={badgeIconDataUri(b.name, b.kind, 64)}
												alt=""
												style="width: 32px; height: 32px; flex-shrink: 0;"
											/>
											<div style="min-width: 0;">
												<div
													style="font-size: 12px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
												>
													{b.name}
												</div>
												<div
													style="font-size: 11px; color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
												>
													{b.description}
												</div>
											</div>
										</div>
									{/each}
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Networks subscriptions + recommendations tab content -->
				<div style="display: flex; flex-direction: column; gap: 16px;">
					<p
						style="font-size: 12px; color: var(--text-tertiary); line-height: 16px;"
					>
						Networks you are subscribed to. Click a row to open its detail page.
					</p>

					{#if subs.length === 0}
						<!-- Empty state -->
						<div
							style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden; text-align: center;"
						>
							<div style="width: 100%; height: 140px; overflow: hidden;">
								<img
									src="/brand/hero-honeycomb.png"
									alt=""
									style="width: 100%; height: 100%; object-fit: cover; object-position: center bottom; opacity: 0.6;"
								/>
							</div>
							<div style="padding: 20px 24px 28px;">
								<p
									style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;"
								>
									You are not mining any networks yet.
								</p>
								<a href="/discover" class="btn-subscribe"> Discover networks </a>
							</div>
						</div>
					{:else}
						<!-- Subscriptions table -->
						<div
							style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
						>
							<!-- Table header -->
							<div
								style="display: grid; grid-template-columns: 1fr 80px 80px 80px 80px 80px; gap: 0; height: 32px; padding: 0 12px; align-items: center; border-bottom: 1px solid var(--border-default);"
							>
								{#each ['Network', 'Status', 'Earned', 'Tasks', 'Uptime', ''] as col, i}
									<span
										style="font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); text-align: {i > 0
											? 'right'
											: 'left'}; {i > 0 && i < 5
											? 'padding-right: 8px;'
											: ''}"
									>
										{col}
									</span>
								{/each}
							</div>

							<!-- Table rows -->
							{#each subs as s, idx}
								{@const app = appsById.get(s.appId)}
								{@const iconSrc =
									app?.icon && app.icon !== '/placeholder.svg'
										? app.icon
										: app
											? appIconDataUri({ id: app.id, name: app.name })
											: '/placeholder.svg'}
								<a
									href="/mining/{encodeURIComponent(s.id)}"
									style="display: grid; grid-template-columns: 1fr 80px 80px 80px 80px 80px; gap: 0; height: 44px; padding: 0 12px; align-items: center; text-decoration: none; {idx !==
									0
										? 'border-top: 1px solid var(--border-default);'
										: ''} transition: background 100ms ease-out;"
									onmouseenter={(e) => {
										(e.currentTarget as HTMLElement).style.background =
											'var(--surface-2)';
									}}
									onmouseleave={(e) => {
										(e.currentTarget as HTMLElement).style.background =
											'transparent';
									}}
								>
									<!-- App name + icon -->
									<div
										style="display: flex; align-items: center; gap: 10px; min-width: 0;"
									>
										{#if app}
											<img
												src={iconSrc}
												alt={app.name}
												width="28"
												height="28"
												style="border-radius: 5px; flex-shrink: 0;"
											/>
										{/if}
										<div style="min-width: 0;">
											<div
												style="font-size: 13px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
											>
												{app?.name ?? s.appId}
											</div>
											<div
												style="font-size: 11px; color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
											>
												{app?.developer ?? ''}
											</div>
										</div>
									</div>

									<!-- Status -->
									<div
										style="display: flex; align-items: center; justify-content: flex-end; gap: 5px; padding-right: 8px;"
									>
										<span class={statusDotClass(s.status)}></span>
										<span
											style="font-size: 11px; font-weight: 500; text-transform: capitalize; color: {s.status ===
											'active'
												? 'var(--success)'
												: s.status === 'proving'
													? 'var(--warning)'
													: s.status === 'slashed'
														? 'var(--error)'
														: 'var(--text-tertiary)'};"
										>
											{s.status}
										</span>
									</div>

									<!-- Earned -->
									<span
										style="font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); text-align: right; padding-right: 8px; font-feature-settings: 'tnum' 1;"
									>
										{s.totalEarned.toFixed(2)}
									</span>

									<!-- Tasks -->
									<span
										style="font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary); text-align: right; padding-right: 8px; font-feature-settings: 'tnum' 1;"
									>
										{s.tasksCompleted}
									</span>

									<!-- Uptime -->
									<span
										style="font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary); text-align: right; padding-right: 8px; font-feature-settings: 'tnum' 1;"
									>
										{s.uptime.toFixed(1)}%
									</span>

									<!-- Arrow -->
									<div style="display: flex; justify-content: flex-end;">
										<ArrowUpRight
											size={14}
											strokeWidth={1.5}
											style="color: var(--text-tertiary);"
										/>
									</div>
								</a>
							{/each}
						</div>
					{/if}

					<!-- Recommendations -->
					{#if recommendations.length > 0}
						<div
							style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
						>
							<div
								style="padding: 10px 16px; border-bottom: 1px solid var(--border-default); display: flex; align-items: center; justify-content: space-between; gap: 12px;"
							>
								<div>
									<span
										style="font-size: 14px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.006em;"
									>
										Recommended for you
									</span>
									<p
										style="font-size: 12px; color: var(--text-tertiary); margin-top: 2px;"
									>
										Based on your hardware profile and network performance
									</p>
								</div>
								<a
									href="/discover"
									style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-accent); text-decoration: none; flex-shrink: 0;"
								>
									Browse all
									<ArrowUpRight size={12} strokeWidth={1.5} />
								</a>
							</div>

							<div
								style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--border-default);"
							>
								{#each recommendations as app}
									<a
										href="/apps/{app.id}"
										style="display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--surface-1); text-decoration: none; transition: background 100ms ease-out;"
										onmouseenter={(e) => {
											(e.currentTarget as HTMLElement).style.background =
												'var(--surface-2)';
										}}
										onmouseleave={(e) => {
											(e.currentTarget as HTMLElement).style.background =
												'var(--surface-1)';
										}}
									>
										<img
											src={appIcon(app)}
											alt={app.name}
											width="32"
											height="32"
											style="border-radius: 5px; flex-shrink: 0;"
										/>
										<div style="min-width: 0; flex: 1;">
											<div
												style="font-size: 13px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
											>
												{app.name}
											</div>
											<div
												style="font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono); font-feature-settings: 'tnum' 1;"
											>
												${app.avgEarningsPerDay.toFixed(2)}/day &middot; {app.reputationScore.toFixed(
													0
												)} rep
											</div>
										</div>
										<span
											class="btn-subscribe"
											style="pointer-events: none;"
										>
											Subscribe
										</span>
									</a>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Proofs tab -->
			{#if tab === 'proofs'}
				{#if !minerId}
					<div style="padding: 32px; text-align: center;">
						<p style="font-size: 13px; color: var(--text-tertiary);">
							Connect a wallet to view proofs.
						</p>
					</div>
				{:else if proofs.length === 0}
					<div style="padding: 32px; text-align: center;">
						<p style="font-size: 13px; color: var(--text-tertiary);">
							No proofs yet. Subscribe to a network and start mining to generate proofs.
						</p>
					</div>
				{:else}
					<div style="display: flex; flex-direction: column; gap: 16px;">
						<!-- Proof summary stats -->
						<div
							style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border-default); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
						>
							{#each [
								{ label: 'Verified', value: verifiedCount, color: 'var(--success)' },
								{
									label: 'Pending',
									value: pendingCount,
									color: 'var(--text-secondary)'
								},
								{ label: 'Rejected', value: rejectedCount, color: 'var(--error)' },
								{
									label: 'Disputed',
									value: disputedCount,
									color: 'var(--warning)'
								}
							] as s}
								<div
									style="background: var(--surface-1); padding: 12px 14px;"
								>
									<span
										style="font-size: 11px; font-weight: 500; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em;"
									>
										{s.label}
									</span>
									<p
										style="font-size: 20px; font-weight: 600; font-family: var(--font-mono); color: {s.color}; line-height: 28px; font-feature-settings: 'tnum' 1;"
									>
										{s.value}
									</p>
								</div>
							{/each}
						</div>

						<!-- Proof list table -->
						<div
							style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden;"
						>
							<!-- Table header -->
							<div
								style="display: grid; grid-template-columns: 1fr 120px 80px 80px 80px; gap: 0; height: 32px; padding: 0 12px; align-items: center; border-bottom: 1px solid var(--border-default);"
							>
								{#each ['Network', 'Proof Hash', 'Status', 'Reward', 'Date'] as col, i}
									<span
										style="font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); text-align: {i > 0
											? 'right'
											: 'left'};"
									>
										{col}
									</span>
								{/each}
							</div>

							<!-- Table rows -->
							{#each sortedProofs as proof, idx}
								{@const statusColor =
									proof.status === 'verified'
										? 'var(--success)'
										: proof.status === 'rejected'
											? 'var(--error)'
											: 'var(--text-secondary)'}
								{@const statusLabel = proof.disputeFiledAt
									? proof.disputeResolvedAt
										? proof.disputeOutcome === 'accepted'
											? 'Won'
											: 'Denied'
										: 'Disputed'
									: proof.status}
								{@const disputeColor = proof.disputeFiledAt
									? proof.disputeResolvedAt
										? proof.disputeOutcome === 'accepted'
											? 'var(--success)'
											: 'var(--error)'
										: 'var(--warning)'
									: statusColor}
								<a
									href="/mining/proofs/{proof.id}"
									style="display: grid; grid-template-columns: 1fr 120px 80px 80px 80px; gap: 0; height: 40px; padding: 0 12px; align-items: center; text-decoration: none; {idx !==
									0
										? 'border-top: 1px solid var(--border-default);'
										: ''} transition: background 100ms ease-out;"
									onmouseenter={(e) => {
										(e.currentTarget as HTMLElement).style.background =
											'var(--surface-2)';
									}}
									onmouseleave={(e) => {
										(e.currentTarget as HTMLElement).style.background =
											'transparent';
									}}
								>
									<!-- Network -->
									<span
										style="font-size: 13px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
									>
										{appsById.get(proof.appId)?.name || proof.appId}
									</span>

									<!-- Hash -->
									<span
										style="font-size: 11px; font-family: var(--font-mono); color: var(--text-tertiary); text-align: right;"
									>
										{proof.hash.slice(0, 10)}...
									</span>

									<!-- Status -->
									<span
										style="font-size: 11px; font-weight: 500; text-align: right; text-transform: capitalize; color: {disputeColor};"
									>
										{statusLabel}
									</span>

									<!-- Reward -->
									<span
										style="font-size: 12px; font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); text-align: right; font-feature-settings: 'tnum' 1;"
									>
										${proof.reward.toFixed(2)}
									</span>

									<!-- Date -->
									<span
										style="font-size: 11px; color: var(--text-tertiary); text-align: right;"
									>
										{new Date(proof.submittedAt).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric'
										})}
									</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
