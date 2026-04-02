<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
	type Size = 'sm' | 'md' | 'lg';

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		class: className = '',
		onclick,
		children,
		...rest
	}: {
		variant?: Variant;
		size?: Size;
		disabled?: boolean;
		class?: string;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
	} & Omit<HTMLButtonAttributes, 'class'> = $props();
</script>

<button
	class="n-btn n-btn--{variant} n-btn--{size} inline-flex {className}"
	{disabled}
	{onclick}
	{...rest}
>
	{#if children}{@render children()}{/if}
</button>

<style>
	.n-btn {
		align-items: center;
		justify-content: center;
		gap: 6px;
		font-weight: 600;
		border-radius: 6px;
		font-size: 13px;
		border: none;
		cursor: pointer;
		transition: all 100ms ease-out;
		white-space: nowrap;
		font-family: inherit;
	}

	/* ── Sizes ── */
	.n-btn--sm { height: 28px; padding: 0 10px; font-size: 12px; border-radius: 5px; }
	.n-btn--md { height: 32px; padding: 0 14px; font-size: 13px; }
	.n-btn--lg { height: 40px; padding: 0 20px; font-size: 14px; }

	/* ── Variants ── */
	.n-btn--primary {
		background-color: var(--accent-base);
		color: #0C0C0E;
	}
	.n-btn--primary:hover:not(:disabled) {
		background-color: var(--accent-hover);
	}
	.n-btn--primary:active:not(:disabled) {
		background-color: var(--accent-pressed);
	}

	.n-btn--secondary {
		background-color: var(--surface-2);
		color: var(--text-secondary);
		border: 1px solid var(--border-default);
	}
	.n-btn--secondary:hover:not(:disabled) {
		background-color: var(--surface-3);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}
	.n-btn--secondary:active:not(:disabled) {
		background-color: var(--surface-4);
	}

	.n-btn--ghost {
		background: transparent;
		color: var(--text-secondary);
	}
	.n-btn--ghost:hover:not(:disabled) {
		background-color: var(--surface-2);
		color: var(--text-primary);
	}

	.n-btn--destructive {
		background-color: rgba(235, 87, 87, 0.10);
		color: var(--error);
		border: 1px solid rgba(235, 87, 87, 0.20);
	}
	.n-btn--destructive:hover:not(:disabled) {
		background-color: rgba(235, 87, 87, 0.18);
		border-color: rgba(235, 87, 87, 0.30);
	}

	/* ── Disabled ── */
	.n-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
