<script lang="ts">
	import '../app.css';
	import '@fontsource-variable/inter';
	import '@fontsource-variable/jetbrains-mono';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { hydrateBackend } from '$lib/stores/backend';
	import { hydrateWallet } from '$lib/stores/wallet';
	import { onMount } from 'svelte';

	let { children } = $props();

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

<html lang="en" class="dark">
	<body
		class="font-sans antialiased bg-[var(--surface-0)] text-[var(--text-primary)]"
	>
		<div class="hidden md:block">
			<Sidebar />
		</div>
		<div class="md:ml-[220px]">
			<main class="min-h-screen">
				{@render children()}
			</main>
		</div>
	</body>
</html>
