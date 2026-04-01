<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	let {
		value = $bindable(''),
		disabled = false,
		class: className = '',
		children,
		...rest
	}: {
		value?: string;
		disabled?: boolean;
		class?: string;
		children?: Snippet;
	} & Omit<HTMLSelectAttributes, 'class'> = $props();
</script>

<select
	class="n-select {className}"
	bind:value
	{disabled}
	{...rest}
>
	{#if children}{@render children()}{/if}
</select>

<style>
	.n-select {
		width: 100%;
		height: 36px;
		padding: 0 32px 0 12px;
		border-radius: 5px;
		border: 1px solid var(--border-default);
		background-color: var(--surface-0);
		color: var(--text-primary);
		font-size: 13px;
		font-family: inherit;
		outline: none;
		appearance: none;
		background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2353575C' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
		background-repeat: no-repeat;
		background-position: right 12px center;
		transition: border-color 100ms ease-out;
		cursor: pointer;
	}
	.n-select:focus {
		border-color: var(--accent-base);
	}
	.n-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
