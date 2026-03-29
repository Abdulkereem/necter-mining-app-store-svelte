<script lang="ts">
	import { page } from '$app/stores';
	import { backendState, backend } from '$lib/stores/backend';
	import { appIconDataUri } from '$lib/app-icon';
	import { Flame, Award } from 'lucide-svelte';
	import type { App } from '$lib/types';

	/* ─── Helper ─── */
	function appIcon(app: App): string {
		return app.icon && app.icon !== '/placeholder.svg'
			? app.icon
			: appIconDataUri({ id: app.id, name: app.name, category: app.category });
	}

	/* ─── Category map ─── */
	const categoryMap: Record<string, string> = {
		depin: 'DePIN',
		ai: 'AI/ML',
		iot: 'IoT',
		'data-sovereignty': 'Data Sovereignty',
		storage: 'Storage',
		compute: 'Compute',
		blockchain: 'Blockchain',
		'content-delivery': 'Content Delivery',
		bandwidth: 'Bandwidth',
		'hardware-staking': 'Hardware Staking'
	};

	/* ─── Derived data ─── */
	const slug = $derived($page.params.slug);
	const category = $derived(categoryMap[slug] ?? null);

	const apps = $derived.by(() => {
		const all = backend.listApps();
		return all.filter((a) => (category ? a.category === category : false));
	});

	const curated = $derived(backend.listCuratedCollections());

	// Trending: inline simplified selector (mirrors discover page approach)
	const trendingIds = $derived.by(() => {
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
		for (const app of apps) {
			const miners = activeMinersByAppId.get(app.id) ?? 0;
			const verified = verified24hByAppId.get(app.id) ?? 0;
			const score = miners * 2 + verified * 3 + app.reputationScore * 0.5;
			signals.push({ appId: app.id, score });
		}
		signals.sort((a, b) => b.score - a.score);

		const ids = new Set<string>();
		for (const s of signals.slice(0, 12)) ids.add(s.appId);
		return ids;
	});

	const daoPickIds = $derived.by(() => {
		const ids = new Set<string>();
		for (const c of curated) {
			if (c.kind === 'dao_curated') {
				for (const id of c.appIds) ids.add(id);
			}
		}
		return ids;
	});

	const editorsPickIds = $derived.by(() => {
		const ids = new Set<string>();
		for (const c of curated) {
			if (c.kind === 'editors_picks') {
				for (const id of c.appIds) ids.add(id);
			}
		}
		return ids;
	});

	const verifiedDevByAddress = $derived.by(() => {
		const map = new Map<string, boolean>();
		const recs = ($backendState as any).developerVerificationByAddress ?? {};
		for (const [addr, rec] of Object.entries(recs)) {
			map.set(String(addr), (rec as any)?.status === 'verified');
		}
		return map;
	});
</script>

{#if apps.length === 0}
	<div class="min-h-screen pb-12">
		<div class="border-b border-[var(--border-default)]">
			<div class="max-w-6xl mx-auto px-6 py-8">
				<div class="flex items-center gap-2">
					<h1 class="text-[20px] font-semibold">{category ?? 'Category'}</h1>
					<span
						class="inline-flex items-center px-2 py-0.5 rounded border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)]"
						>{slug}</span
					>
				</div>
				<p class="text-[var(--text-secondary)] mt-2">No apps found for this category yet.</p>
			</div>
		</div>
		<div class="text-center bg-honeycomb-subtle">
			<svg
				class="mx-auto mt-8 mb-2"
				width="64"
				height="56"
				viewBox="0 0 64 56"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				style="opacity: 0.08"
			>
				<path d="M16 8L22 2L28 8L22 14L16 8Z" fill="currentColor" />
				<path d="M28 20L34 14L40 20L34 26L28 20Z" fill="currentColor" />
				<path d="M4 20L10 14L16 20L10 26L4 20Z" fill="currentColor" />
			</svg>
			<div class="max-w-6xl mx-auto px-6 py-12">
				<p class="text-[var(--text-primary)]/60">
					Check back soon for new mining apps in this category.
				</p>
				<div class="mt-4">
					<a href="/discover" class="text-primary hover:underline">Back to Discover</a>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="min-h-screen pb-12">
		<div class="border-b border-[var(--border-default)]">
			<div class="max-w-6xl mx-auto px-6 py-8">
				<div class="flex items-center justify-between gap-4">
					<div>
						<h1 class="text-[20px] font-semibold">{category}</h1>
						<p class="text-[var(--text-secondary)] mt-1">
							{apps.length}
							{apps.length === 1 ? 'app' : 'apps'} in this category
						</p>
					</div>
					<a href="/discover" class="text-primary hover:underline">Browse all</a>
				</div>
			</div>
		</div>

		<div class="max-w-6xl mx-auto px-6 py-8">
			<div class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{#each apps as app (app.id)}
					{@const ratingPct = Math.round(app.reputationScore)}
					{@const listingStatus =
						$backendState.listingStatusByAppId?.[app.id] === 'beta' ? 'beta' : 'listed'}
					{@const isTrending = trendingIds.has(app.id)}
					{@const isDaoPick = daoPickIds.has(app.id)}
					{@const isEditorsPick = editorsPickIds.has(app.id)}
					{@const isVerifiedDev = verifiedDevByAddress.get(app.developerAddress) ?? false}
					<a href="/apps/{app.id}" class="group block">
						<div
							class="flex items-start gap-3.5 p-3.5 rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)] transition-[border-color,background-color] duration-100 ease-out cursor-pointer"
						>
							<img
								src={appIcon(app)}
								alt={app.name}
								width="52"
								height="52"
								class="rounded-[12px] flex-shrink-0"
							/>
							<div class="flex-1 min-w-0">
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0">
										<h3
											class="text-[13px] font-semibold text-[var(--text-primary)] truncate"
										>
											{app.name}
										</h3>
										<p class="text-[12px] text-[var(--text-tertiary)] truncate mt-0.5">
											{app.description.split('.')[0]}
										</p>
									</div>
									<button
										type="button"
										class="btn-subscribe flex-shrink-0 mt-0.5"
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											window.location.href = `/apps/${app.id}?action=mine`;
										}}
									>
										Subscribe
									</button>
								</div>
								<div class="flex items-center gap-3 mt-2.5 text-[11px]">
									<span class="flex items-center gap-1 text-[var(--text-secondary)]">
										<span class="font-semibold text-[var(--text-accent)]"
											>{ratingPct}%</span
										>
										<span class="text-[var(--text-tertiary)]">rating</span>
									</span>
									<span class="text-[var(--text-tertiary)]">&middot;</span>
									<span class="font-mono text-[var(--text-secondary)]">
										${app.avgEarningsPerDay.toFixed(0)}/d
									</span>
									<span class="text-[var(--text-tertiary)]">&middot;</span>
									<span class="text-[var(--text-tertiary)]">
										{app.totalMiners.toLocaleString('en-US')} miners
									</span>
									{#if isTrending}
										<span
											class="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-500"
										>
											<Flame class="h-3 w-3" /> Hot
										</span>
									{:else if isDaoPick}
										<span
											class="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-subtle)] text-[var(--text-accent)]"
										>
											<Award class="h-3 w-3" /> DAO Pick
										</span>
									{:else if listingStatus === 'beta'}
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
		</div>
	</div>
{/if}
