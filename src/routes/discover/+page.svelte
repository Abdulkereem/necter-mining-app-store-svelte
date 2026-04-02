<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor } from '$lib/stores/wallet';
	import { getAppIcon } from '$lib/app-icon';
	import { ChevronRight, ChevronLeft } from 'lucide-svelte';
	import MinerOnboardingModal from '$lib/components/MinerOnboardingModal.svelte';
	import type { App } from '$lib/types';

	/* ─── Helper ─── */
	function appIcon(app: App): string {
		return getAppIcon(app);
	}

	/* ═══════════════════════════════════════════
	   HERO CAROUSEL constants
	   ═══════════════════════════════════════════ */

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
		'Polkadot': '/screenshots/polkadot-hero.webp',
		'Grass': '/screenshots/grass-1.png',
		'Bittensor': '/screenshots/bittensor-1.png',
		'Ocean Protocol': '/screenshots/ocean-1.png',
		'Storj': '/screenshots/storj-1.webp',
		'Golem Network': '/screenshots/golem-1.png',
		'Livepeer Network': '/screenshots/livepeer-1.png',
		'Arweave': '/screenshots/arweave-1.jpg',
		'DockHive': '/screenshots/dockhive-hero.png',
		'TIWA': '/screenshots/tiwa-hero.png',
		'Bitcoin': '/screenshots/bitcoin-hero.jpg',
		'Ethereum': '/screenshots/ethereum-hero.jpg',
		'Theta Network': '/screenshots/theta-1.jpg',
		'0x Protocol': '/screenshots/0x-1.jpg'
	};

	const heroLabels = ['FEATURED PROJECT', "EDITORS' CHOICE", 'NEW & NOTEWORTHY', 'TRENDING'];

	const heroTitles = [
		(name: string) => `${name}, the #1 mining project`,
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
		'PROJECTS WE LOVE',
		'MAJOR UPDATE',
		'GET STARTED',
		'BEHIND THE PROJECT',
		"EDITORS' PICK"
	];

	const storyTitles = [
		(name: string) => `Earn passive income with ${name}`,
		(name: string) => `${name} 2.0 is here`,
		(name: string) => `New to mining? Try ${name}`,
		(name: string) => `How ${name} verifies proofs`,
		(name: string) => `Why ${name} stands out`
	];

	/* ─── State ─── */
	let heroActive = $state(0);
	let heroTimer: ReturnType<typeof setInterval> | null = $state(null);
	let showOnboarding = $state(false);
	let hasAutoShown = $state(false);

	/* ─── ScrollRow refs ─── */
	let storyScrollRef = $state<HTMLDivElement | null>(null);
	let topEarningScrollRef = $state<HTMLDivElement | null>(null);

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

	// Hero carousel — prioritize DockHive + TIWA + Atum, fill rest by reputation
	const heroApps = $derived.by(() => {
		const priorityNames = new Set(['DockHive', 'TIWA', 'Atum']);
		const priority = appsUniq.filter((a) => priorityNames.has(a.name));
		const rest = [...appsUniq]
			.filter((a) => !priorityNames.has(a.name))
			.sort((a, b) => b.reputationScore - a.reputationScore);
		return [...priority, ...rest].slice(0, 4);
	});
	const heroIds = $derived(new Set(heroApps.map((a) => a.id)));

	// Story cards — featured apps below hero, prioritize DockHive/Atum/TIWA
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

	// Best new projects
	const bestNew = $derived(
		[...appsUniq]
			.filter((a) => !heroIds.has(a.id) && !storyIds.has(a.id))
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 9)
	);
	const bestNewIds = $derived(new Set(bestNew.map((a) => a.id)));

	// Trending — inline selector
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

	// Curated collections
	const curatedCollections = $derived(backend.listCuratedCollections());

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

<svelte:head>
	<title>Discover — Necter Mining App Store</title>
</svelte:head>

