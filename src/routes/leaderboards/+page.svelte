<script lang="ts">
	import { backendState, backend } from '$lib/stores/backend';
	import { actor } from '$lib/stores/wallet';
	import { appIconDataUri } from '$lib/app-icon';
	import { minerAvatarDataUri } from '$lib/miner-avatar';
	import { Network, TrendingUp, Clock, ArrowUp, ArrowDown, Minus } from 'lucide-svelte';

	type Tab = 'networks' | 'earners' | 'uptime';
	type Period = 'all' | '30d' | '7d';

	let tab = $state<Tab>('networks');
	let period = $state<Period>('all');
	let category = $state('all');
	let isMobile = $state(false);

	$effect(() => {
		const check = () => (isMobile = window.innerWidth < 768);
		check();
		window.addEventListener('resize', check);
		return () => window.removeEventListener('resize', check);
	});

	const RANK_COLORS: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

	let state = $derived($backendState);
	let currentMinerId = $derived($actor?.minerId ?? null);
	let periodMultiplier = $derived(period === '7d' ? 0.25 : period === '30d' ? 0.7 : 1);

	let categories = $derived([...new Set(state.apps.map((a: any) => a.category).filter(Boolean))].sort());

	let minerStats = $derived((() => {
		const map = new Map<string, { minerId: string; totalEarned: number; uptime: number; uptimeCount: number; networkCount: number }>();
		for (const sub of state.subscriptions) {
			const e = map.get(sub.minerId);
			if (e) { e.totalEarned += sub.totalEarned; e.uptime += sub.uptime; e.uptimeCount += 1; e.networkCount += 1; }
			else map.set(sub.minerId, { minerId: sub.minerId, totalEarned: sub.totalEarned, uptime: sub.uptime, uptimeCount: 1, networkCount: 1 });
		}
		return Array.from(map.values()).map((m) => ({ ...m, avgUptime: m.uptimeCount > 0 ? m.uptime / m.uptimeCount : 0 }));
	})());

	let topEarners = $derived(
		[...minerStats].map((m) => ({ ...m, periodEarned: m.totalEarned * periodMultiplier })).sort((a, b) => b.periodEarned - a.periodEarned).slice(0, 25)
	);
	let bestUptime = $derived([...minerStats].sort((a, b) => b.avgUptime - a.avgUptime).slice(0, 25));

	// Full sorted lists for "your position" pinned row
	let allEarnersSorted = $derived([...minerStats].sort((a, b) => b.totalEarned - a.totalEarned));
	let allUptimeSorted = $derived([...minerStats].sort((a, b) => b.avgUptime - a.avgUptime));
	let currentMinerEarner = $derived(currentMinerId ? allEarnersSorted.find((m) => m.minerId === currentMinerId) : null);
	let currentMinerEarnerRank = $derived(currentMinerId ? allEarnersSorted.findIndex((m) => m.minerId === currentMinerId) + 1 : null);
	let currentMinerUptime = $derived(currentMinerId ? allUptimeSorted.find((m) => m.minerId === currentMinerId) : null);
	let currentMinerUptimeRank = $derived(currentMinerId ? allUptimeSorted.findIndex((m) => m.minerId === currentMinerId) + 1 : null);
	let isEarnerInTop25 = $derived((currentMinerEarnerRank ?? 999) <= 25);
	let isUptimeInTop25 = $derived((currentMinerUptimeRank ?? 999) <= 25);

	let topNetworks = $derived((() => {
		let apps = [...state.apps];
		if (category !== 'all') apps = apps.filter((a: any) => a.category === category);
		return apps.sort((a: any, b: any) => b.totalMiners - a.totalMiners || b.totalEarnings - a.totalEarnings).slice(0, 25);
	})());

	let proofsByApp = $derived((() => {
		const map = new Map<string, { total: number; verified: number }>();
		for (const p of state.proofs) {
			const e = map.get(p.appId) ?? { total: 0, verified: 0 };
			e.total++; if (p.status === 'verified') e.verified++;
			map.set(p.appId, e);
		}
		return map;
	})());

	function pseudoTrend(id: string, rank: number) {
		let hash = 0;
		for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
		return Math.max(1, rank + ((Math.abs(hash) % 7) - 3));
	}

	function trendData(cur: number, prev: number) {
		const diff = prev - cur;
		if (diff === 0 || prev === 0) return { type: 'neutral' as const, diff: 0 };
		if (diff > 0) return { type: 'up' as const, diff };
		return { type: 'down' as const, diff: Math.abs(diff) };
	}
</script>

