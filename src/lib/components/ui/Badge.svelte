<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

	let {
		variant = 'neutral',
		class: className = '',
		children,
	}: {
		variant?: Variant;
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<span class="n-badge n-badge--{variant} {className}">
	{#if children}{@render children()}{/if}
</span>

<style>
	.n-badge {
		display: inline-flex;
		align-items: center;
		height: 20px;
		padding: 0 6px;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 500;
		white-space: nowrap;
	}

	.n-badge--accent {
		background-color: var(--accent-subtle);
		color: var(--text-accent);
	}
	.n-badge--success {
		background-color: rgba(76, 183, 130, 0.12);
		color: var(--success);
	}
	.n-badge--warning {
		background-color: rgba(242, 153, 74, 0.12);
		color: var(--warning);
	}
	.n-badge--error {
		background-color: rgba(235, 87, 87, 0.12);
		color: var(--error);
	}
	.n-badge--neutral {
		background-color: var(--surface-3);
		color: var(--text-secondary);
	}
</style>
