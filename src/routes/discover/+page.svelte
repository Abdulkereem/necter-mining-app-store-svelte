<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor } from '$lib/stores/wallet';
	import { appIconDataUri } from '$lib/app-icon';
	import { Users, TrendingUp, ChevronRight, ChevronLeft } from 'lucide-svelte';
	import type { App, AppCategory } from '$lib/types';

	/* ─── Helper ─── */
	function appIcon(app: App): string {
		return app.icon && app.icon !== '/placeholder.svg'
			? app.icon
			: appIconDataUri({ id: app.id, name: app.name, category: app.category });
	}

	function chunk<T>(arr: T[], size: number): T[][] {
		const result: T[][] = [];
		for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
		return result;
	}

	/* ─── Hero constants ─── */
	const heroGradients = [
		{ from: '#1a0a2e', to: '#0d1b3e', accent: '#FFBF00' },
		{ from: '#0a1e0d', to: '#0d2b1a', accent: '#4CB782' },
		{ from: '#1e0a0a', to: '#2b1a0d', accent: '#FF8664' },
		{ from: '#0a0e1e', to: '#0d1a2b', accent: '#6E9FFF' }
	];

	const heroImages: Record<string, string> = {
		'Helium Network': '/screenshots/helium-1.jpg',
		'Render Network': '/screenshots/render-1.jpg',
		'Filecoin Storage': '/screenshots/filecoin-1.png',
		'Chainlink': '/screenshots/chainlink-2.jpg',
		'Akash Network': '/screenshots/akash-1.png',
		'The Graph': '/screenshots/thegraph-2.jpg',
		'Polkadot': '/screenshots/polkadot-1.png',
		'Grass': '/screenshots/grass-1.png',
		'Bittensor': '/screenshots/bittensor-1.png',
		'Ocean Protocol': '/screenshots/ocean-1.png',
		'Storj': '/screenshots/storj-1.webp',
		'Golem Network': '/screenshots/golem-1.png',
		'Livepeer Network': '/screenshots/livepeer-1.png',
		'Arweave': '/screenshots/arweave-1.jpg'
	};

	const heroLabels = ['FEATURED NETWORK', "EDITORS' CHOICE", 'NEW & NOTEWORTHY', 'TRENDING'];

	const heroTitles = [
		(name: string) => `${name}, the #1 mining network`,
		(name: string) => `Why miners love ${name}`,
		(name: string) => `${name} just launched on Necter`,
		(name: string) => `${name} is trending now`
	];

	/* ─── Story constants ─── */
	const storyColors = [
		{ bg: '#1a1428', accent: '#FFBF00' },
		{ bg: '#0f1e14', accent: '#4CB782' },
		{ bg: '#1e1410', accent: '#FF8664' },
		{ bg: '#101420', accent: '#6E9FFF' },
		{ bg: '#1a0f1e', accent: '#C084FC' }
	];

	const storyLabels = [
		'NETWORKS WE LOVE',
		'MAJOR UPDATE',
		'GET STARTED',
		'BEHIND THE APP',
		'APPS WE LOVE'
	];

	const storyTitles = [
		(name: string) => `Earn passive income with ${name}`,
		(name: string) => `${name} 2.0 is here`,
		(name: string) => `New to mining? Try ${name}`,
		(name: string) => `How ${name} verifies proofs`,
		(name: string) => `Why ${name} stands out`
	];

	/* ─── Categories ─── */
	const categories = [
		'All',
		'AI/ML',
		'DePIN',
		'Storage',
		'Compute',
		'IoT',
		'Bandwidth',
		'Blockchain',
		'Data Sovereignty',
		'Content Delivery'
	];

	/* ─── State ─── */
	let heroActive = $state(0);
	let heroTimer: ReturnType<typeof setInterval> | null = $state(null);
	let showOnboarding = $state(false);
	let hasAutoShown = $state(false);
	let searchQuery = $state('');
	let activeCategory = $state<string>('All');
	let sortBy = $state<'reputation' | 'earnings' | 'miners' | 'newest'>('reputation');

	/* ─── ScrollRow refs ─── */
	let storyScrollRef = $state<HTMLDivElement | null>(null);
	let bestNewScrollRef = $state<HTMLDivElement | null>(null);
	let trendingScrollRef = $state<HTMLDivElement | null>(null);
	let topEarningScrollRef = $state<HTMLDivElement | null>(null);
	let topMinersScrollRef = $state<HTMLDivElement | null>(null);

	function scrollRow(ref: HTMLDivElement | null, dir: 'left' | 'right') {
		if (!ref) return;
		ref.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
	}

	/* ─── Derived data ─── */
	const apps = $derived(backend.listApps());

	const appsUniq = $derived.by(() => {
		const seen = new Set<string>();
		const out: App[] = [];
		for (const a of apps) {
			const id = String(a.id);
			if (seen.has(id)) continue;
			seen.add(id);
			out.push({ ...a, id } as App);
		}
		return out;
	});

	// Hero carousel — top 4 by reputation
	const heroApps = $derived(
		[...appsUniq].sort((a, b) => b.reputationScore - a.reputationScore).slice(0, 4)
	);
	const heroIds = $derived(new Set(heroApps.map((a) => a.id)));

	// Story cards — featured apps below hero
	const storyApps = $derived.by(() => {
		const priorityNames = new Set(['DockHive', 'Atum', 'TIWA']);
		const pool = [...appsUniq].filter((a) => !heroIds.has(a.id));
		const priority = pool.filter((a) => priorityNames.has(a.name));
		const rest = pool
			.filter((a) => !priorityNames.has(a.name))
			.sort((a, b) => b.reputationScore - a.reputationScore);
		return [...priority, ...rest].slice(0, 5);
	});
	const storyIds = $derived(new Set(storyApps.map((a) => a.id)));

	// Best new & updated
	const bestNew = $derived(
		[...appsUniq]
			.filter((a) => !heroIds.has(a.id) && !storyIds.has(a.id))
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 9)
	);
	const bestNewIds = $derived(new Set(bestNew.map((a) => a.id)));

	// Trending — simple inline selector (no separate selectors module yet)
	const trending = $derived.by(() => {
		const state = $backendState;
		const now = Date.now();
		const dayMs = 24 * 60 * 60 * 1000;
		const cutoff24h = now - dayMs;

		const activeMinersByAppId = new Map<string, number>();
		for (const s of state.subscriptions) {
			if (s.status !== 'active') continue;
			activeMinersByAppId.set(s.appId, (activeMinersByAppId.get(s.appId) ?? 0) + 1);
		}

		const verified24hByAppId = new Map<string, number>();
		for (const p of state.proofs) {
			if (p.status !== 'verified') continue;
			const t = Date.parse(p.submittedAt);
			if (Number.isFinite(t) && t >= cutoff24h) {
				verified24hByAppId.set(p.appId, (verified24hByAppId.get(p.appId) ?? 0) + 1);
			}
		}

		type TrendingSignal = { appId: string; score: number };
		const signals: TrendingSignal[] = [];
		for (const app of appsUniq) {
			const miners = activeMinersByAppId.get(app.id) ?? 0;
			const verified = verified24hByAppId.get(app.id) ?? 0;
			const score = miners * 2 + verified * 3 + app.reputationScore * 0.5;
			signals.push({ appId: app.id, score });
		}
		signals.sort((a, b) => b.score - a.score);

		const exclude = new Set([...heroIds, ...storyIds, ...bestNewIds]);
		const byId = new Map(appsUniq.map((a) => [a.id, a]));
		return signals
			.map((s) => byId.get(s.appId))
			.filter((a): a is App => !!a && !exclude.has(a.id))
			.slice(0, 9);
	});

	// Top Charts
	const topEarning = $derived(
		[...appsUniq].sort((a, b) => b.avgEarningsPerDay - a.avgEarningsPerDay).slice(0, 7)
	);
	const topMiners = $derived(
		[...appsUniq].sort((a, b) => b.totalMiners - a.totalMiners).slice(0, 7)
	);

	// Curated collections
	const curatedCollections = $derived(backend.listCuratedCollections());

	// Search / filter / sort
	const filteredApps = $derived.by(() => {
		let result = [...appsUniq];
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(a) =>
					a.name.toLowerCase().includes(q) ||
					a.category.toLowerCase().includes(q) ||
					a.developer.toLowerCase().includes(q) ||
					(a.tags ?? []).some((t) => t.toLowerCase().includes(q))
			);
		}
		if (activeCategory !== 'All') {
			result = result.filter((a) => a.category === activeCategory);
		}
		switch (sortBy) {
			case 'earnings':
				result.sort((a, b) => b.avgEarningsPerDay - a.avgEarningsPerDay);
				break;
			case 'miners':
				result.sort((a, b) => b.totalMiners - a.totalMiners);
				break;
			case 'newest':
				result.sort(
					(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
				break;
			default:
				result.sort((a, b) => b.reputationScore - a.reputationScore);
		}
		return result;
	});
	const isFiltering = $derived(searchQuery.trim() !== '' || activeCategory !== 'All');

	/* ─── Hero carousel timer ─── */
	function resetHeroTimer() {
		if (heroTimer) clearInterval(heroTimer);
		heroTimer = setInterval(() => {
			heroActive = (heroActive + 1) % heroApps.length;
		}, 6000);
	}

	function heroGo(dir: 'prev' | 'next') {
		const count = heroApps.length;
		heroActive = dir === 'next' ? (heroActive + 1) % count : (heroActive - 1 + count) % count;
		resetHeroTimer();
	}

	onMount(() => {
		if (heroApps.length > 0) resetHeroTimer();

		// Listen for logo click event from sidebar
		const handler = () => (showOnboarding = true);
		window.addEventListener('necter:open-onboarding', handler);

		return () => {
			if (heroTimer) clearInterval(heroTimer);
			window.removeEventListener('necter:open-onboarding', handler);
		};
	});

	// Auto-show onboarding for new users
	$effect(() => {
		const a = $actor;
		const state = $backendState;
		if (!a) return;
		const isNewUser =
			state.subscriptions.filter((s) => s.minerId === a.minerId).length === 0;
		if (isNewUser && !hasAutoShown) {
			hasAutoShown = true;
			showOnboarding = true;
		}
	});
