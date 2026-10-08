<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Signal,
		Brain,
		HardDrive,
		Server,
		Wifi,
		Layers,
		Cpu,
		Lock,
		Blocks,
		Globe,
		Star,
		Flame
	} from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import type { Category, ProjectSummary } from '$lib/api/types';
	import { CATEGORIES, formatAmount, formatNumber, formatRating } from '$lib/format';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	/* ─── Category presentation ─── */
	const META: Record<Category, { icon: typeof Signal; desc: string }> = {
		depin: { icon: Signal, desc: 'Decentralized physical infrastructure' },
		'machine-learning': { icon: Brain, desc: 'AI training, inference, and labeling' },
		compute: { icon: Server, desc: 'General-purpose deterministic compute' },
		storage: { icon: HardDrive, desc: 'Distributed file and data storage' },
		iot: { icon: Wifi, desc: 'Internet of Things and sensors' },
		'data-sovereignty': { icon: Lock, desc: 'Privacy and data ownership' },
		bandwidth: { icon: Layers, desc: 'CDN, VPN, and network relay' },
		'content-delivery': { icon: Globe, desc: 'Content delivery and media workloads' },
		blockchain: { icon: Blocks, desc: 'Chain infrastructure and indexing' },
		'hardware-staking': { icon: Cpu, desc: 'Stake hardware resources' }
	};

	const NEW_WINDOW_SECS = 14 * 86400;

	/* ─── Data ─── */
	const counts = useQuery(() => hub.categories());
	const projectsQ = useQuery(() => hub.projects({ sort: 'trending', limit: 200 }));

	const countBySlug = $derived(new Map((counts.data?.items ?? []).map((c) => [c.slug, c.projects])));

	const byCategory = $derived.by(() => {
		const map = new Map<string, ProjectSummary[]>();
		for (const app of (projectsQ.data?.items ?? []) as ProjectSummary[]) {
			const list = map.get(app.category) ?? [];
			list.push(app);
			map.set(app.category, list);
		}
		return map;
	});

	const totalListed = $derived(((projectsQ.data?.items ?? []) as ProjectSummary[]).length);

	function rewardPerDay(p: ProjectSummary): string | null {
		if (!p.avg_daily_reward_per_miner || p.avg_daily_reward_per_miner === '0') return null;
		return `${formatAmount(p.avg_daily_reward_per_miner, p.token.decimals, { maxFrac: 2, compact: true })} ${p.token.symbol}/d`;
	}

	function isNew(p: ProjectSummary): boolean {
		return !!p.listed_at && Date.now() / 1000 - p.listed_at < NEW_WINDOW_SECS;
	}
</script>

<svelte:head>
	<title>Categories — Necter Mining App Store</title>
</svelte:head>

<div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
	<h1 class="text-[20px] font-semibold text-[var(--text-primary)] mb-4">Categories</h1>

	<!-- All categories with listed-project counts -->
	<div class="flex flex-wrap gap-2 mb-8">
		{#each CATEGORIES as c (c.slug)}
			{@const Icon = META[c.slug].icon}
			{@const n = countBySlug.get(c.slug)}
			<a
				href="/category/{c.slug}"
				class="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-full text-[12px] no-underline transition-colors hover:bg-[var(--surface-2)] bg-[var(--surface-1)] border border-[var(--border-default)] text-[var(--text-primary)]"
			>
				<Icon class="h-3.5 w-3.5 text-[var(--text-accent)]" strokeWidth={1.6} />
				{c.short}
				{#if n !== undefined}
					<span class="text-[var(--text-tertiary)] font-mono">{n}</span>
				{/if}
			</a>
		{/each}
	</div>

	{#if projectsQ.loading && !projectsQ.data}
		<LoadingBlock rows={4} grid height="96px" />
	{:else if projectsQ.error}
		<ErrorState error={projectsQ.error} retry={() => projectsQ.refresh()} />
	{:else if totalListed === 0}
		<EmptyState
			illustration="platform"
			title="The first Necter projects are on their way"
			description="No project is listed in any category yet. Publish one, or get your device ready to mine as soon as one goes live."
		>
			<a href="/develop" class="btn-secondary h-8 px-3 no-underline">Publish a project</a>
			<a href="/mining/hardware-checker" class="btn-secondary h-8 px-3 no-underline">Install the miner</a>
		</EmptyState>
	{:else}
		<div class="space-y-10">
			{#each CATEGORIES as { name, slug } (slug)}
				{@const catApps = byCategory.get(slug) ?? []}
				{#if catApps.length > 0}
					<section>
						<div class="flex items-center justify-between mb-3">
							<div>
								<h2 class="text-[14px] font-semibold text-[var(--text-primary)]">{name}</h2>
								<p class="text-[11px] text-[var(--text-tertiary)]">{META[slug].desc}</p>
							</div>
							<a href="/category/{slug}" class="text-[12px] text-[var(--text-accent)] hover:underline">
								See all ({countBySlug.get(slug) ?? catApps.length})
							</a>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{#each catApps.slice(0, 4) as app (app.project_id)}
								<a href="/apps/{app.project_id}" class="group block">
									<div
										class="flex items-start gap-3.5 p-3.5 rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)] transition-[border-color,background-color] duration-100 ease-out cursor-pointer"
									>
										<ProjectIcon project={app} size={52} rounded="12px" />
										<div class="flex-1 min-w-0">
											<div class="flex items-start justify-between gap-2">
												<div class="min-w-0">
													<h3 class="text-[13px] font-semibold text-[var(--text-primary)] truncate">
														{app.name}
													</h3>
													<p class="text-[12px] text-[var(--text-tertiary)] truncate mt-0.5">
														{app.tagline ?? app.developer_name ?? ''}
													</p>
												</div>
												<button
													type="button"
													class="btn-subscribe flex-shrink-0 mt-0.5"
													onclick={(e) => {
														e.preventDefault();
														e.stopPropagation();
														void goto(`/apps/${app.project_id}/subscribe`);
													}}
												>
													Mine
												</button>
											</div>
											<div class="flex items-center gap-3 mt-2.5 text-[11px] flex-wrap">
												{#if app.average_rating_x100 != null && (app.review_count ?? 0) > 0}
													<span class="flex items-center gap-1 text-[var(--text-secondary)]">
														<Star size={10} strokeWidth={0} fill="var(--accent-base)" />
														<span class="font-semibold text-[var(--text-accent)]">{formatRating(app.average_rating_x100)}</span>
													</span>
													<span class="text-[var(--text-tertiary)]">&middot;</span>
												{/if}
												{#if rewardPerDay(app)}
													<span class="font-mono text-[var(--text-secondary)]" title="Recent average per miner">
														{rewardPerDay(app)}
													</span>
													<span class="text-[var(--text-tertiary)]">&middot;</span>
												{/if}
												<span class="text-[var(--text-tertiary)]">
													{formatNumber(app.miners ?? 0)} miner{app.miners === 1 ? '' : 's'}
												</span>
												{#if app.trending}
													<span
														class="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-500"
													>
														<Flame class="h-3 w-3" /> Hot
													</span>
												{:else if isNew(app)}
													<span
														class="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-500"
														>New</span
													>
												{/if}
											</div>
										</div>
									</div>
								</a>
							{/each}
						</div>
					</section>
				{/if}
			{/each}
		</div>
	{/if}
</div>
