<script lang="ts">
	import '../app.css';
	import '@fontsource-variable/inter';
	import '@fontsource-variable/jetbrains-mono';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/brand/logo.svg" />
	<title>Necter Mining App Store</title>
	<meta name="description" content="Discover mining networks, subscribe with one click, and start earning rewards from DePIN, AI, storage, and compute workloads." />
</svelte:head>

<div class="font-sans antialiased bg-[var(--surface-0)] text-[var(--text-primary)]">
	{@render children()}
</div>
