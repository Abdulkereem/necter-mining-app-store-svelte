<script lang="ts">
	import { goto } from '$app/navigation';
	import { Flame, Award, Star } from 'lucide-svelte';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import type { Collection, ProjectSummary } from '$lib/api/types';
	import { categoryName, formatAmount, formatNumber, formatRating } from '$lib/format';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const NEW_WINDOW_SECS = 14 * 86400;

	const category = $derived(data.category);
	const title = $derived(category ? categoryName(category) : 'Category');

	const projectsQ = useQuery(
		() => {
			const c = category;
			if (!c) return Promise.resolve(null);
			return hub.projects({ category: c, sort: 'trending', limit: 200 });
		},
		{ enabled: () => !!category }
	);
	const collectionsQ = useQuery(() => hub.collections(), { enabled: () => !!category });

	const apps = $derived((projectsQ.data?.items ?? []) as ProjectSummary[]);

	const editorsPickIds = $derived.by(() => {
		const ids = new Set<string>();
		for (const c of (collectionsQ.data?.items ?? []) as Collection[]) {
			if (c.kind === 'editors_picks') for (const id of c.project_ids) ids.add(id);
		}
		return ids;
	});

	function rewardPerDay(p: ProjectSummary): string | null {
		if (!p.avg_daily_reward_per_miner || p.avg_daily_reward_per_miner === '0') return null;
		return `${formatAmount(p.avg_daily_reward_per_miner, p.token.decimals, { maxFrac: 2, compact: true })} ${p.token.symbol}/d`;
	}

	function isNew(p: ProjectSummary): boolean {
		return !!p.listed_at && Date.now() / 1000 - p.listed_at < NEW_WINDOW_SECS;
	}
</script>

<svelte:head>
	<title>{title} — Necter Mining App Store</title>
</svelte:head>

{#if !category}
	<div class="min-h-screen pb-12">
		<div class="max-w-6xl mx-auto px-6 py-10">
			<EmptyState
				illustration="network"
				title="Category not found"
				description="This category doesn't exist. Categories group listed Necter projects by the kind of work they run."
			>
				<a href="/category" class="btn-secondary h-8 px-3 no-underline">All categories</a>
				<a href="/discover" class="btn-secondary h-8 px-3 no-underline">Back to Discover</a>
			</EmptyState>
		</div>
	</div>
{:else}
	<div class="min-h-screen pb-12">
		<div class="border-b border-[var(--border-default)]">
			<div class="max-w-6xl mx-auto px-6 py-8">
				<div class="flex items-center justify-between gap-4">
					<div>
						<div class="flex items-center gap-2">
							<h1 class="text-[20px] font-semibold">{title}</h1>
							<span
								class="inline-flex items-center px-2 py-0.5 rounded border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)]"
								>{category}</span
							>
						</div>
						{#if projectsQ.data}
							<p class="text-[var(--text-secondary)] mt-1">
								{apps.length}
								{apps.length === 1 ? 'project' : 'projects'} in this category
							</p>
						{/if}
					</div>
					<a href="/discover" class="text-[var(--text-accent)] hover:underline">Browse all</a>
				</div>
			</div>
		</div>

		<div class="max-w-6xl mx-auto px-6 py-8">
			{#if projectsQ.loading && !projectsQ.data}
				<LoadingBlock rows={4} grid height="96px" />
			{:else if projectsQ.error}
				<ErrorState error={projectsQ.error} retry={() => projectsQ.refresh()} />
			{:else if apps.length === 0}
				<EmptyState
					illustration="platform"
					title="No {title} projects yet"
					description="Nothing is listed in this category yet. Check back soon, or publish the first one."
				>
					<a href="/develop" class="btn-secondary h-8 px-3 no-underline">Publish a project</a>
					<a href="/discover" class="btn-secondary h-8 px-3 no-underline">Back to Discover</a>
				</EmptyState>
			{:else}
				<div class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
					{#each apps as app (app.project_id)}
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
										{:else if editorsPickIds.has(app.project_id)}
											<span
												class="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-subtle)] text-[var(--text-accent)]"
											>
												<Award class="h-3 w-3" /> Editors' pick
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
			{/if}
		</div>
	</div>
{/if}
