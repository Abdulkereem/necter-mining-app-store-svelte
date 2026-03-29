<script lang="ts">
	import { backendState, backend } from '$lib/stores/backend';
	import { actor } from '$lib/stores/wallet';
	import { appIconDataUri } from '$lib/app-icon';
	import { minerAvatarDataUri } from '$lib/miner-avatar';
	import { Trophy, TrendingUp, Clock, Network } from 'lucide-svelte';
	import type { App } from '$lib/types';

	type Tab = 'earners' | 'uptime' | 'networks';

	const RANK_COLORS: Record<number, string> = {
		1: '#FFD700',
		2: '#C0C0C0',
		3: '#CD7F32'
	};

	let tab = $state<Tab>('networks');

	const tabs: { id: Tab; label: string; icon: typeof Trophy }[] = [
		{ id: 'networks', label: 'Top Networks', icon: Network },
		{ id: 'earners', label: 'Top Earners', icon: TrendingUp },
		{ id: 'uptime', label: 'Best Uptime', icon: Clock }
	];

	/* ─── Helper ─── */
	function appIcon(app: App): string {
		return app.icon && app.icon !== '/placeholder.svg'
			? app.icon
			: appIconDataUri({ id: app.id, name: app.name, category: app.category });
	}

	/* ─── Derived data ─── */
	const currentMinerId = $derived($actor?.minerId ?? null);

	const minerStats = $derived.by(() => {
		const map = new Map<
			string,
			{
				minerId: string;
				totalEarned: number;
				uptime: number;
				uptimeCount: number;
				networkCount: number;
			}
		>();

		for (const sub of $backendState.subscriptions) {
			const existing = map.get(sub.minerId);
			if (existing) {
				existing.totalEarned += sub.totalEarned;
				existing.uptime += sub.uptime;
				existing.uptimeCount += 1;
				existing.networkCount += 1;
			} else {
				map.set(sub.minerId, {
					minerId: sub.minerId,
					totalEarned: sub.totalEarned,
					uptime: sub.uptime,
					uptimeCount: 1,
					networkCount: 1
				});
			}
		}

		return Array.from(map.values()).map((m) => ({
			...m,
			avgUptime: m.uptimeCount > 0 ? m.uptime / m.uptimeCount : 0
		}));
	});

	const topEarners = $derived(
		[...minerStats].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 25)
	);

	const bestUptime = $derived(
		[...minerStats].sort((a, b) => b.avgUptime - a.avgUptime).slice(0, 25)
	);

	const topNetworks = $derived(
		[...$backendState.apps]
			.sort((a, b) => b.totalMiners - a.totalMiners || b.totalEarnings - a.totalEarnings)
			.slice(0, 25)
	);

	// Current miner rank calculations
	const allEarnersSorted = $derived(
		[...minerStats].sort((a, b) => b.totalEarned - a.totalEarned)
	);
	const allUptimeSorted = $derived(
		[...minerStats].sort((a, b) => b.avgUptime - a.avgUptime)
	);

	const currentMinerEarnerRank = $derived.by(() => {
		if (!currentMinerId) return null;
		const idx = allEarnersSorted.findIndex((m) => m.minerId === currentMinerId);
		return idx >= 0 ? idx + 1 : null;
	});

	const currentMinerUptimeRank = $derived.by(() => {
		if (!currentMinerId) return null;
		const idx = allUptimeSorted.findIndex((m) => m.minerId === currentMinerId);
		return idx >= 0 ? idx + 1 : null;
	});

	const isEarnerInTop25 = $derived(
		currentMinerEarnerRank !== null && currentMinerEarnerRank <= 25
	);
	const isUptimeInTop25 = $derived(
		currentMinerUptimeRank !== null && currentMinerUptimeRank <= 25
	);
</script>