<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
	<div class="mb-5">
		<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Leaderboards</h1>
		<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 hidden md:block">Top miners and projects ranked by performance</p>
	</div>

	<!-- Tabs + Controls -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
		<div class="flex gap-1 overflow-x-auto">
			{#each [{ id: 'networks', label: 'Top Projects', short: 'Projects', icon: Network }, { id: 'earners', label: 'Top Earners', short: 'Earners', icon: TrendingUp }, { id: 'uptime', label: 'Best Uptime', short: 'Uptime', icon: Clock }] as t}
				<button
					onclick={() => (tab = t.id as Tab)}
					class="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-[5px] text-[12px] font-medium border-none cursor-pointer transition-colors whitespace-nowrap {tab === t.id ? 'bg-[var(--accent-subtle)] text-[var(--text-accent)]' : 'bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
				>
					<svelte:component this={t.icon} size={14} strokeWidth={1.5} />
					<span class="hidden md:inline">{t.label}</span>
					<span class="md:hidden">{t.short}</span>
				</button>
			{/each}
		</div>
		<div class="flex items-center gap-2">
			{#if tab === 'networks'}
				<select bind:value={category} class="appearance-none h-[30px] pl-3 pr-9 rounded-[5px] bg-[var(--surface-1)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] outline-none cursor-pointer">
					<option value="all">All Categories</option>
					{#each categories as c}<option value={c}>{c}</option>{/each}
				</select>
			{/if}
			<div class="flex gap-[2px] bg-[var(--surface-2)] rounded-[5px] p-[2px]">
				{#each [{ id: '7d', label: '7D' }, { id: '30d', label: '30D' }, { id: 'all', label: 'All' }] as p}
					<button
						onclick={() => (period = p.id as Period)}
						class="border-none cursor-pointer rounded-[4px] text-[11px] font-medium h-[26px] px-2.5"
						style="background:{period === p.id ? 'var(--surface-1)' : 'transparent'}; color:{period === p.id ? 'var(--text-primary)' : 'var(--text-tertiary)'}; box-shadow:{period === p.id ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'}"
					>{p.label}</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Table -->
	<div class="rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] overflow-x-auto" style="-webkit-overflow-scrolling:touch">
		<div style="min-width:580px">

		{#if tab === 'networks'}
			<div class="grid items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border-default)]"
				style="grid-template-columns:{isMobile ? '1fr 55px 75px 55px 40px' : '1fr 70px 90px 75px 65px 50px'}; gap:0 20px">
				<span>#  Project</span>
				<span class="text-right">Miners</span>
				<span class="text-right">Earnings</span>
				{#if !isMobile}<span class="text-right">Avg/Miner</span>{/if}
				<span class="text-right">Proofs</span>
				<span class="text-right">Trend</span>
			</div>
			{#each topNetworks as app, i}
				{@const rank = i + 1}
				{@const color = RANK_COLORS[rank] ?? 'var(--text-tertiary)'}
				{@const pd = proofsByApp.get(app.id)}
				{@const proofRate = pd && pd.total > 0 ? (pd.verified / pd.total) * 100 : 0}
				{@const avgPer = app.totalMiners > 0 ? app.totalEarnings / app.totalMiners : 0}
				{@const tr = trendData(rank, pseudoTrend(app.id, rank))}
				<a href="/apps/{app.id}" class="grid items-center px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--surface-2)] transition-colors no-underline"
					style="grid-template-columns:{isMobile ? '1fr 55px 75px 55px 40px' : '1fr 70px 90px 75px 65px 50px'}; gap:0 20px">
					<div class="flex items-center gap-4 min-w-0">
						<span class="text-[13px] font-semibold font-mono w-5 shrink-0" style="color:{color}">{rank}</span>
						<img src={app.icon || appIconDataUri({ id: app.id, name: app.name, category: app.category })} alt="" class="w-7 h-7 rounded-[5px] shrink-0" />
						<div class="min-w-0"><span class="text-[13px] font-medium text-[var(--text-primary)] truncate block">{app.name}</span><span class="text-[10px] text-[var(--text-tertiary)] truncate block">{app.category}</span></div>
					</div>
					<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">{app.totalMiners}</span>
					<span class="text-right text-[12px] font-medium font-mono" style="color:{color}">${(app.totalEarnings * periodMultiplier).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
					{#if !isMobile}<span class="text-right text-[11px] text-[var(--text-secondary)] font-mono">${avgPer.toFixed(0)}/m</span>{/if}
					<span class="text-right text-[11px] font-mono" style="color:{proofRate >= 90 ? 'var(--success)' : proofRate >= 70 ? 'var(--warning)' : 'var(--error)'}">{proofRate > 0 ? `${proofRate.toFixed(0)}%` : '—'}</span>
					<span class="flex justify-end">
						{#if tr.type === 'neutral'}<Minus size={12} class="text-[var(--text-tertiary)]" />
						{:else if tr.type === 'up'}<span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--success)]"><ArrowUp size={10} strokeWidth={2.5} />{tr.diff}</span>
						{:else}<span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--error)]"><ArrowDown size={10} strokeWidth={2.5} />{tr.diff}</span>
						{/if}
					</span>
				</a>
			{/each}
			{#if topNetworks.length === 0}<div class="py-16 text-center text-[13px] text-[var(--text-tertiary)]">No projects found.</div>{/if}
		{/if}

		{#if tab === 'earners'}
			<div class="grid items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border-default)]" style="grid-template-columns:1fr 130px 80px 80px 50px; gap:0 16px">
				<span>#  Miner</span><span class="text-right">{period === 'all' ? 'Total' : period === '30d' ? '30-Day' : '7-Day'} Earned</span><span class="text-right">Projects</span><span class="text-right">Uptime</span><span class="text-right">Trend</span>
			</div>
			{#each topEarners as miner, i}
				{@const rank = i + 1}
				{@const color = RANK_COLORS[rank] ?? 'var(--text-tertiary)'}
				{@const tr = trendData(rank, pseudoTrend(miner.minerId, rank))}
				<a href="/miners/{miner.minerId}" class="grid items-center px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--surface-2)] transition-colors no-underline" style="grid-template-columns:1fr 130px 80px 80px 50px; gap:0 16px; {miner.minerId === currentMinerId ? 'background:var(--accent-subtle)' : ''}">
					<div class="flex items-center gap-4 min-w-0">
						<span class="text-[13px] font-semibold font-mono w-5 shrink-0" style="color:{color}">{rank}</span>
						<img src={minerAvatarDataUri(miner.minerId)} alt="" class="w-7 h-7 rounded-[6px] shrink-0" />
						<span class="text-[13px] text-[var(--text-primary)] font-mono truncate">{miner.minerId}</span>
					</div>
					<span class="text-right text-[13px] font-medium font-mono" style="color:{color}">${miner.periodEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
					<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">{miner.networkCount}</span>
					<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">{miner.avgUptime.toFixed(1)}%</span>
					<span class="flex justify-end">
						{#if tr.type === 'neutral'}<Minus size={12} class="text-[var(--text-tertiary)]" />
						{:else if tr.type === 'up'}<span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--success)]"><ArrowUp size={10} strokeWidth={2.5} />{tr.diff}</span>
						{:else}<span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--error)]"><ArrowDown size={10} strokeWidth={2.5} />{tr.diff}</span>
						{/if}
					</span>
				</a>
			{/each}
			<!-- Pinned "Your position" for earners -->
			{#if currentMinerId && !isEarnerInTop25 && currentMinerEarner && currentMinerEarnerRank}
				{@const tr = trendData(currentMinerEarnerRank, pseudoTrend(currentMinerId, currentMinerEarnerRank))}
				<div class="px-4 py-1.5 border-b border-[var(--border-default)]">
					<span class="text-[10px] text-[var(--text-tertiary)]">···</span>
				</div>
				<a href="/miners/{currentMinerId}" class="grid items-center px-4 py-3 border-b border-[var(--border-default)] no-underline cursor-pointer" style="grid-template-columns:1fr 130px 80px 80px 50px; gap:0 16px; background:var(--accent-subtle)">
					<div class="flex items-center gap-4 min-w-0">
						<span class="text-[13px] font-semibold font-mono w-5 shrink-0 text-[var(--text-accent)]" style="font-feature-settings:'tnum'">{currentMinerEarnerRank}</span>
						<img src={minerAvatarDataUri(currentMinerId)} alt="" class="w-7 h-7 rounded-[6px] shrink-0" />
						<span class="text-[13px] text-[var(--text-accent)] font-mono truncate">{currentMinerId} <span class="text-[10px] font-sans">(You)</span></span>
					</div>
					<span class="text-right text-[13px] font-medium font-mono text-[var(--text-accent)]" style="font-feature-settings:'tnum'">${(currentMinerEarner.totalEarned * periodMultiplier).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
					<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">{currentMinerEarner.networkCount}</span>
					<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">{currentMinerEarner.avgUptime.toFixed(1)}%</span>
					<span class="flex justify-end">
						{#if tr.type === 'neutral'}<Minus size={12} class="text-[var(--text-tertiary)]" />
						{:else if tr.type === 'up'}<span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--success)]"><ArrowUp size={10} strokeWidth={2.5} />{tr.diff}</span>
						{:else}<span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--error)]"><ArrowDown size={10} strokeWidth={2.5} />{tr.diff}</span>
						{/if}
					</span>
				</a>
			{/if}
			{#if topEarners.length === 0}<div class="py-16 text-center text-[13px] text-[var(--text-tertiary)]">No miner data yet.</div>{/if}
		{/if}

		{#if tab === 'uptime'}
			<div class="grid items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border-default)]" style="grid-template-columns:1fr 100px 80px 100px 50px; gap:0 16px">
				<span>#  Miner</span><span class="text-right">Uptime</span><span class="text-right">Projects</span><span class="text-right">Earned</span><span class="text-right">Trend</span>
			</div>
			{#each bestUptime as miner, i}
				{@const rank = i + 1}
				{@const color = RANK_COLORS[rank] ?? 'var(--text-tertiary)'}
				{@const tr = trendData(rank, pseudoTrend(miner.minerId + 'uptime', rank))}
				<a href="/miners/{miner.minerId}" class="grid items-center px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--surface-2)] transition-colors no-underline" style="grid-template-columns:1fr 100px 80px 100px 50px; gap:0 16px; {miner.minerId === currentMinerId ? 'background:var(--accent-subtle)' : ''}">
					<div class="flex items-center gap-4 min-w-0">
						<span class="text-[13px] font-semibold font-mono w-5 shrink-0" style="color:{color}">{rank}</span>
						<img src={minerAvatarDataUri(miner.minerId)} alt="" class="w-7 h-7 rounded-[6px] shrink-0" />
						<span class="text-[13px] text-[var(--text-primary)] font-mono truncate">{miner.minerId}</span>
					</div>
					<span class="text-right text-[14px] font-semibold font-mono" style="color:{color}">{miner.avgUptime.toFixed(1)}%</span>
					<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">{miner.networkCount}</span>
					<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">${miner.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
					<span class="flex justify-end">
						{#if tr.type === 'neutral'}<Minus size={12} class="text-[var(--text-tertiary)]" />
						{:else if tr.type === 'up'}<span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--success)]"><ArrowUp size={10} strokeWidth={2.5} />{tr.diff}</span>
						{:else}<span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--error)]"><ArrowDown size={10} strokeWidth={2.5} />{tr.diff}</span>
						{/if}
					</span>
				</a>
			{/each}
			<!-- Pinned "Your position" for uptime -->
			{#if currentMinerId && !isUptimeInTop25 && currentMinerUptime && currentMinerUptimeRank}
				{@const tr = trendData(currentMinerUptimeRank, pseudoTrend(currentMinerId + 'uptime', currentMinerUptimeRank))}
				<div class="px-4 py-1.5 border-b border-[var(--border-default)]">
					<span class="text-[10px] text-[var(--text-tertiary)]">···</span>
				</div>
				<a href="/miners/{currentMinerId}" class="grid items-center px-4 py-3 border-b border-[var(--border-default)] no-underline cursor-pointer" style="grid-template-columns:1fr 100px 80px 100px 50px; gap:0 16px; background:var(--accent-subtle)">
					<div class="flex items-center gap-4 min-w-0">
						<span class="text-[13px] font-semibold font-mono w-5 shrink-0 text-[var(--text-accent)]" style="font-feature-settings:'tnum'">{currentMinerUptimeRank}</span>
						<img src={minerAvatarDataUri(currentMinerId)} alt="" class="w-7 h-7 rounded-[6px] shrink-0" />
						<span class="text-[13px] text-[var(--text-accent)] font-mono truncate">{currentMinerId} <span class="text-[10px] font-sans">(You)</span></span>
					</div>
					<span class="text-right text-[14px] font-semibold font-mono text-[var(--text-accent)]">{currentMinerUptime.avgUptime.toFixed(1)}%</span>
					<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">{currentMinerUptime.networkCount}</span>
					<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">${currentMinerUptime.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
					<span class="flex justify-end">
						{#if tr.type === 'neutral'}<Minus size={12} class="text-[var(--text-tertiary)]" />
						{:else if tr.type === 'up'}<span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--success)]"><ArrowUp size={10} strokeWidth={2.5} />{tr.diff}</span>
						{:else}<span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--error)]"><ArrowDown size={10} strokeWidth={2.5} />{tr.diff}</span>
						{/if}
					</span>
				</a>
			{/if}
			{#if bestUptime.length === 0}<div class="py-16 text-center text-[13px] text-[var(--text-tertiary)]">No miner data yet.</div>{/if}
		{/if}

		</div>
	</div>
</div>
