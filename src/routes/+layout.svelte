<script lang="ts">
	import '../app.css';
	import '@fontsource-variable/inter';
	import '@fontsource-variable/jetbrains-mono';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import ConnectWalletModal from '$lib/components/ConnectWalletModal.svelte';
	import { Toaster } from 'svelte-french-toast';
	import { hydrateBackend } from '$lib/stores/backend';
	import { hydrateWallet } from '$lib/stores/wallet';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { navigating } from '$app/stores';

	let { children } = $props();

	afterNavigate(() => {
		window.scrollTo({ top: 0 });
	});

	onMount(() => {
		hydrateBackend();
		hydrateWallet();
	});
</script>

<svelte:head>
	<link rel="icon" href="/brand/logo.svg" />
	<title>Necter Mining App Store</title>
	<meta
		name="description"
		content="Discover mining networks, subscribe with one click, and start earning rewards from DePIN, AI, storage, and compute workloads."
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
		<main class="min-h-screen">
			{@render children()}
		</main>
	</div>
	<ConnectWalletModal />
	<Toaster />
</div>
