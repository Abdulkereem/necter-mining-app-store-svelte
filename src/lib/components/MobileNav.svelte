<script lang="ts">
	import { page } from '$app/stores';
	import {
		Compass,
		Pickaxe,
		Trophy,
		Shield,
		Search,
		Bell,
		HelpCircle,
		Settings,
		LogOut,
		Wallet,
		ChevronRight
	} from 'lucide-svelte';
	import { actor, showConnectModal, disconnectWallet } from '$lib/stores/wallet';
	import { minerAvatarDataUri } from '$lib/miner-avatar';

	const tabs = [
		{
			href: '/discover',
			label: 'Discover',
			icon: Compass,
			match: ['/discover', '/apps', '/category']
		},
		{ href: '/mining', label: 'Mining', icon: Pickaxe, match: ['/mining'] },
		{ href: '/leaderboards', label: 'Leaderboard', icon: Trophy, match: ['/leaderboards'] },
		{ href: '/governance', label: 'Governance', icon: Shield, match: ['/governance'] },
		{ href: '/search', label: 'Search', icon: Search, match: ['/search'] }
	];

	const menuItems = [
		{ href: '/settings', label: 'Settings', icon: Settings },
		{ href: '/withdraw', label: 'Withdraw', icon: Wallet }
	];

	let showProfile = $state(false);

	const pathname = $derived($page.url.pathname);

	function isTabActive(match: string[]) {
		return match.some((m) => pathname === m || pathname.startsWith(m + '/'));
	}

	const avatarSrc = $derived($actor?.minerId ? minerAvatarDataUri($actor.minerId) : null);

	function handleAvatarClick() {
		if ($actor) {
			showProfile = !showProfile;
		} else {
			showConnectModal.set(true);
		}
	}

	function handleDisconnect() {
		disconnectWallet();
		showProfile = false;
	}
</script>

<!-- Top bar -->
<div
	class="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-[48px] px-4"
	style="background: var(--surface-0); border-bottom: 1px solid var(--border-default);"
>
	<!-- Profile avatar (left) -->
	<button
		type="button"
		onclick={handleAvatarClick}
		class="h-8 w-8 rounded-full flex items-center justify-center cursor-pointer overflow-hidden"
		style="background: var(--surface-2); border: 1px solid var(--border-default);"
	>
		{#if avatarSrc}
			<img src={avatarSrc} alt="" class="h-8 w-8 rounded-full" />
		{:else}
			<span class="text-[11px] font-semibold" style="color: var(--text-tertiary);">?</span>
		{/if}
	</button>

	<!-- Center logo -->
	<img
		src="/brand/NECTER.svg"
		alt="Necter"
		class="h-[16px] opacity-90 absolute left-1/2 -translate-x-1/2"
	/>

	<!-- Right — Help + Notifications -->
	<div class="flex items-center gap-1">
		<a
			href="/learn"
			class="h-8 w-8 rounded-full flex items-center justify-center no-underline"
		>
			<HelpCircle class="h-[18px] w-[18px]" strokeWidth={1.5} style="color: var(--text-tertiary);" />
		</a>
		<a
			href="/notifications"
			class="h-8 w-8 rounded-full flex items-center justify-center no-underline"
		>
			<Bell class="h-[18px] w-[18px]" strokeWidth={1.5} style="color: var(--text-tertiary);" />
		</a>
	</div>
</div>

<!-- Bottom tab bar -->
<nav
	class="md:hidden fixed bottom-0 left-0 right-0 z-50"
	style="background: var(--surface-1); border-top: 1px solid var(--border-default); padding-bottom: env(safe-area-inset-bottom);"
>
	<div class="flex items-center justify-around h-[52px]">
		{#each tabs as tab}
			{@const active = isTabActive(tab.match)}
			<a
				href={tab.href}
				class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full no-underline"
				onclick={() => (showProfile = false)}
			>
				<tab.icon
					class="h-[20px] w-[20px]"
					strokeWidth={active ? 2 : 1.5}
					style="color: {active ? 'var(--text-accent)' : 'var(--text-tertiary)'};"
				/>
				<span
					class="text-[10px] font-medium"
					style="color: {active ? 'var(--text-accent)' : 'var(--text-tertiary)'};"
				>
					{tab.label}
				</span>
			</a>
		{/each}
	</div>
</nav>

<!-- Profile menu overlay -->
{#if showProfile}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="md:hidden fixed inset-0 z-40" onclick={() => (showProfile = false)} onkeydown={(e) => e.key === 'Escape' && (showProfile = false)} role="presentation">
		<div class="absolute inset-0 bg-black/40"></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute top-[48px] left-0 right-0 shadow-lg"
			style="background: var(--surface-1); border-bottom: 1px solid var(--border-default);"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
			role="presentation"
		>
			<!-- Wallet info -->
			{#if $actor}
				<div
					class="px-4 py-3"
					style="border-bottom: 1px solid var(--border-default);"
				>
					<p class="text-[13px] font-medium" style="color: var(--text-primary);">
						{$actor.minerId}
					</p>
					<p class="text-[11px] font-mono truncate" style="color: var(--text-tertiary);">
						{$actor.walletAddress}
					</p>
				</div>
			{/if}

			<!-- Menu items -->
			<div class="py-1">
				{#each menuItems as item}
					<a
						href={item.href}
						onclick={() => (showProfile = false)}
						class="flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-[var(--surface-2)]"
					>
						<item.icon class="h-[18px] w-[18px]" strokeWidth={1.5} style="color: var(--text-tertiary);" />
						<span class="text-[14px] flex-1" style="color: var(--text-primary);">
							{item.label}
						</span>
						<ChevronRight class="h-4 w-4" strokeWidth={1.5} style="color: var(--text-tertiary);" />
					</a>
				{/each}

				{#if $actor}
					<button
						type="button"
						onclick={handleDisconnect}
						class="flex items-center gap-3 px-4 py-3 w-full bg-transparent border-none cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
					>
						<LogOut class="h-[18px] w-[18px]" strokeWidth={1.5} style="color: var(--error);" />
						<span class="text-[14px]" style="color: var(--error);">Disconnect</span>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
