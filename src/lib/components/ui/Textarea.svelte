<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let {
		value = $bindable(''),
		placeholder = '',
		rows = 4,
		disabled = false,
		class: className = '',
		...rest
	}: {
		value?: string;
		placeholder?: string;
		rows?: number;
		disabled?: boolean;
		class?: string;
	} & Omit<HTMLTextareaAttributes, 'class'> = $props();
</script>

<textarea
	class="n-textarea {className}"
	bind:value
	{placeholder}
	{rows}
	{disabled}
	{...rest}
></textarea>

<style>
	.n-textarea {
		width: 100%;
		padding: 10px 12px;
		border-radius: 5px;
		border: 1px solid var(--border-default);
		background-color: var(--surface-0);
		color: var(--text-primary);
		font-size: 13px;
		font-family: inherit;
		line-height: 1.5;
		outline: none;
		resize: vertical;
		transition: border-color 100ms ease-out;
	}
	.n-textarea:focus {
		border-color: var(--accent-base);
	}
	.n-textarea::placeholder {
		color: var(--text-tertiary);
	}
	.n-textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
