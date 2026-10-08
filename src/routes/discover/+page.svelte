<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronRight, ChevronLeft, Heart, Star } from 'lucide-svelte';
	import toast from 'svelte-french-toast';
	import { hub } from '$lib/api/hub';
	import { useQuery } from '$lib/api/query.svelte';
	import { errorMessage } from '$lib/api/http';
	import type { Collection, Project, ProjectSummary } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { me, preferences, toggleWatchlist } from '$lib/stores/account';
	import { categoryName, categoryShort, compactNumber, formatAmount, formatNumber, formatRating } from '$lib/format';
	import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import MinerOnboardingModal from '$lib/components/MinerOnboardingModal.svelte';

	/* ═══════════════════════════════════════════
	   HERO CAROUSEL constants
	   ═══════════════════════════════════════════ */

	const heroGradients = [
		{ from: '#1a0a2e', to: '#0d1b3e', accent: '#FFBF00' },
		{ from: '#0a1e0d', to: '#0d2b1a', accent: '#4CB782' },
		{ from: '#1e0a0a', to: '#2b1a0d', accent: '#FF8664' },
		{ from: '#0a0e1e', to: '#0d1a2b', accent: '#6E9FFF' }
	];

	/* ─── Story constants ─── */
	const storyColors = [
		{ bg: '#1a1428', accent: '#FFBF00' },
		{ bg: '#0f1e14', accent: '#4CB782' },
		{ bg: '#1e1410', accent: '#FF8664' },
		{ bg: '#101420', accent: '#6E9FFF' },
		{ bg: '#1a0f1e', accent: '#C084FC' }
	];

	const NEW_WINDOW_SECS = 14 * 86400;
	const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

	/* ─── Data (Hub API) ─── */
	const pool = useQuery(() => hub.projects({ sort: 'trending', limit: 100 }));
	const newestQ = useQuery(() => hub.projects({ sort: 'newest', limit: 9 }));
	const minersQ = useQuery(() => hub.projects({ sort: 'miners', limit: 9 }));
	const ratingQ = useQuery(() => hub.projects({ sort: 'rating', limit: 9 }));
	const earningsQ = useQuery(() => hub.projects({ sort: 'earnings', limit: 7 }));
	const collectionsQ = useQuery(() => hub.collections());
	const statsQ = useQuery(() => hub.explorerStats());

	const projects = $derived((pool.data?.items ?? []) as ProjectSummary[]);
	const byId = $derived.by(() => {
		const m = new Map<string, ProjectSummary>();
		for (const list of [projects, newestQ.data?.items, minersQ.data?.items, ratingQ.data?.items, earningsQ.data?.items]) {
			for (const p of (list ?? []) as ProjectSummary[]) m.set(p.project_id, p);
		}
		return m;
	});

	const isEmpty = $derived(pool.settled && !pool.error && projects.length === 0);

	// Hero: featured first, then trending order.
	const heroApps = $derived.by(() => {
		const featured = projects.filter((p) => p.featured);
		const rest = projects.filter((p) => !p.featured);
		return [...featured, ...rest].slice(0, 4);
	});
	const heroIds = $derived(new Set(heroApps.map((a) => a.project_id)));

	// Banners live on the full project (listing.banner); fetched only for the hero slides.
	const heroDetails = useQuery(() => {
		const ids = heroApps.map((p) => p.project_id);
		return Promise.all(ids.map((id) => hub.project(id).catch(() => null)));
	});
	const bannerById = $derived.by(() => {
		const m = new Map<string, string>();
		for (const p of (heroDetails.data ?? []) as (Project | null)[]) {
			const b = p?.listing?.banner;
			if (p && b && (b.startsWith('https://') || b.startsWith('/'))) m.set(p.project_id, b);
		}
		return m;
	});

	const storyApps = $derived(projects.filter((a) => !heroIds.has(a.project_id)).slice(0, 5));
	const bestNew = $derived((newestQ.data?.items ?? []) as ProjectSummary[]);
	const trending = $derived(projects.filter((p) => p.trending).slice(0, 9));
	const mostMined = $derived(((minersQ.data?.items ?? []) as ProjectSummary[]).filter((p) => (p.miners ?? 0) > 0));
	const topRated = $derived(
		((ratingQ.data?.items ?? []) as ProjectSummary[]).filter((p) => (p.review_count ?? 0) > 0 && p.average_rating_x100 != null)
	);
	const topEarning = $derived(
		((earningsQ.data?.items ?? []) as ProjectSummary[]).filter((p) => !!p.avg_daily_reward_per_miner && p.avg_daily_reward_per_miner !== '0')
	);

	const collections = $derived(((collectionsQ.data?.items ?? []) as Collection[]).slice(0, 5));

	const watchlist = $derived(new Set($preferences?.watchlist ?? []));

	function heroLabel(p: ProjectSummary): string {
		if (p.featured) return 'FEATURED PROJECT';
		if (p.trending) return 'TRENDING';
		if (p.listed_at && Date.now() / 1000 - p.listed_at < NEW_WINDOW_SECS) return 'NEW ON NECTER';
		return categoryName(p.category).toUpperCase();
	}

	function accentOf(p: ProjectSummary, i: number): string {
		return p.accent_color && HEX_COLOR.test(p.accent_color) ? p.accent_color : heroGradients[i % heroGradients.length].accent;
	}

	function rewardPerDay(p: ProjectSummary): string | null {
		if (!p.avg_daily_reward_per_miner || p.avg_daily_reward_per_miner === '0') return null;
		return `${formatAmount(p.avg_daily_reward_per_miner, p.token.decimals, { maxFrac: 2, compact: true })} ${p.token.symbol}/d`;
	}

	function subtitle(p: ProjectSummary): string {
		const r = rewardPerDay(p);
		if (r) return `${categoryShort(p.category)} · ${r}`;
		if (p.miners) return `${categoryShort(p.category)} · ${compactNumber(p.miners)} miners`;
		return categoryShort(p.category);
	}

	let pendingWatch = $state<string | null>(null);
	async function onWatch(id: string) {
		if (pendingWatch) return;
		pendingWatch = id;
		try {
			await toggleWatchlist(id);
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			pendingWatch = null;
		}
	}

	/* ─── State ─── */
	let heroActive = $state(0);
	let heroTimer: ReturnType<typeof setInterval> | null = null;
	let showOnboarding = $state(false);
	let hasAutoShown = false;

	/* ─── ScrollRow refs ─── */
	let storyScrollRef = $state<HTMLDivElement | null>(null);
	let topEarningScrollRef = $state<HTMLDivElement | null>(null);

	function scrollRow(ref: HTMLDivElement | null, dir: 'left' | 'right') {
		if (!ref) return;
		ref.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
	}

	/* ─── Hero carousel timer ─── */
	function resetHeroTimer() {
		if (heroTimer) clearInterval(heroTimer);
		heroTimer = setInterval(() => {
			if (heroApps.length > 0) heroActive = (heroActive + 1) % heroApps.length;
		}, 6000);
	}

	function heroGo(dir: 'prev' | 'next') {
		const count = heroApps.length;
		if (count === 0) return;
		heroActive = dir === 'next' ? (heroActive + 1) % count : (heroActive - 1 + count) % count;
		resetHeroTimer();
	}

	$effect(() => {
		if (heroActive >= heroApps.length) heroActive = 0;
	});

	onMount(() => {
		resetHeroTimer();

		// Listen for logo click event from sidebar
		const handler = () => (showOnboarding = true);
		window.addEventListener('necter:open-onboarding', handler);

		return () => {
			if (heroTimer) clearInterval(heroTimer);
			window.removeEventListener('necter:open-onboarding', handler);
		};
	});

	// Auto-show onboarding once per browser session for signed-in wallets with no devices and no subscriptions.
	$effect(() => {
		const m = $me;
		if (!m || hasAutoShown) return;
		if ((m.devices ?? 0) > 0 || (m.subscriptions ?? 0) > 0) return;
		hasAutoShown = true;
		let seen = false;
		try {
			seen = sessionStorage.getItem('necter_onboarding_seen') === '1';
			sessionStorage.setItem('necter_onboarding_seen', '1');
		} catch {
			/* storage unavailable */
		}
		if (!seen) showOnboarding = true;
	});