<div class="min-h-screen pb-12 animate-fadeIn">
	<!-- ═══ HERO CAROUSEL (full-width, auto-rotating) ═══ -->
	{#if heroApps.length > 0}
		{@const app = heroApps[heroActive]}
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
						<div class="absolute inset-0 bg-black/40"></div>
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
			<!-- Bottom gradient for text readability -->
			<div
				class="absolute inset-x-0 bottom-0 h-[60%] z-[2] pointer-events-none"
				style="background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)"
			></div>

			<!-- Content — text at bottom-left -->
			<a
				href="/apps/{app.id}"
				class="relative z-10 flex flex-col justify-end px-4 md:px-8 pb-8 md:pb-10 pt-[280px] md:pt-[420px] no-underline cursor-pointer"
			>
				{#each heroApps as a, i (a.id)}
					<div
						class="absolute bottom-8 md:bottom-8 left-4 md:left-8 right-4 md:right-8 transition-all duration-500 {i === heroActive
							? 'opacity-100 translate-y-0'
							: 'opacity-0 translate-y-2 pointer-events-none'}"
					>
						<p
							class="text-[10px] font-bold uppercase tracking-[0.1em] mb-2 transition-colors duration-500"
							style="color: {heroGradients[i % heroGradients.length].accent}"
						>
							{heroLabels[i % heroLabels.length]}
						</p>
						<h2
							class="text-[18px] md:text-[22px] font-semibold text-white leading-tight mb-2 max-w-[500px]"
						>
							{heroTitles[i % heroTitles.length](a.name)}
						</h2>
						<p class="text-[12px] md:text-[14px] text-white/60 max-w-[500px] line-clamp-2">
							{a.description}
						</p>
					</div>
				{/each}
			</a>

			<!-- Navigation arrows -->
			<button
				type="button"
				onclick={() => heroGo('prev')}
				class="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/30 backdrop-blur-sm items-center justify-center hover:bg-black/50 transition-colors"
			>
				<ChevronLeft class="h-5 w-5 text-white/80" strokeWidth={1.5} />
			</button>
			<button
				type="button"
				onclick={() => heroGo('next')}
				class="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/30 backdrop-blur-sm items-center justify-center hover:bg-black/50 transition-colors"
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

	<!-- ═══ EDITORIAL CONTENT ═══ -->

	<!-- Story cards -->
	<div class="px-4 md:px-6 pt-3">
		<div class="relative group/scroll">
			<div
				bind:this={storyScrollRef}
				class="flex gap-4 md:gap-6 overflow-x-auto pb-1 [scrollbar-width:none]"
			>
				{#each storyApps as app, i (app.id)}
					{@const colors = storyColors[i % storyColors.length]}
					{@const storyLabel = storyLabels[i % storyLabels.length]}
					{@const bgImg = heroImages[app.name] ?? null}
					<a
						href="/apps/{app.id}"
						class="group block flex-shrink-0 w-[240px] md:w-[280px] rounded-[10px]"
					>
						<!-- Image area -->
						<div
							class="h-[158px] rounded-t-[10px] relative overflow-hidden"
							style={bgImg ? undefined : `background: linear-gradient(160deg, ${colors.bg}, ${colors.bg}dd)`}
						>
							{#if bgImg}
								<img src={bgImg} alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy" />
							{:else}
								<!-- Decorative accent circles -->
								<div
									class="absolute -right-8 -bottom-8 w-[120px] h-[120px] rounded-full opacity-20"
									style="background: {colors.accent}"
								></div>
								<div
									class="absolute -left-4 -top-4 w-[60px] h-[60px] rounded-full opacity-10"
									style="background: {colors.accent}"
								></div>
								<!-- App icon centered — only when no background image -->
								<div class="absolute inset-0 flex items-center justify-center">
									<img
										src={appIcon(app)}
										alt={app.name}
										width="64"
										height="64"
										class="rounded-[14px]"
										loading="lazy"
									/>
								</div>
							{/if}
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
				class="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
			>
				<ChevronLeft class="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
			</button>
			<button
				type="button"
				onclick={() => scrollRow(storyScrollRef, 'right')}
				class="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
			>
				<ChevronRight class="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
			</button>
		</div>
	</div>

	<div class="px-4 md:px-6 space-y-0">
		<!-- ─── Best New Projects ─── -->
		{#if bestNew.length > 0}
			<section>
				<div
					class="border-t border-[var(--border-default)] pt-5 mb-3"
				>
					<div
						class="flex items-baseline justify-between mb-3"
					>
						<h2
							class="text-[15px] md:text-[16px] font-semibold text-[var(--text-primary)] m-0 tracking-[-0.006em]"
						>
							Best New Projects
						</h2>
						<a
							href="/category"
							class="text-[12px] text-[var(--text-accent)] no-underline flex items-center gap-[2px]"
						>
							See All <ChevronRight class="w-3 h-3" strokeWidth={1.5} />
						</a>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-2">
						{#each bestNew as app (app.id)}
							<a
								href="/apps/{app.id}"
								class="flex items-center gap-3 p-3 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border-default)] no-underline transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)]"
							>
								<img
									src={appIcon(app)}
									alt={app.name}
									width="40"
									height="40"
									class="rounded-[10px] shrink-0"
									loading="lazy"
								/>
								<div class="flex-1 min-w-0">
									<p class="text-[13px] font-medium text-[var(--text-primary)] m-0 truncate">
										{app.name}
									</p>
									<p class="text-[11px] text-[var(--text-tertiary)] m-0">
										{app.category} · ${app.avgEarningsPerDay.toFixed(0)}/d
									</p>
								</div>
							</a>
						{/each}
					</div>
				</div>
			</section>
		{/if}

		<!-- ─── Trending Now ─── -->
		{#if trending.length > 0}
			<section>
				<div
					class="border-t border-[var(--border-default)] pt-5 mb-3"
				>
					<div
						class="flex items-baseline justify-between mb-3"
					>
						<h2
							class="text-[15px] md:text-[16px] font-semibold text-[var(--text-primary)] m-0 tracking-[-0.006em]"
						>
							Trending Now
						</h2>
						<a
							href="/leaderboards"
							class="text-[12px] text-[var(--text-accent)] no-underline flex items-center gap-[2px]"
						>
							See All <ChevronRight class="w-3 h-3" strokeWidth={1.5} />
						</a>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-2">
						{#each trending as app (app.id)}
							<a
								href="/apps/{app.id}"
								class="flex items-center gap-3 p-3 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border-default)] no-underline transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)]"
							>
								<img
									src={appIcon(app)}
									alt={app.name}
									width="40"
									height="40"
									class="rounded-[10px] shrink-0"
									loading="lazy"
								/>
								<div class="flex-1 min-w-0">
									<p class="text-[13px] font-medium text-[var(--text-primary)] m-0 truncate">
										{app.name}
									</p>
									<p class="text-[11px] text-[var(--text-tertiary)] m-0">
										{app.category} · ${app.avgEarningsPerDay.toFixed(0)}/d
									</p>
								</div>
							</a>
						{/each}
					</div>
				</div>
			</section>
		{/if}

		<!-- ─── Curated Collections ─── -->
		{#each curatedCollections.slice(0, 5) as col (col.id)}
			{@const colAppIds = new Set(col.appIds)}
			{@const colApps = appsUniq.filter((a) => colAppIds.has(a.id)).slice(0, 6)}
			{#if colApps.length > 0}
				<section>
					<div
						class="border-t border-[var(--border-default)] pt-5 mb-3"
					>
						<div
							class="flex items-baseline justify-between"
							style="margin-bottom: {col.description ? '4px' : '12px'}"
						>
							<h2
								class="text-[15px] md:text-[16px] font-semibold text-[var(--text-primary)] m-0 tracking-[-0.006em]"
							>
								{col.title}
							</h2>
							<a
								href="/category"
								class="text-[12px] text-[var(--text-accent)] no-underline flex items-center gap-[2px]"
							>
								See All <ChevronRight class="w-3 h-3" strokeWidth={1.5} />
							</a>
						</div>
						{#if col.description}
							<p
								class="text-[12px] text-[var(--text-tertiary)] m-0 mb-3 leading-4"
							>
								{col.description}
							</p>
						{/if}
						<div class="grid grid-cols-1 md:grid-cols-3 gap-2">
							{#each colApps as app (app.id)}
								<a
									href="/apps/{app.id}"
									class="flex items-center gap-3 p-3 rounded-[8px] bg-[var(--surface-1)] border border-[var(--border-default)] no-underline transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)]"
								>
									<img
										src={appIcon(app)}
										alt={app.name}
										width="40"
										height="40"
										class="rounded-[10px] shrink-0"
										loading="lazy"
									/>
									<div class="flex-1 min-w-0">
										<p class="text-[13px] font-medium text-[var(--text-primary)] m-0 truncate">
											{app.name}
										</p>
										<p class="text-[11px] text-[var(--text-tertiary)] m-0">
											{app.category} · ${app.avgEarningsPerDay.toFixed(0)}/d
										</p>
									</div>
								</a>
							{/each}
						</div>
					</div>
				</section>
			{/if}
		{/each}

		<!-- ─── Top Earning ─── -->
		{#if topEarning.length > 0}
			<section>
				<div
					class="border-t border-[var(--border-default)] pt-5 mb-3"
				>
					<div
						class="flex items-baseline justify-between mb-3"
					>
						<h2
							class="text-[15px] md:text-[16px] font-semibold text-[var(--text-primary)] m-0 tracking-[-0.006em]"
						>
							Top Earning
						</h2>
						<a
							href="/leaderboards"
							class="text-[12px] text-[var(--text-accent)] no-underline flex items-center gap-[2px]"
						>
							See All <ChevronRight class="w-3 h-3" strokeWidth={1.5} />
						</a>
					</div>
					<div class="relative group/scroll">
						<div
							bind:this={topEarningScrollRef}
							class="flex gap-4 md:gap-6 overflow-x-auto pb-1 [scrollbar-width:none]"
						>
							{#each topEarning as app, i (app.id)}
								<a href="/apps/{app.id}" class="group flex-shrink-0 no-underline">
									<div class="flex items-center gap-3 w-[180px] md:w-[200px]">
										<span
											class="text-[18px] font-bold tabular-nums text-[var(--text-tertiary)] w-5 text-right flex-shrink-0"
										>
											{i + 1}
										</span>
										<img
											src={appIcon(app)}
											alt={app.name}
											width="48"
											height="48"
											class="rounded-[10px] flex-shrink-0"
											loading="lazy"
										/>
										<div class="flex-1 min-w-0">
											<h3
												class="text-[13px] font-medium text-[var(--text-primary)] truncate"
											>
												{app.name}
											</h3>
											<p class="text-[11px] text-[var(--text-tertiary)] truncate">
												{app.category}
											</p>
											<p
												class="text-[11px] font-mono text-[var(--text-accent)] mt-0.5"
											>
												${app.avgEarningsPerDay.toFixed(0)}/d
											</p>
										</div>
									</div>
								</a>
							{/each}
						</div>
						<button
							type="button"
							onclick={() => scrollRow(topEarningScrollRef, 'left')}
							class="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
						>
							<ChevronLeft
								class="h-4 w-4 text-[var(--text-secondary)]"
								strokeWidth={1.5}
							/>
						</button>
						<button
							type="button"
							onclick={() => scrollRow(topEarningScrollRef, 'right')}
							class="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-default)] items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-150 z-10"
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
	</div>
</div>

<!-- Miner onboarding modal -->
<MinerOnboardingModal open={showOnboarding} onClose={() => showOnboarding = false} />
