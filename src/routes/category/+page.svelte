<script lang="ts">
	import { backendState, backend } from '$lib/stores/backend';
	import { appIconDataUri } from '$lib/app-icon';
	import { Signal, Brain, HardDrive, Server, Wifi, Layers, Cpu, Lock } from 'lucide-svelte';
	import type { App, AppCategory } from '$lib/types';

	/* ─── Helper ─── */
	function appIcon(app: App): string {
		return app.icon && app.icon !== '/placeholder.svg'
			? app.icon
			: appIconDataUri({ id: app.id, name: app.name, category: app.category });
	}

	/* ─── Categories ─── */
	const categories: { name: AppCategory; slug: string; icon: typeof Signal; desc: string }[] = [
		{ name: 'DePIN', slug: 'depin', icon: Signal, desc: 'Decentralized physical infrastructure' },
		{ name: 'AI/ML', slug: 'ai', icon: Brain, desc: 'AI training, inference, and labeling' },
		{
			name: 'Storage',
			slug: 'storage',
			icon: HardDrive,
			desc: 'Distributed file and data storage'
		},
		{ name: 'Compute', slug: 'compute', icon: Server, desc: 'Cloud compute and serverless' },
		{ name: 'IoT', slug: 'iot', icon: Wifi, desc: 'Internet of Things and sensors' },
		{ name: 'Bandwidth', slug: 'bandwidth', icon: Layers, desc: 'CDN, VPN, and network relay' },
		{
			name: 'Hardware Staking',
			slug: 'hardware-staking',
			icon: Cpu,
			desc: 'Stake hardware resources'
		},
		{
			name: 'Data Sovereignty',
			slug: 'data-sovereignty',
			icon: Lock,
			desc: 'Privacy and data ownership'
		}
	];

	/* ─── Derived data ─── */
	const apps = $derived.by(() => {
		const all = backend.listApps();
		const seen = new Set<string>();
		return all.filter((a) => {
			if (seen.has(a.id)) return false;
			seen.add(a.id);
			return true;
		});
	});

	const byCategory = $derived.by(() => {
		const map = new Map<string, App[]>();
		for (const app of apps) {
			const list = map.get(app.category) || [];
			list.push(app);
			map.set(app.category, list);
		}
		return map;
	});
</script>

<div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
	<h1 class="text-[20px] font-semibold text-[var(--text-primary)] mb-6">Categories</h1>

	<div class="space-y-10">
		{#each categories as { name, slug, icon: Icon, desc } (slug)}
			{@const catApps = byCategory.get(name) || []}
			{#if catApps.length > 0}
				<section>
					<div class="flex items-center justify-between mb-3">
						<div>
							<h2 class="text-[14px] font-semibold text-[var(--text-primary)]">{name}</h2>
							<p class="text-[11px] text-[var(--text-tertiary)]">{desc}</p>
						</div>
						<a
							href="/category/{slug}"
							class="text-[12px] text-[var(--text-accent)] hover:underline"
						>
							See all ({catApps.length})
						</a>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{#each catApps.slice(0, 4) as app (app.id)}
							{@const ratingPct = Math.round(app.reputationScore)}
							{@const listingStatus =
								$backendState.listingStatusByAppId[app.id] === 'beta' ? 'beta' : 'listed'}
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
												<p
													class="text-[12px] text-[var(--text-tertiary)] truncate mt-0.5"
												>
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
											<span
												class="flex items-center gap-1 text-[var(--text-secondary)]"
											>
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
											{#if listingStatus === 'beta'}
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
</div>
