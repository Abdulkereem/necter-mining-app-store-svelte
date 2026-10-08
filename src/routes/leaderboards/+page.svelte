<script lang="ts">
	import { Network, Cpu, Coins, Clock, ShieldCheck, Smartphone, ChevronDown } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import type { Period, ProjectSummary, Token } from '$lib/api/types';
	import { wallet } from '$lib/stores/wallet';
	import { minerAvatarDataUri } from '$lib/miner-avatar';
	import { formatAmount, formatToken, formatRating, formatNumber, bpToPercent, shortAddress, CATEGORIES, categoryShort } from '$lib/format';
	import { Button, Card } from '$lib/components/ui';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';

	type Metric = 'units' | 'earnings' | 'uptime' | 'reputation' | 'devices';
	type Tab = 'projects' | Metric;

	const TABS: { id: Tab; label: string; short: string; icon: typeof Network }[] = [
		{ id: 'projects', label: 'Top Projects', short: 'Projects', icon: Network },
		{ id: 'units', label: 'Compute Units', short: 'Units', icon: Cpu },
		{ id: 'earnings', label: 'Top Earners', short: 'Earners', icon: Coins },
		{ id: 'uptime', label: 'Best Uptime', short: 'Uptime', icon: Clock },
		{ id: 'reputation', label: 'Reputation', short: 'Rep.', icon: ShieldCheck },
		{ id: 'devices', label: 'Most Devices', short: 'Devices', icon: Smartphone }
	];

	const VALUE_HEADER: Record<Metric, string> = {
		units: 'Units',
		earnings: 'Earned',
		uptime: 'Uptime',
		reputation: 'Reputation',
		devices: 'Devices'
	};

	let tab = $state<Tab>('projects');
	let period = $state<Period>('7d');
	let category = $state('all');
	let projectFilter = $state('');

	const RANK_COLORS: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
	const NECTA = { symbol: 'NECTA', decimals: 18 } as const;

	const projects = useQuery(() =>
		hub.projects({ sort: 'miners', limit: 100, ...(category !== 'all' && tab === 'projects' ? { category: category as ProjectSummary['category'] } : {}) })
	);
	// Unfiltered list for the miner-metric project selector.
	const allProjects = useQuery(() => hub.projects({ sort: 'name', limit: 200 }));
	const projectsById = $derived(new Map<string, ProjectSummary>((allProjects.data?.items ?? []).map((p) => [p.project_id, p])));

	const board = useQuery(
		() => {
			const metric = tab === 'projects' ? 'units' : tab;
			return hub.leaderboard({ metric, period, limit: 50, ...(projectFilter ? { project_id: projectFilter } : {}) });
		},
		{ enabled: () => tab !== 'projects' }
	);

	const me = $derived($wallet?.address?.toLowerCase() ?? null);
	const items = $derived(board.data?.items ?? []);
	const earningsToken = $derived<Pick<Token, 'symbol' | 'decimals'>>(
		(projectFilter ? projectsById.get(projectFilter)?.token : null) ?? NECTA
	);

	function formatValue(metric: Metric, value: string): string {
		switch (metric) {
			case 'earnings':
				return formatToken(value, earningsToken);
			case 'uptime':
			case 'reputation': {
				const bp = Number(value);
				return Number.isFinite(bp) ? bpToPercent(bp) : '—';
			}
			default:
				// integer strings; grouped without float conversion
				return formatAmount(value, 0);
		}
	}

	const selectClass =
		'appearance-none h-[30px] pl-3 pr-8 rounded-[5px] bg-[var(--surface-1)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] outline-none cursor-pointer';
	const metricCols = 'grid-template-columns:1fr 150px 80px; gap:0 16px';
	const projectCols = 'grid-template-columns:1fr 70px 130px 60px; gap:0 20px';
</script>

<svelte:head>
	<title>Leaderboards — Necter Mining App Store</title>
</svelte:head>

