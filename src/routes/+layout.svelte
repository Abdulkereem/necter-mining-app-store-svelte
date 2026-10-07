<script lang="ts">
	import '../app.css';
	import '@fontsource-variable/inter';
	import '@fontsource-variable/jetbrains-mono';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import ConnectWalletModal from '$lib/components/ConnectWalletModal.svelte';
	import { Toaster } from 'svelte-french-toast';
	import { hydrateWallet } from '$lib/stores/wallet';
	import { startAccountSync } from '$lib/stores/account';
	import { startBalanceSync } from '$lib/stores/balances';
	import { loadDescriptor } from '$lib/stores/network';
	import { connectMiner } from '$lib/local/miner';
	import { APP_MODE, MOCK_API } from '$lib/config';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { navigating } from '$app/stores';

	let { children } = $props();

	afterNavigate(() => {
		window.scrollTo({ top: 0 });
	});

	onMount(() => {
		startAccountSync();
		startBalanceSync();
		void loadDescriptor().catch(() => undefined);
		if (APP_MODE === 'local') void connectMiner().finally(() => hydrateWallet());
		else void hydrateWallet();
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon.png" />
	<title>Necter Mining App Store</title>
	<meta
		name="description"
		content="Discover Necter mining projects, subscribe your devices with gasless collateral, and earn rewards from verified compute."
	/>
</svelte:head>

{#if $navigating}
	<div class="fixed top-0 left-0 right-0 h-[2px] z-[100] bg-[var(--accent-base)] animate-pulse"></div>
{/if}

<div class="dark font-sans antialiased bg-[var(--surface-0)] text-[var(--text-primary)]">
	<div class="hidden md:block">
		<Sidebar />
	</div>
	<MobileNav />
	<div class="md:ml-[220px] pt-[48px] pb-[64px] md:pt-0 md:pb-0">
		{#if MOCK_API}
			<div
				class="sticky top-0 z-30 flex items-center justify-center gap-2 h-[26px] text-[11px] font-medium bg-[rgba(110,159,255,0.12)] text-[var(--info)] border-b border-[rgba(110,159,255,0.25)]"
				data-testid="mock-banner"
			>
				Development mock API — sample data only, not the Necter network
			</div>
		{/if}
		<main class="min-h-screen">
			{@render children()}
		</main>
	</div>
	<ConnectWalletModal />
	<Toaster />
</div>
