<script lang="ts">
	import { Search, X } from 'lucide-svelte';
	import { backendState, backend } from '$lib/stores/backend';
	import { appIconDataUri } from '$lib/app-icon';
	import { onMount } from 'svelte';

	const TRENDING_TERMS = ['AI', 'Storage', 'DePIN', 'GPU', 'Compute', 'IoT', 'Bandwidth'];

	let query = $state('');
	let inputRef = $state<HTMLInputElement | null>(null);
	let recentSearches = $state<string[]>([]);

	// All listed apps
	const apps = $derived(backend.listApps());

	// Suggested: 8 random apps (stable until query changes)
	let suggestedApps = $state<typeof apps>([]);

	// Live search results
	const results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return apps
			.filter(
				(a) =>
					a.name.toLowerCase().includes(q) ||
					a.category.toLowerCase().includes(q) ||
					a.developer.toLowerCase().includes(q) ||
					(a.tags ?? []).some((t: string) => t.toLowerCase().includes(q))
			)
			.slice(0, 20);
	});

	const isSearching = $derived(query.trim().length > 0);

	function getIconSrc(app: (typeof apps)[0]) {
		if (app.icon && app.icon !== '/placeholder.svg') return app.icon;
		return appIconDataUri({ id: app.id, name: app.name });
	}

	function saveSearch(term: string) {
		const trimmed = term.trim();
		if (!trimmed) return;
		const next = [
			trimmed,
			...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())
		].slice(0, 5);
		recentSearches = next;
		try {
			localStorage.setItem('necter_recent_searches', JSON.stringify(next));
		} catch {
			// ignore
		}
	}

	function handleTrendingClick(term: string) {
		query = term;
		saveSearch(term);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && query.trim()) {
			saveSearch(query);
		}
	}

	onMount(() => {
		// Auto-focus
		setTimeout(() => inputRef?.focus(), 100);

		// Load recent searches
		try {
			const saved = JSON.parse(localStorage.getItem('necter_recent_searches') || '[]');
			if (Array.isArray(saved)) recentSearches = saved.slice(0, 5);
		} catch {
			// ignore
		}

		// Pick 8 random suggested apps
		suggestedApps = [...apps].sort(() => 0.5 - Math.random()).slice(0, 8);
	});
</script>

<svelte:head>
	<title>Search - Necter Mining App Store</title>
</svelte:head>

<div class="animate-fadeIn min-h-screen">
	<!-- Search bar -->
	<div
		class="sticky top-[48px] md:top-0 z-30"
		class="bg-[var(--surface-0)] border-b border-[var(--border-default)]"
	>
		<div class="px-4 md:px-6 py-3 max-w-[640px] mx-auto">
			<div
				class="flex items-center gap-3 h-[40px] px-3 rounded-[10px] bg-[var(--surface-1)] border border-[var(--border-default)]"
			>
				<Search
					class="h-[18px] w-[18px] shrink-0 text-[var(--text-tertiary)]"
					strokeWidth={1.5}
				/>
				<input
					bind:this={inputRef}
					type="text"
					bind:value={query}
					placeholder="Search projects, categories, developers..."
					class="flex-1 bg-transparent border-none outline-none text-[15px] text-[var(--text-primary)]"
					onkeydown={handleKeydown}
				/>
				{#if query}
					<button
						type="button"
						onclick={() => (query = '')}
						class="h-5 w-5 rounded-full flex items-center justify-center border-none cursor-pointer shrink-0 bg-[var(--surface-3)]"
					>
						<X class="h-3 w-3 text-[var(--text-tertiary)]" strokeWidth={2} />
					</button>
				{/if}
			</div>
		</div>
	</div>

	<div class="px-4 md:px-6 pt-4 pb-12 max-w-[640px] mx-auto">
		<!-- No query — show suggested projects + trending -->
		{#if !isSearching}
			<div class="space-y-6">
				<!-- Suggested projects -->
				<div>
					<h2 class="text-[15px] font-semibold mb-3 text-[var(--text-primary)]">
						Suggested
					</h2>
					<div
						class="rounded-[10px] overflow-hidden divide-y bg-[var(--surface-1)] border border-[var(--border-default)] divide-[var(--border-default)]"
					>
						{#each suggestedApps as app (app.id)}
							<a
								href="/apps/{app.id}"
								class="flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-[var(--surface-2)]"
							>
								<img
									src={getIconSrc(app)}
									alt={app.name}
									class="w-[44px] h-[44px] rounded-[10px] shrink-0"
								/>
								<div class="flex-1 min-w-0">
									<p class="text-[14px] font-medium truncate text-[var(--text-primary)]">
										{app.name}
									</p>
									<p class="text-[12px] text-[var(--text-tertiary)]">
										{app.category}
									</p>
								</div>
								<div class="text-right shrink-0">
									<p
										class="text-[12px] font-mono text-[var(--text-accent)] tabular-nums"
									>
										${app.avgEarningsPerDay.toFixed(0)}/d
									</p>
								</div>
							</a>
						{/each}
					</div>
				</div>

				<!-- Trending terms -->
				<div>
					<h2 class="text-[15px] font-semibold mb-3 text-[var(--text-primary)]">
						Trending
					</h2>
					<div class="flex flex-wrap gap-2">
						{#each TRENDING_TERMS as term}
							<button
								type="button"
								onclick={() => handleTrendingClick(term)}
								class="inline-flex items-center h-[34px] px-4 rounded-full text-[13px] cursor-pointer transition-colors hover:bg-[var(--surface-2)] bg-[var(--surface-1)] border border-[var(--border-default)] text-[var(--text-primary)]"
							>
								{term}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<!-- Search results -->
			<div>
				{#if results.length === 0}
					<div class="text-center pt-12">
						<p class="text-[15px] font-semibold mb-1 text-[var(--text-primary)]">
							No results for "{query}"
						</p>
						<p class="text-[13px] text-[var(--text-tertiary)]">
							Try a different search term
						</p>
					</div>
				{:else}
					<div
						class="rounded-[10px] overflow-hidden divide-y bg-[var(--surface-1)] border border-[var(--border-default)] divide-[var(--border-default)]"
					>
						{#each results as app (app.id)}
							<a
								href="/apps/{app.id}"
								onclick={() => saveSearch(query)}
								class="flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-[var(--surface-2)]"
							>
								<img
									src={getIconSrc(app)}
									alt={app.name}
									class="w-[44px] h-[44px] rounded-[10px] shrink-0"
								/>
								<div class="flex-1 min-w-0">
									<p class="text-[14px] font-medium truncate text-[var(--text-primary)]">
										{app.name}
									</p>
									<p class="text-[12px] text-[var(--text-tertiary)]">
										{app.category}
									</p>
								</div>
								<div class="text-right shrink-0">
									<p
										class="text-[12px] font-mono text-[var(--text-accent)] tabular-nums"
									>
										${app.avgEarningsPerDay.toFixed(0)}/d
									</p>
									<p class="text-[10px] text-[var(--text-tertiary)]">
										{app.totalMiners} miners
									</p>
								</div>
							</a>
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
</style>