</script>

<div class="min-h-screen pb-12 animate-fadeIn">
	<!-- ═══ HERO CAROUSEL (full-width, auto-rotating) ═══ -->
	{#if heroApps.length > 0}
		{@const app = heroApps[heroActive]}
		{@const grad = heroGradients[heroActive % heroGradients.length]}
		{@const label = heroLabels[heroActive % heroLabels.length]}
		<div class="relative w-full overflow-hidden">
			<!-- Background layers -->
			{#each heroApps as a, i (a.id)}
				{@const img = heroImages[a.name]}
				<div
					class="absolute inset-0 transition-opacity duration-700 {i === heroActive
						? 'opacity-100'
						: 'opacity-0'}"
				>
					{#if img}
						<div
							class="absolute inset-0 bg-cover bg-center"
							style="background-image: url({img})"
						></div>
						<div class="absolute inset-0 bg-black/70"></div>
					{:else}
						<div
							class="absolute inset-0"
							style="background: linear-gradient(135deg, {heroGradients[i % heroGradients.length].from}, {heroGradients[i % heroGradients.length].to})"
						></div>
					{/if}
				</div>
			{/each}

			<!-- Honeycomb overlay -->
			<div class="absolute inset-0 bg-honeycomb opacity-60 z-[1] pointer-events-none"></div>

			<!-- Content — clickable to app detail -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<a
				href="/apps/{app.id}"
				class="relative z-10 block px-8 pt-10 pb-8 no-underline cursor-pointer"
				onclick={(e) => {
					if ((e.target as HTMLElement).closest('button')) e.preventDefault();
				}}
			>
				<!-- Label -->
				<p
					class="text-[10px] font-bold uppercase tracking-[0.1em] mb-3 transition-colors duration-500"
					style="color: {grad.accent}"
				>
					{label}
				</p>

				<!-- Title + subtitle with crossfade -->
				<div class="min-h-[120px] mb-6">
					{#each heroApps as a, i (a.id)}
						<div
							class="absolute transition-all duration-500 {i === heroActive
								? 'opacity-100 translate-y-0'
								: 'opacity-0 translate-y-2 pointer-events-none'}"
						>
							<h2
								class="text-[28px] font-semibold text-white leading-tight mb-2 max-w-[600px]"
							>
								{heroTitles[i % heroTitles.length](a.name)}
							</h2>
							<p class="text-[14px] text-white/60 max-w-[500px] line-clamp-2">
								{a.description}
							</p>
						</div>
					{/each}
				</div>

				<!-- App lockup at bottom -->
				<div class="flex items-center gap-4">
					<img
						src={appIcon(app)}
						alt={app.name}
						width="48"
						height="48"
						class="rounded-[12px] flex-shrink-0"
					/>
					<div class="flex-1 min-w-0">
						<p class="text-[14px] font-medium text-white truncate">{app.name}</p>
						<p class="text-[12px] text-white/50">{app.developer}</p>
					</div>
					<button
						type="button"
						class="btn-subscribe flex-shrink-0"
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							goto(`/apps/${app.id}?action=mine`);
						}}
					>
						Subscribe
					</button>
				</div>
			</a>

			<!-- Navigation arrows -->
			<button
				type="button"
				onclick={() => heroGo('prev')}
				class="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
			>
				<ChevronLeft class="h-5 w-5 text-white/80" strokeWidth={1.5} />
			</button>
			<button
				type="button"
				onclick={() => heroGo('next')}
				class="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
			>
				<ChevronRight class="h-5 w-5 text-white/80" strokeWidth={1.5} />
			</button>

			<!-- Dots indicator -->
			<div class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
				{#each heroApps as a, i (a.id)}
					<button
						type="button"
						onclick={() => {
							heroActive = i;
							resetHeroTimer();
						}}
						class="h-[6px] rounded-full transition-all duration-300 {i === heroActive
							? 'w-[18px] bg-white/90'
							: 'w-[6px] bg-white/30 hover:bg-white/50'}"
					></button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ═══ EDITORIAL CONTENT — curated discovery ═══ -->

	<!-- Story cards -->
	<div class="px-6 pt-3">
		<div class="relative group/scroll">
			<div
				bind:this={storyScrollRef}
				class="flex gap-6 overflow-x-auto pb-1"
				style="scrollbar-width: none"
			>
				{#each storyApps as app, i (app.id)}
					{@const colors = storyColors[i % storyColors.length]}
					{@const storyLabel = storyLabels[i % storyLabels.length]}
					<a
						href="/apps/{app.id}"
						class="group block flex-shrink-0 w-[280px] rounded-[10px]"
					>
						<!-- Image area -->
						<div
							class="h-[158px] rounded-t-[10px] relative overflow-hidden"
							style="background: linear-gradient(160deg, {colors.bg}, {colors.bg}dd)"
						>
							<!-- Decorative accent circles -->
							<div
								class="absolute -right-8 -bottom-8 w-[120px] h-[120px] rounded-full opacity-20"
								style="background: {colors.accent}"
							></div>
							<div
								class="absolute -left-4 -top-4 w-[60px] h-[60px] rounded-full opacity-10"
								style="background: {colors.accent}"
							></div>
							<!-- App icon centered -->
							<div class="absolute inset-0 flex items-center justify-center">
								<img
									src={appIcon(app)}
									alt={app.name}
									width="64"
									height="64"
									class="rounded-[14px]"
								/>
							</div>
						</div>
						<!-- Text below image -->
						<div class="pt-2.5 pb-1">
							<p
								class="text-[10px] font-bold uppercase tracking-[0.06em] mb-0.5"
								style="color: {colors.accent}"
							>
								{storyLabel}
							</p>
							<h3
								class="text-[14px] font-semibold text-[var(--text-primary)] leading-tight line-clamp-1"
							>
								{storyTitles[i % storyTitles.length](app.name)}
							</h3>
							<p class="text-[12px] text-[var(--text-tertiary)] line-clamp-1 mt-0.5">
								{app.description.slice(0, 60)}
							</p>
						</div>
					</a>
				{/each}
			</div>
			<button
				type="button"
				onclick={() => scrollRow(storyScrollRef, 'left')}
				class="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
			>
				<ChevronLeft class="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
			</button>
			<button
				type="button"
				onclick={() => scrollRow(storyScrollRef, 'right')}
				class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
			>
				<ChevronRight class="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
			</button>
		</div>
	</div>

	<div class="px-6 space-y-0">
		<!-- ─── Best New & Updated ─── -->
		<section>
			<div
				style="border-top: 1px solid var(--border-default); padding-top: 20px; margin-bottom: 12px"
			>
				<div
					style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px"
				>
					<h2
						style="font-size: 14px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.006em; margin: 0"
					>
						Best New & Updated
					</h2>
					<a
						href="/category"
						style="font-size: 12px; color: var(--text-accent); text-decoration: none; display: flex; align-items: center; gap: 2px"
					>
						See All <ChevronRight style="width: 12px; height: 12px" strokeWidth={1.5} />
					</a>
				</div>
				<div class="relative group/scroll">
					<div
						bind:this={bestNewScrollRef}
						class="flex gap-6 overflow-x-auto pb-1"
						style="scrollbar-width: none"
					>
						{#each chunk(bestNew, 3) as group, gi}
							<div class="flex-shrink-0 w-[340px]">
								{#each group as app (app.id)}
									<a href="/apps/{app.id}" class="group block">
										<div
											class="flex items-center gap-3.5 py-3 border-b border-[var(--border-default)] last:border-b-0"
										>
											<img
												src={appIcon(app)}
												alt={app.name}
												width="40"
												height="40"
												class="rounded-[10px] flex-shrink-0"
											/>
											<div class="flex-1 min-w-0">
												<h3
													class="text-[13px] font-medium text-[var(--text-primary)] truncate"
												>
													{app.name}
												</h3>
												<p
													class="text-[11px] text-[var(--text-tertiary)] truncate"
												>
													{app.category}
												</p>
											</div>
											<button
												type="button"
												class="btn-subscribe flex-shrink-0"
												onclick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													goto(`/apps/${app.id}?action=mine`);
												}}
											>
												Subscribe
											</button>
										</div>
									</a>
								{/each}
							</div>
						{/each}
					</div>
					<button
						type="button"
						onclick={() => scrollRow(bestNewScrollRef, 'left')}
						class="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
					>
						<ChevronLeft
							class="h-4 w-4 text-[var(--text-secondary)]"
							strokeWidth={1.5}
						/>
					</button>
					<button
						type="button"
						onclick={() => scrollRow(bestNewScrollRef, 'right')}
						class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
					>
						<ChevronRight
							class="h-4 w-4 text-[var(--text-secondary)]"
							strokeWidth={1.5}
						/>
					</button>
				</div>
			</div>
		</section>

		<!-- ─── Trending Now ─── -->
		{#if trending.length > 0}
			<section>
				<div
					style="border-top: 1px solid var(--border-default); padding-top: 20px; margin-bottom: 12px"
				>
					<div
						style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px"
					>
						<h2
							style="font-size: 14px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.006em; margin: 0"
						>
							Trending Now
						</h2>
						<a
							href="/category"
							style="font-size: 12px; color: var(--text-accent); text-decoration: none; display: flex; align-items: center; gap: 2px"
						>
							See All
							<ChevronRight
								style="width: 12px; height: 12px"
								strokeWidth={1.5}
							/>
						</a>
					</div>
					<div class="relative group/scroll">
						<div
							bind:this={trendingScrollRef}
							class="flex gap-6 overflow-x-auto pb-1"
							style="scrollbar-width: none"
						>
							{#each chunk(trending, 3) as group, gi}
								<div class="flex-shrink-0 w-[340px]">
									{#each group as app (app.id)}
										<a href="/apps/{app.id}" class="group block">
											<div
												class="flex items-center gap-3.5 py-3 border-b border-[var(--border-default)] last:border-b-0"
											>
												<img
													src={appIcon(app)}
													alt={app.name}
													width="40"
													height="40"
													class="rounded-[10px] flex-shrink-0"
												/>
												<div class="flex-1 min-w-0">
													<h3
														class="text-[13px] font-medium text-[var(--text-primary)] truncate"
													>
														{app.name}
													</h3>
													<p
														class="text-[11px] text-[var(--text-tertiary)] truncate"
													>
														{app.category}
													</p>
												</div>
												<button
													type="button"
													class="btn-subscribe flex-shrink-0"
													onclick={(e) => {
														e.preventDefault();
														e.stopPropagation();
														goto(`/apps/${app.id}?action=mine`);
													}}
												>
													Subscribe
												</button>
											</div>
										</a>
									{/each}
								</div>
							{/each}
						</div>
						<button
							type="button"
							onclick={() => scrollRow(trendingScrollRef, 'left')}
							class="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
						>
							<ChevronLeft
								class="h-4 w-4 text-[var(--text-secondary)]"
								strokeWidth={1.5}
							/>
						</button>
						<button
							type="button"
							onclick={() => scrollRow(trendingScrollRef, 'right')}
							class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
						>
							<ChevronRight
								class="h-4 w-4 text-[var(--text-secondary)]"
								strokeWidth={1.5}
							/>
						</button>
					</div>
				</div>
			</section>
		{/if}

		<!-- ─── Top Charts: Earning ─── -->
		<section>
			<div
				style="border-top: 1px solid var(--border-default); padding-top: 20px; margin-bottom: 12px"
			>
				<div
					style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px"
				>
					<h2
						style="font-size: 14px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.006em; margin: 0"
					>
						Top Earning
					</h2>
					<a
						href="/category"
						style="font-size: 12px; color: var(--text-accent); text-decoration: none; display: flex; align-items: center; gap: 2px"
					>
						See All
						<ChevronRight style="width: 12px; height: 12px" strokeWidth={1.5} />
					</a>
				</div>
				<div class="relative group/scroll">
					<div
						bind:this={topEarningScrollRef}
						class="flex gap-6 overflow-x-auto pb-1"
						style="scrollbar-width: none"
					>
						{#each topEarning as app, i (app.id)}
							<a href="/apps/{app.id}" class="group flex-shrink-0">
								<div class="flex items-center gap-3 w-[160px]">
									<span
										class="text-[20px] font-bold tabular-nums text-[var(--text-tertiary)] w-5 text-right"
									>
										{i + 1}
									</span>
									<img
										src={appIcon(app)}
										alt={app.name}
										width="48"
										height="48"
										class="rounded-[10px] flex-shrink-0"
									/>
									<div class="flex-1 min-w-0">
										<h3
											class="text-[13px] font-medium text-[var(--text-primary)] truncate"
										>
											{app.name}
										</h3>
										<p
											class="text-[11px] text-[var(--text-tertiary)] truncate"
										>
											{app.category}
										</p>
										<button
											type="button"
											class="btn-subscribe mt-1"
											onclick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												goto(`/apps/${app.id}?action=mine`);
											}}
										>
											Subscribe
										</button>
									</div>
								</div>
							</a>
						{/each}
					</div>
					<button
						type="button"
						onclick={() => scrollRow(topEarningScrollRef, 'left')}
						class="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
					>
						<ChevronLeft
							class="h-4 w-4 text-[var(--text-secondary)]"
							strokeWidth={1.5}
						/>
					</button>
					<button
						type="button"
						onclick={() => scrollRow(topEarningScrollRef, 'right')}
						class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
					>
						<ChevronRight
							class="h-4 w-4 text-[var(--text-secondary)]"
							strokeWidth={1.5}
						/>
					</button>
				</div>
			</div>
		</section>

		<!-- ─── Top Charts: Most Miners ─── -->
		<section>
			<div
				style="border-top: 1px solid var(--border-default); padding-top: 20px; margin-bottom: 12px"
			>
				<div
					style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px"
				>
					<h2
						style="font-size: 14px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.006em; margin: 0"
					>
						Most Miners
					</h2>
					<a
						href="/category"
						style="font-size: 12px; color: var(--text-accent); text-decoration: none; display: flex; align-items: center; gap: 2px"
					>
						See All
						<ChevronRight style="width: 12px; height: 12px" strokeWidth={1.5} />
					</a>
				</div>
				<div class="relative group/scroll">
					<div
						bind:this={topMinersScrollRef}
						class="flex gap-6 overflow-x-auto pb-1"
						style="scrollbar-width: none"
					>
						{#each topMiners as app, i (app.id)}
							<a href="/apps/{app.id}" class="group flex-shrink-0">
								<div class="flex items-center gap-3 w-[160px]">
									<span
										class="text-[20px] font-bold tabular-nums text-[var(--text-tertiary)] w-5 text-right"
									>
										{i + 1}
									</span>
									<img
										src={appIcon(app)}
										alt={app.name}
										width="48"
										height="48"
										class="rounded-[10px] flex-shrink-0"
									/>
									<div class="flex-1 min-w-0">
										<h3
											class="text-[13px] font-medium text-[var(--text-primary)] truncate"
										>
											{app.name}
										</h3>
										<p
											class="text-[11px] text-[var(--text-tertiary)] truncate"
										>
											{app.category}
										</p>
										<button
											type="button"
											class="btn-subscribe mt-1"
											onclick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												goto(`/apps/${app.id}?action=mine`);
											}}
										>
											Subscribe
										</button>
									</div>
								</div>
							</a>
						{/each}
					</div>
					<button
						type="button"
						onclick={() => scrollRow(topMinersScrollRef, 'left')}
						class="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
					>
						<ChevronLeft
							class="h-4 w-4 text-[var(--text-secondary)]"
							strokeWidth={1.5}
						/>
					</button>
					<button
						type="button"
						onclick={() => scrollRow(topMinersScrollRef, 'right')}
						class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
					>
						<ChevronRight
							class="h-4 w-4 text-[var(--text-secondary)]"
							strokeWidth={1.5}
						/>
					</button>
				</div>
			</div>
		</section>

		<!-- ─── Curated Collections ─── -->
		{#each curatedCollections as col (col.id)}
			{@const colAppIds = new Set(col.appIds)}
			{@const colApps = appsUniq.filter((a) => colAppIds.has(a.id)).slice(0, 6)}
			{#if colApps.length > 0}
				<section>
					<div
						style="border-top: 1px solid var(--border-default); padding-top: 20px; margin-bottom: 12px"
					>
						<div
							style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px"
						>
							<h2
								style="font-size: 14px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.006em; margin: 0"
							>
								{col.title}
							</h2>
							<a
								href="/category"
								style="font-size: 12px; color: var(--text-accent); text-decoration: none; display: flex; align-items: center; gap: 2px"
							>
								See All
								<ChevronRight
									style="width: 12px; height: 12px"
									strokeWidth={1.5}
								/>
							</a>
						</div>
						{#if col.description}
							<p
								style="font-size: 12px; color: var(--text-tertiary); margin: 0 0 12px; line-height: 16px"
							>
								{col.description}
							</p>
						{/if}
						<div
							style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px"
						>
							{#each colApps as app (app.id)}
								<a
									href="/apps/{app.id}"
									class="curated-card"
									style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; text-decoration: none; transition: all 100ms"
									onmouseenter={(e) => {
										const el = e.currentTarget as HTMLElement;
										el.style.borderColor = 'var(--border-hover)';
										el.style.background = 'var(--surface-2)';
									}}
									onmouseleave={(e) => {
										const el = e.currentTarget as HTMLElement;
										el.style.borderColor = 'var(--border-default)';
										el.style.background = 'var(--surface-1)';
									}}
								>
									<img
										src={appIcon(app)}
										alt={app.name}
										width="40"
										height="40"
										style="border-radius: 10px; flex-shrink: 0"
									/>
									<div style="flex: 1; min-width: 0">
										<p
											style="font-size: 13px; font-weight: 500; color: var(--text-primary); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
										>
											{app.name}
										</p>
										<p
											style="font-size: 11px; color: var(--text-tertiary); margin: 0"
										>
											{app.category} · ${app.avgEarningsPerDay.toFixed(0)}/day
										</p>
									</div>
									<div style="text-align: right; flex-shrink: 0">
										<p
											style="font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary); margin: 0; font-feature-settings: 'tnum' 1"
										>
											{app.totalMiners.toLocaleString()}
										</p>
										<p
											style="font-size: 10px; color: var(--text-tertiary); margin: 0"
										>
											miners
										</p>
									</div>
								</a>
							{/each}
						</div>
					</div>
				</section>
			{/if}
		{/each}
	</div>
</div>
