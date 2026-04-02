<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Compass, LayoutDashboard, Trophy, Vote, Package, ChevronDown, Search, Bell, BookOpen } from 'lucide-svelte';
	import { wallet, actor, showConnectModal } from '$lib/stores/wallet';
	import { backendState, backend } from '$lib/stores/backend';
	import { minerAvatarDataUri } from '$lib/miner-avatar';
	import { getAppIcon } from '$lib/app-icon';
	import SettingsModal from './SettingsModal.svelte';

	let catOpen = $state(false);
	let settingsOpen = $state(false);
	let searchQuery = $state('');
	let searchOpen = $state(false);
	let searchInputRef = $state<HTMLInputElement | null>(null);

	const pathname = $derived($page.url.pathname);

	const categories = [
		{ name: 'DePIN', slug: 'DePIN' },
		{ name: 'AI/ML', slug: 'AI%2FML' },
		{ name: 'IoT', slug: 'IoT' },
		{ name: 'Storage', slug: 'Storage' },
		{ name: 'Compute', slug: 'Compute' },
		{ name: 'Data Sovereignty', slug: 'Data%20Sovereignty' }
	];

	const navItems = [
		{ name: 'My Mining', href: '/mining', icon: LayoutDashboard },
		{ name: 'Leaderboards', href: '/leaderboards', icon: Trophy },
	];

	function isActive(href: string) {
		if (href === '/mining') return pathname.startsWith('/mining');
		return pathname === href || pathname.startsWith(href + '/');
	}

	const discoverActive = $derived(
		pathname === '/discover' || pathname === '/' || pathname.startsWith('/category')
	);

	const searchResults = $derived.by(() => {
		if (searchQuery.trim().length < 2) return [];
		const q = searchQuery.toLowerCase();
		return $backendState.apps
			.filter(
				(a) =>
					a.name.toLowerCase().includes(q) ||
					a.category.toLowerCase().includes(q) ||
					a.description.toLowerCase().includes(q)
			)
			.slice(0, 5);
	});

	// Keyboard shortcut
	$effect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				searchInputRef?.focus();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});
</script>

<aside
	class="fixed left-0 top-0 h-screen w-[220px] bg-[var(--surface-0)] border-r border-[var(--border-strong)] flex flex-col z-40"
	style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23FFC933' fill-opacity='0.03'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E&quot;);"