<div class="min-h-screen animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
	<div class="mb-5">
		<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Leaderboards</h1>
		<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5 hidden md:block">Top miners and projects on the Necter testnet</p>
	</div>

	<!-- Tabs + Controls -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
		<div class="flex gap-1 overflow-x-auto">
			{#each TABS as t (t.id)}
				<Button
					variant="ghost"
					size="sm"
					onclick={() => (tab = t.id)}
					class="gap-1.5 px-4 text-[12px] {tab === t.id ? '!bg-[var(--accent-subtle)] !text-[var(--text-accent)]' : ''}"
				>
					<t.icon size={14} strokeWidth={1.5} />
					<span class="hidden md:inline">{t.label}</span>
					<span class="md:hidden">{t.short}</span>
				</Button>
			{/each}
		</div>
		<div class="flex items-center gap-2">
			{#if tab === 'projects'}
				<div class="relative">
					<select bind:value={category} class={selectClass} aria-label="Category">
						<option value="all">All Categories</option>
						{#each CATEGORIES as c (c.slug)}<option value={c.slug}>{c.name}</option>{/each}
					</select>
					<ChevronDown size={12} strokeWidth={1.5} class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
				</div>
			{:else}
				<div class="relative">
					<select bind:value={projectFilter} class="{selectClass} max-w-[200px]" aria-label="Project">
						<option value="">All projects</option>
						{#each allProjects.data?.items ?? [] as p (p.project_id)}<option value={p.project_id}>{p.name}</option>{/each}
					</select>
					<ChevronDown size={12} strokeWidth={1.5} class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
				</div>
				<div class="flex gap-[2px] bg-[var(--surface-2)] rounded-[5px] p-[2px]">
					{#each [{ id: '24h', label: '24H' }, { id: '7d', label: '7D' }, { id: '30d', label: '30D' }, { id: 'all', label: 'All' }] as p (p.id)}
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (period = p.id as Period)}
							class="!h-[26px] !px-2.5 !rounded-[4px] text-[11px] {period === p.id ? '!bg-[var(--surface-1)] !text-[var(--text-primary)]' : '!text-[var(--text-tertiary)]'}"
							style={period === p.id ? 'box-shadow: 0 1px 3px rgba(0,0,0,0.2)' : ''}
						>{p.label}</Button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if tab === 'projects'}
		{#if projects.loading}
			<LoadingBlock rows={6} height="52px" />
		{:else if projects.error}
			<ErrorState error={projects.error} retry={projects.refresh} />
		{:else if (projects.data?.items ?? []).length === 0}
			<EmptyState
				illustration="platform"
				title={category === 'all' ? 'No listed projects yet' : 'No projects in this category'}
				description="Projects show up here once a developer publishes them and they pass review on the testnet."
			>
				<a href="/develop" class="btn-secondary">Publish a project</a>
			</EmptyState>
		{:else}
			<Card padding="p-0" class="overflow-x-auto [-webkit-overflow-scrolling:touch]">
				<div class="min-w-[520px]">
					<div class="grid items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border-default)]" style={projectCols}>
						<span>#  Project</span>
						<span class="text-right">Miners</span>
						<span class="text-right">Avg/Miner/Day</span>
						<span class="text-right">Rating</span>
					</div>
					{#each projects.data?.items ?? [] as app, i (app.project_id)}
						{@const rank = i + 1}
						{@const color = RANK_COLORS[rank] ?? 'var(--text-tertiary)'}
						<a href="/apps/{app.project_id}" class="grid items-center px-4 py-3 border-b border-[var(--border-default)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors no-underline" style={projectCols}>
							<div class="flex items-center gap-4 min-w-0">
								<span class="text-[13px] font-semibold font-mono w-5 shrink-0" style="color:{color}">{rank}</span>
								<ProjectIcon project={app} size={28} rounded="5px" />
								<div class="min-w-0">
									<span class="text-[13px] font-medium text-[var(--text-primary)] truncate block">{app.name}</span>
									<span class="text-[10px] text-[var(--text-tertiary)] truncate block">{categoryShort(app.category)}</span>
								</div>
							</div>
							<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">{formatNumber(app.miners)}</span>
							<span class="text-right text-[12px] font-medium font-mono truncate" style="color:{color}">
								{app.avg_daily_reward_per_miner ? formatToken(app.avg_daily_reward_per_miner, app.token) : '—'}
							</span>
							<span class="text-right text-[11px] text-[var(--text-secondary)] font-mono">{formatRating(app.average_rating_x100)}</span>
						</a>
					{/each}
				</div>
			</Card>
		{/if}
	{:else}
		{@const metric = tab}
		{#if board.loading}
			<LoadingBlock rows={8} height="52px" />
		{:else if board.error}
			<ErrorState error={board.error} retry={board.refresh} />
		{:else if items.length === 0}
			<EmptyState
				illustration="bee"
				title="No miners ranked yet"
				description="Rankings fill in as miners earn compute units in committee rounds. Subscribe a device to a project to get on the board."
			>
				<a href="/discover" class="btn-secondary">Browse projects</a>
			</EmptyState>
		{:else}
			<Card padding="p-0" class="overflow-x-auto [-webkit-overflow-scrolling:touch]">
				<div class="min-w-[420px]">
					<div class="grid items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border-default)]" style={metricCols}>
						<span>#  Miner</span>
						<span class="text-right">{VALUE_HEADER[metric]}</span>
						<span class="text-right">Devices</span>
					</div>
					{#each items as row (row.address)}
						{@const color = RANK_COLORS[row.rank] ?? 'var(--text-tertiary)'}
						{@const isMe = me === row.address.toLowerCase()}
						<a
							href="/profiles/{row.address.toLowerCase()}"
							class="grid items-center px-4 py-3 border-b border-[var(--border-default)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors no-underline"
							style="{metricCols}; {isMe ? 'background:var(--accent-subtle)' : ''}"
						>
							<div class="flex items-center gap-4 min-w-0">
								<span class="text-[13px] font-semibold font-mono w-5 shrink-0 tabular-nums" style="color:{isMe ? 'var(--text-accent)' : color}">{row.rank}</span>
								<img src={minerAvatarDataUri(row.address)} alt="" class="w-7 h-7 shrink-0 hex-avatar" loading="lazy" />
								<span class="text-[13px] font-mono truncate {isMe ? 'text-[var(--text-accent)]' : 'text-[var(--text-primary)]'}">
									{shortAddress(row.address)}{#if isMe} <span class="text-[10px] font-sans">(You)</span>{/if}
								</span>
							</div>
							<span class="text-right text-[13px] font-medium font-mono tabular-nums truncate" style="color:{isMe ? 'var(--text-accent)' : color}">{formatValue(metric, row.value)}</span>
							<span class="text-right text-[12px] text-[var(--text-secondary)] font-mono">{formatNumber(row.devices)}</span>
						</a>
					{/each}
				</div>
			</Card>
		{/if}
	{/if}
</div>