</script>

<svelte:head>
	<title>Discover — Necter Mining App Store</title>
</svelte:head>

{#snippet projectCard(app: ProjectSummary)}
	<div class="relative min-w-[260px] md:min-w-0 shrink-0 md:shrink">
		<a
			href="/apps/{app.project_id}"
			class="flex items-center gap-3 p-3 {$signedIn ? 'pr-10' : ''} rounded-[8px] bg-[var(--surface-1)] border border-[var(--border-default)] no-underline transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)]"
		>
			<ProjectIcon project={app} size={40} class="shrink-0" />
			<div class="flex-1 min-w-0">
				<p class="text-[13px] font-medium text-[var(--text-primary)] m-0 truncate">
					{app.name}
				</p>
				<p class="text-[11px] text-[var(--text-tertiary)] m-0 truncate">
					{subtitle(app)}
				</p>
			</div>
		</a>
		{#if $signedIn}
			{@const watched = watchlist.has(app.project_id)}
			<button
				type="button"
				aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
				aria-pressed={watched}
				disabled={pendingWatch === app.project_id}
				onclick={() => onWatch(app.project_id)}
				class="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center bg-transparent border-none cursor-pointer hover:bg-[var(--surface-3)] transition-colors disabled:opacity-50"
			>
				<Heart
					class="h-3.5 w-3.5 {watched ? 'text-[var(--accent-base)]' : 'text-[var(--text-tertiary)]'}"
					fill={watched ? 'var(--accent-base)' : 'none'}
					strokeWidth={1.8}
				/>
			</button>
		{/if}
	</div>
{/snippet}

{#snippet sectionHeader(title: string, href: string | null, description?: string | null)}
	<div class="flex items-baseline justify-between" style="margin-bottom: {description ? '4px' : '12px'}">
		<h2 class="text-[15px] md:text-[16px] font-semibold text-[var(--text-primary)] m-0 tracking-[-0.006em]">
			{title}
		</h2>
		{#if href}
			<a href={href} class="text-[12px] text-[var(--text-accent)] no-underline flex items-center gap-[2px]">
				See All <ChevronRight class="w-3 h-3" strokeWidth={1.5} />
			</a>
		{/if}
	</div>
	{#if description}
		<p class="text-[12px] text-[var(--text-tertiary)] m-0 mb-3 leading-4">{description}</p>
	{/if}
{/snippet}

<div class="min-h-screen pb-12 animate-fadeIn">
	{#if pool.loading && !pool.data}
		<div class="px-4 md:px-6 pt-4">
			<div class="h-[280px] md:h-[420px] rounded-[10px] bg-[var(--surface-1)] border border-[var(--border-default)] animate-pulse"></div>
			<div class="mt-4"><LoadingBlock rows={3} grid height="64px" /></div>
		</div>
	{:else if pool.error}
		<div class="px-4 md:px-6 pt-6">
			<ErrorState error={pool.error} retry={() => pool.refresh()} />
		</div>
	{:else if isEmpty}
		<!-- ═══ EMPTY HERO — no listed projects yet ═══ -->
		<div class="relative w-full overflow-hidden border-b border-[var(--border-default)]">
			<div class="absolute inset-0" style="background: linear-gradient(135deg, #17120a 0%, #0c0c0e 55%, #0d1018 100%)"></div>
			<div class="absolute inset-0 bg-honeycomb opacity-60 z-[1] pointer-events-none"></div>
			<div
				class="absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full z-[1] pointer-events-none"
				style="background: var(--accent-glow); filter: blur(90px); opacity: 0.35"
			></div>

			<div class="relative z-10 px-4 md:px-8 py-10 md:py-16 flex flex-col md:flex-row items-center gap-8 md:gap-12 max-w-[1100px] mx-auto">
				<div class="flex-1 min-w-0 text-center md:text-left">
					<p class="text-[10px] font-bold uppercase tracking-[0.1em] mb-3 text-[var(--text-accent)]">Necter testnet</p>
					<h1 class="text-[22px] md:text-[30px] font-semibold text-white leading-tight mb-3 max-w-[520px] mx-auto md:mx-0">
						The first Necter projects are on their way
					</h1>
					<p class="text-[13px] md:text-[14px] text-white/60 max-w-[480px] leading-6 mx-auto md:mx-0">
						Developers publish deterministic workloads, miners run them on their devices and earn per verified round.
						Publish the first project, or get your device ready so you can start mining the moment one is listed.
					</p>
					<div class="flex flex-wrap gap-2 mt-6 justify-center md:justify-start">
						<a
							href="/develop"
							class="inline-flex items-center h-10 px-5 rounded-[6px] bg-[var(--accent-base)] hover:bg-[var(--accent-hover)] text-[#0C0C0E] text-[13px] font-semibold no-underline transition-colors"
							>Publish a project</a
						>
						<a
							href="/mining/hardware-checker"
							class="inline-flex items-center h-10 px-5 rounded-[6px] border border-white/15 bg-black/30 hover:bg-black/50 text-white text-[13px] font-medium no-underline backdrop-blur-sm transition-colors"
							>Install the miner</a
						>
					</div>

					{#if statsQ.data}
						<div class="grid grid-cols-3 gap-2 mt-8 max-w-[440px] mx-auto md:mx-0">
							{#each [
								{ label: 'Projects listed', value: formatNumber(statsQ.data.projects_listed ?? 0) },
								{ label: 'Miners online', value: formatNumber(statsQ.data.miners_online ?? 0) },
								{ label: 'Rounds (24h)', value: formatNumber(statsQ.data.rounds_24h ?? 0) }
							] as s (s.label)}
								<div class="rounded-[8px] bg-black/30 border border-white/10 px-3 py-2.5 backdrop-blur-sm">
									<p class="text-[16px] font-semibold text-white font-mono tabular-nums m-0">{s.value}</p>
									<p class="text-[10px] text-white/50 uppercase tracking-[0.04em] m-0 mt-0.5">{s.label}</p>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				<div class="relative w-[220px] md:w-[320px] shrink-0" aria-hidden="true">
					<div class="absolute inset-[15%] rounded-full" style="background: var(--accent-glow); filter: blur(40px); opacity: 0.6"></div>
					<img
						src="/brand/3d/mining-platform.png"
						alt=""
						class="relative w-full h-auto object-contain"
						style="filter: drop-shadow(0 18px 40px rgba(255, 201, 51, 0.18))"
					/>
				</div>
			</div>
		</div>
	{:else}
		<!-- ═══ HERO CAROUSEL (full-width, auto-rotating) ═══ -->
		{#if heroApps.length > 0}
			{@const app = heroApps[Math.min(heroActive, heroApps.length - 1)]}
			<div class="relative w-full overflow-hidden">
				<!-- Background layers -->
				{#each heroApps as a, i (a.project_id)}
					{@const img = bannerById.get(a.project_id)}
					{@const g = heroGradients[i % heroGradients.length]}
					<div class="absolute inset-0 transition-opacity duration-700 {i === heroActive ? 'opacity-100' : 'opacity-0'}">
						{#if img}
							<div class="absolute inset-0 bg-cover bg-center" style="background-image: url({img})"></div>
							<div class="absolute inset-0 bg-black/40"></div>
						{:else}
							<div class="absolute inset-0" style="background: linear-gradient(135deg, {g.from}, {g.to})"></div>
							<div class="absolute right-[8%] top-1/2 -translate-y-[65%] hidden md:block">
								<ProjectIcon project={a} size={160} rounded="36px" class="opacity-90 shadow-2xl" />
							</div>
						{/if}
					</div>
				{/each}

				<!-- Honeycomb overlay -->
				<div class="absolute inset-0 bg-honeycomb opacity-60 z-[1] pointer-events-none"></div>
				<!-- Bottom gradient for text readability -->
				<div
					class="absolute inset-x-0 bottom-0 h-[60%] z-[2] pointer-events-none"
					style="background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)"
				></div>

				<!-- Content — text at bottom-left -->
				<a
					href="/apps/{app.project_id}"
					class="relative z-10 flex flex-col justify-end px-4 md:px-8 pb-8 md:pb-10 pt-[280px] md:pt-[420px] no-underline cursor-pointer"
				>
					{#each heroApps as a, i (a.project_id)}
						<div
							class="absolute bottom-8 md:bottom-8 left-4 md:left-8 right-4 md:right-8 transition-all duration-500 {i === heroActive
								? 'opacity-100 translate-y-0'
								: 'opacity-0 translate-y-2 pointer-events-none'}"
						>
							<p
								class="text-[10px] font-bold uppercase tracking-[0.1em] mb-2 transition-colors duration-500"
								style="color: {accentOf(a, i)}"
							>
								{heroLabel(a)}
							</p>
							<h2 class="text-[18px] md:text-[22px] font-semibold text-white leading-tight mb-2 max-w-[500px]">
								{a.name}
							</h2>
							{#if a.tagline}
								<p class="text-[12px] md:text-[14px] text-white/60 max-w-[500px] line-clamp-2">
									{a.tagline}
								</p>
							{/if}
						</div>
					{/each}
				</a>

				{#if heroApps.length > 1}
					<!-- Navigation arrows -->
					<button
						type="button"
						aria-label="Previous"
						onclick={() => heroGo('prev')}
						class="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/30 backdrop-blur-sm items-center justify-center hover:bg-black/50 transition-colors"
					>
						<ChevronLeft class="h-5 w-5 text-white/80" strokeWidth={1.5} />
					</button>
					<button
						type="button"
						aria-label="Next"
						onclick={() => heroGo('next')}
						class="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/30 backdrop-blur-sm items-center justify-center hover:bg-black/50 transition-colors"
					>
						<ChevronRight class="h-5 w-5 text-white/80" strokeWidth={1.5} />
					</button>

					<!-- Dots indicator -->
					<div class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
						{#each heroApps as a, i (a.project_id)}
							<button
								type="button"
								aria-label="Show {a.name}"
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
				{/if}
			</div>
		{/if}

		<!-- ═══ EDITORIAL CONTENT ═══ -->

		<!-- Story cards -->
		{#if storyApps.length > 0}
			<div class="px-4 md:px-6 pt-3">
				<div class="relative group/scroll">
					<div bind:this={storyScrollRef} class="flex gap-4 md:gap-6 overflow-x-auto pb-1 [scrollbar-width:none]">
						{#each storyApps as app, i (app.project_id)}
							{@const colors = storyColors[i % storyColors.length]}
							<a href="/apps/{app.project_id}" class="group block flex-shrink-0 w-[240px] md:w-[280px] rounded-[10px]">
								<!-- Image area -->
								<div
									class="h-[158px] rounded-t-[10px] relative overflow-hidden"
									style="background: linear-gradient(160deg, {colors.bg}, {colors.bg}dd)"
								>
									<!-- Decorative accent circles -->
									<div class="absolute -right-8 -bottom-8 w-[120px] h-[120px] rounded-full opacity-20" style="background: {accentOf(app, i)}"></div>
									<div class="absolute -left-4 -top-4 w-[60px] h-[60px] rounded-full opacity-10" style="background: {accentOf(app, i)}"></div>
									<div class="absolute inset-0 flex items-center justify-center">
										<ProjectIcon project={app} size={64} rounded="14px" />
									</div>
								</div>
								<!-- Text below image -->
								<div class="pt-2.5 pb-1">
									<p class="text-[10px] font-bold uppercase tracking-[0.06em] mb-0.5" style="color: {colors.accent}">
										{app.trending ? 'Trending' : categoryShort(app.category)}
									</p>
									<h3 class="text-[14px] font-semibold text-[var(--text-primary)] leading-tight line-clamp-1">
										{app.name}
									</h3>
									<p class="text-[12px] text-[var(--text-tertiary)] line-clamp-1 mt-0.5">
										{app.tagline ?? (app.developer_name ? `by ${app.developer_name}` : categoryName(app.category))}
									</p>
								</div>
							</a>
						{/each}
					</div>
					<button
						type="button"
						aria-label="Scroll left"
						onclick={() => scrollRow(storyScrollRef, 'left')}
						class="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
					>
						<ChevronLeft class="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
					</button>
					<button
						type="button"
						aria-label="Scroll right"
						onclick={() => scrollRow(storyScrollRef, 'right')}
						class="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
					>
						<ChevronRight class="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
					</button>
				</div>
			</div>
		{/if}

		<div class="px-4 md:px-6 space-y-0 {storyApps.length === 0 ? 'pt-3' : ''}">
			<!-- ─── Best New Projects ─── -->
			{#if bestNew.length > 0}
				<section>
					<div class="border-t border-[var(--border-default)] pt-5 mb-3">
						{@render sectionHeader('Best New Projects', '/category')}
						<div class="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:overflow-visible">
							{#each bestNew as app (app.project_id)}
								{@render projectCard(app)}
							{/each}
						</div>
					</div>
				</section>
			{/if}

			<!-- ─── Trending Now ─── -->
			{#if trending.length > 0}
				<section>
					<div class="border-t border-[var(--border-default)] pt-5 mb-3">
						{@render sectionHeader('Trending Now', '/leaderboards')}
						<div class="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:overflow-visible">
							{#each trending as app (app.project_id)}
								{@render projectCard(app)}
							{/each}
						</div>
					</div>
				</section>
			{/if}

			<!-- ─── Curated Collections ─── -->
			{#each collections as col (col.id)}
				{@const colApps = col.project_ids
					.map((pid) => byId.get(pid))
					.filter((p): p is ProjectSummary => !!p)
					.slice(0, 6)}
				{#if colApps.length > 0}
					<section>
						<div class="border-t border-[var(--border-default)] pt-5 mb-3">
							{@render sectionHeader(col.title, null, col.description)}
							<div class="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:overflow-visible">
								{#each colApps as app (app.project_id)}
									{@render projectCard(app)}
								{/each}
							</div>
						</div>
					</section>
				{/if}
			{/each}

			<!-- ─── Most Mined ─── -->
			{#if mostMined.length > 0}
				<section>
					<div class="border-t border-[var(--border-default)] pt-5 mb-3">
						{@render sectionHeader('Most Mined', '/leaderboards')}
						<div class="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:overflow-visible">
							{#each mostMined as app (app.project_id)}
								{@render projectCard(app)}
							{/each}
						</div>
					</div>
				</section>
			{/if}

			<!-- ─── Top Rated ─── -->
			{#if topRated.length > 0}
				<section>
					<div class="border-t border-[var(--border-default)] pt-5 mb-3">
						{@render sectionHeader('Top Rated', null)}
						<div class="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:overflow-visible">
							{#each topRated as app (app.project_id)}
								<div class="relative min-w-[260px] md:min-w-0 shrink-0 md:shrink">
									<a
										href="/apps/{app.project_id}"
										class="flex items-center gap-3 p-3 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border-default)] no-underline transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)]"
									>
										<ProjectIcon project={app} size={40} class="shrink-0" />
										<div class="flex-1 min-w-0">
											<p class="text-[13px] font-medium text-[var(--text-primary)] m-0 truncate">{app.name}</p>
											<p class="text-[11px] text-[var(--text-tertiary)] m-0 flex items-center gap-1">
												<Star size={10} strokeWidth={0} fill="var(--accent-base)" />
												<span class="font-mono">{formatRating(app.average_rating_x100)}</span>
												<span>· {formatNumber(app.review_count ?? 0)} review{app.review_count === 1 ? '' : 's'}</span>
											</p>
										</div>
									</a>
								</div>
							{/each}
						</div>
					</div>
				</section>
			{/if}

			<!-- ─── Top Earning ─── -->
			{#if topEarning.length > 0}
				<section>
					<div class="border-t border-[var(--border-default)] pt-5 mb-3">
						{@render sectionHeader('Top Earning', '/leaderboards')}
						<div class="relative group/scroll">
							<div bind:this={topEarningScrollRef} class="flex gap-4 md:gap-6 overflow-x-auto pb-1 [scrollbar-width:none]">
								{#each topEarning as app, i (app.project_id)}
									<a href="/apps/{app.project_id}" class="group flex-shrink-0 no-underline">
										<div class="flex items-center gap-3 w-[180px] md:w-[200px]">
											<span class="text-[18px] font-bold tabular-nums text-[var(--text-tertiary)] w-5 text-right flex-shrink-0">
												{i + 1}
											</span>
											<ProjectIcon project={app} size={48} class="flex-shrink-0" />
											<div class="flex-1 min-w-0">
												<h3 class="text-[13px] font-medium text-[var(--text-primary)] truncate">
													{app.name}
												</h3>
												<p class="text-[11px] text-[var(--text-tertiary)] truncate">
													{categoryShort(app.category)}
												</p>
												<p class="text-[11px] font-mono text-[var(--text-accent)] mt-0.5 truncate" title="Recent average per miner">
													{rewardPerDay(app)}
												</p>
											</div>
										</div>
									</a>
								{/each}
							</div>
							<button
								type="button"
								aria-label="Scroll left"
								onclick={() => scrollRow(topEarningScrollRef, 'left')}
								class="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
							>
								<ChevronLeft class="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
							</button>
							<button
								type="button"
								aria-label="Scroll right"
								onclick={() => scrollRow(topEarningScrollRef, 'right')}
								class="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
							>
								<ChevronRight class="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
							</button>
						</div>
					</div>
				</section>
			{/if}
		</div>
	{/if}
</div>

<!-- Miner onboarding modal -->
<MinerOnboardingModal open={showOnboarding} onClose={() => (showOnboarding = false)} />