<div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
	<!-- Page title -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-[20px] font-semibold text-[var(--text-primary)]">Leaderboards</h1>
			<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">
				Top miners and networks ranked by performance
			</p>
		</div>
	</div>

	<!-- Tabs -->
	<div class="flex gap-1 mb-6">
		{#each tabs as t (t.id)}
			<button
				type="button"
				onclick={() => (tab = t.id)}
				class={[
					'flex items-center justify-center gap-1.5 flex-1 h-[32px] rounded-[5px] text-[12px] font-medium transition-colors duration-100',
					tab === t.id
						? 'bg-[var(--accent-subtle)] text-[var(--text-accent)]'
						: 'bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
				].join(' ')}
			>
				<t.icon class="h-3.5 w-3.5" strokeWidth={1.5} />
				{t.label}
			</button>
		{/each}
	</div>

	<!-- Table -->
	<div
		class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden"
	>
		<!-- Table header -->
		<div
			class="flex items-center gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border-default)]"
			style="letter-spacing: 0.02em"
		>
			<span class="w-[40px]">#</span>
			{#if tab === 'earners'}
				<span class="flex-1">Miner</span>
				<span class="w-[140px] text-right">Total Earned</span>
				<span class="w-[100px] text-right">Networks</span>
				<span class="w-[100px] text-right">Uptime</span>
			{:else if tab === 'uptime'}
				<span class="flex-1">Miner</span>
				<span class="w-[140px] text-right">Uptime</span>
				<span class="w-[100px] text-right">Networks</span>
				<span class="w-[100px] text-right">Earned</span>
			{:else if tab === 'networks'}
				<span class="w-[32px]"></span>
				<span class="flex-1">Network</span>
				<span class="w-[100px] text-right">Miners</span>
				<span class="w-[120px] text-right">Total Earnings</span>
				<span class="w-[110px] text-right">Avg/Day</span>
				<span class="w-[90px] text-right">Reputation</span>
			{/if}
		</div>

		<!-- Rows -->
		<div>
			{#if tab === 'earners'}
				{#if currentMinerId && !isEarnerInTop25 && currentMinerEarnerRank}
					<div
						style="padding: 8px 16px; background: var(--accent-subtle); border-bottom: 1px solid var(--border-default); font-size: 12px; color: var(--text-accent); font-weight: 500"
					>
						Your rank: #{currentMinerEarnerRank}
					</div>
				{/if}
				{#each topEarners as miner, i (miner.minerId)}
					{@const rank = i + 1}
					{@const accentColor = RANK_COLORS[rank]}
					{@const isCurrentMiner = miner.minerId === currentMinerId}
					<a
						href="/miners/{miner.minerId}"
						class="flex items-center gap-4 px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--surface-2)] transition-colors duration-100 no-underline cursor-pointer"
						style={isCurrentMiner ? 'background: var(--accent-subtle)' : ''}
					>
						<span
							class="w-[40px] text-[13px] font-semibold"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'; color: {accentColor ?? 'var(--text-tertiary)'}"
						>
							{rank}
						</span>
						<img
							src={minerAvatarDataUri(miner.minerId)}
							alt=""
							class="w-[28px] h-[28px] rounded-[6px] flex-shrink-0"
						/>
						<span
							class="flex-1 text-[13px] text-[var(--text-primary)] truncate"
							style="font-family: var(--font-mono)"
						>
							{miner.minerId}
						</span>
						<span
							class="w-[140px] text-right text-[13px] font-medium"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'; color: {accentColor ?? 'var(--text-primary)'}"
						>
							${miner.totalEarned.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2
							})}
						</span>
						<span
							class="w-[100px] text-right text-[12px] text-[var(--text-secondary)]"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'"
						>
							{miner.networkCount}
						</span>
						<span
							class="w-[100px] text-right text-[12px] text-[var(--text-secondary)]"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'"
						>
							{miner.avgUptime.toFixed(1)}%
						</span>
					</a>
				{/each}
				{#if topEarners.length === 0}
					<div class="py-16 text-center bg-honeycomb-subtle">
						<p class="text-[13px] text-[var(--text-tertiary)]">No miner data available yet.</p>
					</div>
				{/if}
			{:else if tab === 'uptime'}
				{#if currentMinerId && !isUptimeInTop25 && currentMinerUptimeRank}
					<div
						style="padding: 8px 16px; background: var(--accent-subtle); border-bottom: 1px solid var(--border-default); font-size: 12px; color: var(--text-accent); font-weight: 500"
					>
						Your rank: #{currentMinerUptimeRank}
					</div>
				{/if}
				{#each bestUptime as miner, i (miner.minerId)}
					{@const rank = i + 1}
					{@const accentColor = RANK_COLORS[rank]}
					{@const isCurrentMiner = miner.minerId === currentMinerId}
					<a
						href="/miners/{miner.minerId}"
						class="flex items-center gap-4 px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--surface-2)] transition-colors duration-100 no-underline cursor-pointer"
						style={isCurrentMiner ? 'background: var(--accent-subtle)' : ''}
					>
						<span
							class="w-[40px] text-[13px] font-semibold"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'; color: {accentColor ?? 'var(--text-tertiary)'}"
						>
							{rank}
						</span>
						<img
							src={minerAvatarDataUri(miner.minerId)}
							alt=""
							class="w-[28px] h-[28px] rounded-[6px] flex-shrink-0"
						/>
						<span
							class="flex-1 text-[13px] text-[var(--text-primary)] truncate"
							style="font-family: var(--font-mono)"
						>
							{miner.minerId}
						</span>
						<span
							class="w-[140px] text-right text-[16px] font-semibold"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'; color: {accentColor ?? 'var(--text-primary)'}"
						>
							{miner.avgUptime.toFixed(1)}%
						</span>
						<span
							class="w-[100px] text-right text-[12px] text-[var(--text-secondary)]"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'"
						>
							{miner.networkCount}
						</span>
						<span
							class="w-[100px] text-right text-[12px] text-[var(--text-secondary)]"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'"
						>
							${miner.totalEarned.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2
							})}
						</span>
					</a>
				{/each}
				{#if bestUptime.length === 0}
					<div class="py-16 text-center bg-honeycomb-subtle">
						<p class="text-[13px] text-[var(--text-tertiary)]">No miner data available yet.</p>
					</div>
				{/if}
			{:else if tab === 'networks'}
				{#each topNetworks as app, i (app.id)}
					{@const rank = i + 1}
					{@const accentColor = RANK_COLORS[rank]}
					<a
						href="/apps/{app.id}"
						class="flex items-center gap-4 px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--surface-2)] transition-colors duration-100 no-underline"
					>
						<span
							class="w-[40px] text-[13px] font-semibold"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'; color: {accentColor ?? 'var(--text-tertiary)'}"
						>
							{rank}
						</span>
						<div class="w-[32px] h-[32px] rounded-[5px] overflow-hidden flex-shrink-0">
							<img
								src={appIcon(app)}
								alt={app.name}
								width="32"
								height="32"
								class="rounded-[5px]"
							/>
						</div>
						<span
							class="flex-1 text-[13px] font-medium text-[var(--text-primary)] truncate"
						>
							{app.name}
						</span>
						<span
							class="w-[100px] text-right text-[13px] text-[var(--text-secondary)]"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'"
						>
							{app.totalMiners.toLocaleString()}
						</span>
						<span
							class="w-[120px] text-right text-[13px] font-medium"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'; color: {accentColor ?? 'var(--text-primary)'}"
						>
							${app.totalEarnings.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2
							})}
						</span>
						<span
							class="w-[110px] text-right text-[12px] text-[var(--text-secondary)]"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'"
						>
							${app.avgEarningsPerDay.toFixed(2)}/d
						</span>
						<span
							class="w-[90px] text-right text-[12px] text-[var(--text-secondary)]"
							style="font-family: var(--font-mono); font-feature-settings: 'tnum'"
						>
							{app.reputationScore.toFixed(1)}
						</span>
					</a>
				{/each}
				{#if topNetworks.length === 0}
					<div class="py-16 text-center bg-honeycomb-subtle">
						<p class="text-[13px] text-[var(--text-tertiary)]">
							No network data available yet.
						</p>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