>
	<!-- Brand mark -->
	<div class="px-3 pt-5 pb-2">
		<button
			type="button"
			onclick={() => window.dispatchEvent(new CustomEvent('necter:open-onboarding'))}
			class="flex items-center gap-2.5 px-2 py-1.5 rounded-[5px] hover:bg-[var(--surface-1)] transition-colors duration-100 no-underline w-full bg-transparent border-none cursor-pointer text-left"
		>
			<img src="/brand/logo.svg" alt="Necter" class="h-7 w-7 flex-shrink-0" />
			<div class="flex flex-col" style="padding-top: 2px;">
				<img src="/brand/NECTER.png" alt="NECTER" class="h-[9px] block" />
				<span
					class="text-[10px] text-[var(--text-tertiary)] block leading-none mt-[6px] tracking-[0.03em]"
					>Mining App Store</span
				>
			</div>
		</button>
	</div>

	<!-- Search -->
	<div class="px-3 pt-1 pb-1">
		<div class="relative">
			<div
				class="flex items-center gap-1.5 h-[30px] px-2 rounded-[5px] bg-[var(--surface-1)] border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-colors"
			>
				<Search class="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} style="color: var(--text-secondary)" />
				<input
					bind:this={searchInputRef}
					type="text"
					bind:value={searchQuery}
					onfocus={() => (searchOpen = true)}
					onblur={() => setTimeout(() => (searchOpen = false), 200)}
					placeholder="Search..."
					class="flex-1 min-w-0 bg-transparent text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
				/>
				<kbd class="text-[9px] font-mono text-[var(--text-tertiary)] bg-[var(--surface-2)] px-1 py-0.5 rounded-[2px] flex-shrink-0 leading-none">⌘K</kbd>
			</div>

			{#if searchOpen && searchResults.length > 0}
				<div
					class="absolute left-0 right-0 top-[34px] z-50 rounded-[8px] border border-[var(--border-default)] bg-[var(--surface-1)] p-1 space-y-[1px]"
					style="box-shadow: 0 8px 30px rgba(0,0,0,0.4);"
				>
					{#each searchResults as app}
						<button
							type="button"
							onmousedown={() => {
								goto(`/apps/${app.id}`);
								searchQuery = '';
								searchOpen = false;
							}}
							class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[5px] text-left hover:bg-[var(--surface-2)] transition-colors bg-transparent border-none cursor-pointer"
						>
							<div class="h-6 w-6 rounded-[5px] bg-[var(--surface-3)] flex items-center justify-center flex-shrink-0 overflow-hidden">
								<img
									src={getAppIcon(app)}
									alt=""
									class="h-6 w-6 rounded-[5px]"
								/>
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-[12px] font-medium text-[var(--text-primary)] truncate">{app.name}</p>
								<p class="text-[10px] text-[var(--text-tertiary)]">{app.category}</p>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Nav -->
	<nav class="flex-1 overflow-y-auto px-2 py-3 space-y-[2px]">
		<!-- Discover with sub-categories -->
		<div class="flex items-center">
			<a
				href="/discover"
				class="flex-1 flex items-center gap-2.5 px-3 h-[32px] rounded-[5px] text-[13px] transition-colors duration-100 {discoverActive
					? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium'
					: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'}"
			>
				<Compass class="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
				<span>Discover</span>
			</a>
			<button
				type="button"
				onclick={() => (catOpen = !catOpen)}
				class="h-[32px] w-[28px] flex items-center justify-center rounded-[5px] hover:bg-[var(--surface-2)] transition-colors bg-transparent border-none cursor-pointer"
			>
				<ChevronDown
					class="h-3 w-3 text-[var(--text-tertiary)] transition-transform duration-150 {catOpen ? 'rotate-180' : ''}"
					strokeWidth={2}
				/>
			</button>
		</div>

		{#if catOpen}
			<div class="ml-[26px] space-y-[1px]">
				{#each categories as cat}
					{@const catActive = pathname === `/category/${cat.slug}` || pathname === `/category/${decodeURIComponent(cat.slug)}`}
					<a
						href="/category/{cat.slug}"
						class="block px-3 h-[28px] leading-[28px] rounded-[4px] text-[12px] transition-colors duration-100 no-underline {catActive
							? 'text-[var(--text-accent)] font-medium'
							: 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}"
					>
						{cat.name}
					</a>
				{/each}
			</div>
		{/if}

		<!-- Other nav items -->
		{#each navItems as item}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				class="flex items-center gap-2.5 px-3 h-[32px] rounded-[5px] text-[13px] transition-colors duration-100 no-underline {active
					? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium'
					: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'}"
			>
				<svelte:component this={item.icon} class="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
				<span>{item.name}</span>
			</a>
		{/each}

		<!-- Developer Portal -->
		<a
			href="/develop"
			class="flex items-center gap-2.5 px-3 h-[32px] rounded-[5px] text-[13px] transition-colors duration-100 no-underline {pathname.startsWith('/develop')
				? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium'
				: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'}"
		>
			<Package class="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
			<span>Developer Portal</span>
		</a>

		<!-- Governance -->
		<a
			href="/governance"
			class="flex items-center gap-2.5 px-3 h-[32px] rounded-[5px] text-[13px] transition-colors duration-100 no-underline {pathname === '/governance' || pathname.startsWith('/governance/')
				? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium'
				: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'}"
		>
			<Vote class="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
			<span>Governance</span>
		</a>

		<!-- Activity -->
		<a
			href="/notifications"
			class="flex items-center gap-2.5 px-3 h-[32px] rounded-[5px] text-[13px] transition-colors duration-100 no-underline {pathname === '/notifications'
				? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium'
				: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'}"
		>
			<Bell class="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
			<span>Activity</span>
		</a>

		<!-- Help -->
		<a
			href="/learn"
			class="flex items-center gap-2.5 px-3 h-[32px] rounded-[5px] text-[13px] transition-colors duration-100 no-underline {pathname.startsWith('/learn')
				? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium'
				: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'}"
		>
			<BookOpen class="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
			<span>Help</span>
		</a>
	</nav>

	<!-- Wallet at bottom -->
	<div class="border-t border-[var(--border-default)] px-3 py-3">
		{#if $wallet}
			<button
				type="button"
				onclick={() => settingsOpen = true}
				class="w-full flex items-center gap-2.5 px-2 py-2 rounded-[5px] hover:bg-[var(--surface-1)] transition-colors duration-100 text-left bg-transparent border-none cursor-pointer"
			>
				<img
					src={minerAvatarDataUri($actor?.minerId ?? $wallet.address)}
					alt=""
					class="h-8 w-8 flex-shrink-0 hex-avatar"
				/>
				<div class="flex-1 min-w-0">
					<p class="text-[12px] font-mono text-[var(--text-primary)] truncate">
						{$wallet.address.slice(0, 6)}...{$wallet.address.slice(-4)}
					</p>
					<p class="text-[11px] font-mono text-[var(--text-accent)]">
						${($backendState.walletBalancesByAddress?.[$wallet.address] ?? 0).toFixed(2)}
					</p>
				</div>
			</button>
		{:else}
			<button
				type="button"
				onclick={() => showConnectModal.set(true)}
				class="w-full flex items-center justify-center gap-2 h-[32px] rounded-[5px] bg-[var(--surface-3)] text-[var(--text-primary)] text-[13px] font-medium hover:bg-[var(--accent-base)] hover:text-[#0C0C0E] transition-colors duration-150 border-none cursor-pointer"
			>
				Connect Wallet
			</button>
		{/if}
	</div>
</aside>

<SettingsModal bind:open={settingsOpen} />
