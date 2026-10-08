<script lang="ts">
	import { Search, X, Clock } from 'lucide-svelte';
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import toast from 'svelte-french-toast';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { ProjectSummary } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { preferences, pushRecentSearch, clearRecentSearches } from '$lib/stores/account';
	import { CATEGORIES, categoryShort, compactNumber, formatAmount } from '$lib/format';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';

	let inputRef = $state<HTMLInputElement | null>(null);

	// The URL (?q=) is the source of truth; the input is debounced into it.
	const urlQuery = $derived((page.url.searchParams.get('q') ?? '').trim());
	let query = $state(page.url.searchParams.get('q') ?? '');
	let debounce: ReturnType<typeof setTimeout> | null = null;
	let lastPushed: string | null = null;

	function syncUrl(value: string) {
		const v = value.trim();
		if (v === urlQuery) return;
		lastPushed = v;
		const url = new URL(page.url);
		if (v) url.searchParams.set('q', v);
		else url.searchParams.delete('q');
		void goto(`${url.pathname}${url.search}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function onInput() {
		if (debounce) clearTimeout(debounce);
		debounce = setTimeout(() => syncUrl(query), 250);
	}

	// Back/forward navigation updates the input.
	$effect(() => {
		const q = urlQuery;
		if (q === lastPushed) {
			lastPushed = null;
			return;
		}
		untrack(() => {
			if (q !== query.trim()) query = q;
		});
	});

	const isSearching = $derived(urlQuery.length > 0);

	const results = useQuery(() => hub.projects({ q: urlQuery, limit: 30 }), { enabled: () => urlQuery.length > 0 });
	const suggested = useQuery(() => hub.projects({ sort: 'trending', limit: 8 }));

	const resultItems = $derived((results.data?.items ?? []) as ProjectSummary[]);
	const suggestedItems = $derived((suggested.data?.items ?? []) as ProjectSummary[]);
	const recentSearches = $derived(($signedIn ? ($preferences?.recent_searches ?? []) : []).slice(0, 8));

	function rewardPerDay(p: ProjectSummary): string | null {
		if (!p.avg_daily_reward_per_miner || p.avg_daily_reward_per_miner === '0') return null;
		return `${formatAmount(p.avg_daily_reward_per_miner, p.token.decimals, { maxFrac: 2, compact: true })} ${p.token.symbol}/d`;
	}

	function saveSearch(term: string) {
		if ($signedIn) void pushRecentSearch(term);
	}

	function runSearch(term: string) {
		query = term;
		if (debounce) clearTimeout(debounce);
		syncUrl(term);
		saveSearch(term);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && query.trim()) {
			if (debounce) clearTimeout(debounce);
			syncUrl(query);
			saveSearch(query);
		}
	}

	async function onClearRecent() {
		try {
			await clearRecentSearches();
		} catch (e) {
			toast.error(errorMessage(e));
		}
	}

	onMount(() => {
		// Auto-focus
		const t = setTimeout(() => inputRef?.focus(), 100);
		return () => {
			clearTimeout(t);
			if (debounce) clearTimeout(debounce);
		};
	});
</script>

<svelte:head>
	<title>Search - Necter Mining App Store</title>
</svelte:head>

{#snippet row(app: ProjectSummary, onclick?: () => void)}
	<a
		href="/apps/{app.project_id}"
		{onclick}
		class="flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-[var(--surface-2)]"
	>
		<ProjectIcon project={app} size={44} class="shrink-0" />
		<div class="flex-1 min-w-0">
			<p class="text-[14px] font-medium truncate text-[var(--text-primary)]">
				{app.name}
			</p>
			<p class="text-[12px] text-[var(--text-tertiary)] truncate">
				{categoryShort(app.category)}{app.developer_name ? ` · ${app.developer_name}` : ''}
			</p>
		</div>
		<div class="text-right shrink-0">
			{#if rewardPerDay(app)}
				<p class="text-[12px] font-mono text-[var(--text-accent)] tabular-nums" title="Recent average per miner">
					{rewardPerDay(app)}
				</p>
			{/if}
			{#if app.miners !== undefined}
				<p class="text-[10px] text-[var(--text-tertiary)]">
					{compactNumber(app.miners)} miner{app.miners === 1 ? '' : 's'}
				</p>
			{/if}
		</div>
	</a>
{/snippet}

<div class="animate-fadeIn min-h-screen">
	<!-- Search bar -->
	<div class="sticky top-[48px] md:top-0 z-30 bg-[var(--surface-0)] border-b border-[var(--border-default)]">
		<div class="px-4 md:px-6 py-3 max-w-[640px] mx-auto">
			<div
				class="flex items-center gap-3 h-[40px] px-3 rounded-[10px] bg-[var(--surface-1)] border border-[var(--border-default)]"
			>
				<Search class="h-[18px] w-[18px] shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.5} />
				<input
					bind:this={inputRef}
					type="search"
					bind:value={query}
					oninput={onInput}
					placeholder="Search projects, tags, developers..."
					aria-label="Search projects"
					class="flex-1 bg-transparent border-none outline-none text-[15px] text-[var(--text-primary)]"
					onkeydown={handleKeydown}
				/>
				{#if query}
					<button
						type="button"
						aria-label="Clear search"
						onclick={() => runSearch('')}
						class="h-5 w-5 rounded-full flex items-center justify-center border-none cursor-pointer shrink-0 bg-[var(--surface-3)]"
					>
						<X class="h-3 w-3 text-[var(--text-tertiary)]" strokeWidth={2} />
					</button>
				{/if}
			</div>
		</div>
	</div>

	<div class="px-4 md:px-6 pt-4 pb-12 max-w-[640px] mx-auto">
		<!-- No query — show recent searches, suggested projects and categories -->
		{#if !isSearching}
			<div class="space-y-6">
				{#if recentSearches.length > 0}
					<div>
						<div class="flex items-center justify-between mb-3">
							<h2 class="text-[15px] font-semibold text-[var(--text-primary)]">Recent</h2>
							<button
								type="button"
								onclick={onClearRecent}
								class="text-[12px] text-[var(--text-accent)] bg-transparent border-none cursor-pointer p-0"
							>
								Clear
							</button>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each recentSearches as term (term)}
								<button
									type="button"
									onclick={() => runSearch(term)}
									class="inline-flex items-center gap-1.5 h-[34px] px-4 rounded-full text-[13px] cursor-pointer transition-colors hover:bg-[var(--surface-2)] bg-[var(--surface-1)] border border-[var(--border-default)] text-[var(--text-primary)]"
								>
									<Clock class="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.5} />
									{term}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Suggested projects -->
				<div>
					<h2 class="text-[15px] font-semibold mb-3 text-[var(--text-primary)]">Suggested</h2>
					{#if suggested.loading && !suggested.data}
						<LoadingBlock rows={4} height="68px" />
					{:else if suggested.error}
						<ErrorState error={suggested.error} retry={() => suggested.refresh()} compact />
					{:else if suggestedItems.length === 0}
						<EmptyState
							compact
							illustration="platform"
							title="No projects listed yet"
							description="The first Necter projects are on their way. Get your device ready in the meantime."
						>
							<a href="/mining/hardware-checker" class="btn-secondary h-8 px-3 no-underline">Install the miner</a>
							<a href="/develop" class="btn-secondary h-8 px-3 no-underline">Publish a project</a>
						</EmptyState>
					{:else}
						<div
							class="rounded-[10px] overflow-hidden divide-y bg-[var(--surface-1)] border border-[var(--border-default)] divide-[var(--border-default)]"
						>
							{#each suggestedItems as app (app.project_id)}
								{@render row(app)}
							{/each}
						</div>
					{/if}
				</div>

				<!-- Categories -->
				<div>
					<h2 class="text-[15px] font-semibold mb-3 text-[var(--text-primary)]">Categories</h2>
					<div class="flex flex-wrap gap-2">
						{#each CATEGORIES as c (c.slug)}
							<a
								href="/category/{c.slug}"
								class="inline-flex items-center h-[34px] px-4 rounded-full text-[13px] no-underline transition-colors hover:bg-[var(--surface-2)] bg-[var(--surface-1)] border border-[var(--border-default)] text-[var(--text-primary)]"
							>
								{c.short}
							</a>
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<!-- Search results -->
			<div>
				{#if results.loading && !results.data}
					<LoadingBlock rows={5} height="68px" />
				{:else if results.error}
					<ErrorState error={results.error} retry={() => results.refresh()} />
				{:else if resultItems.length === 0}
					<EmptyState
						illustration="bee"
						title={`No results for "${urlQuery}"`}
						description="Try a different name, tag or developer, or browse projects by category."
					>
						<a href="/category" class="btn-secondary h-8 px-3 no-underline">Browse categories</a>
						<a href="/discover" class="btn-secondary h-8 px-3 no-underline">Discover</a>
					</EmptyState>
				{:else}
					<div
						class="rounded-[10px] overflow-hidden divide-y bg-[var(--surface-1)] border border-[var(--border-default)] divide-[var(--border-default)]"
					>
						{#each resultItems as app (app.project_id)}
							{@render row(app, () => saveSearch(urlQuery))}
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	input::placeholder {
		color: var(--text-tertiary);
	}
	input[type='search']::-webkit-search-cancel-button {
		display: none;
	}
</style>
