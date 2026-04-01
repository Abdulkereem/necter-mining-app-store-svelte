<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		padding = 'p-5',
		class: className = '',
		children,
	}: {
		padding?: string;
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="n-card {padding} {className}">
	{#if children}{@render children()}{/if}
</div>

<style>
	.n-card {
		background-color: var(--surface-1);
		border: 1px solid var(--border-default);
		border-radius: 8px;
	}
</style>
