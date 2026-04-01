<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		type = 'text',
		value = $bindable(''),
		placeholder = '',
		disabled = false,
		class: className = '',
		...rest
	}: {
		type?: string;
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
	} & Omit<HTMLInputAttributes, 'class'> = $props();
</script>

<input
	class="n-input {className}"
	{type}
	bind:value
	{placeholder}
	{disabled}
	{...rest}
/>

<style>
	.n-input {
		width: 100%;
		height: 36px;
		padding: 0 12px;
		border-radius: 5px;
		border: 1px solid var(--border-default);
		background-color: var(--surface-0);
		color: var(--text-primary);
		font-size: 13px;
		font-family: inherit;
		outline: none;
		transition: border-color 100ms ease-out;
	}
	.n-input:focus {
		border-color: var(--accent-base);
	}
	.n-input::placeholder {
		color: var(--text-tertiary);
	}
	.n-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
