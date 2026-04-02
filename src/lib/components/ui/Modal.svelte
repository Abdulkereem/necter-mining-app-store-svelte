<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		onClose,
		maxWidth = '480px',
		class: className = '',
		children,
	}: {
		open?: boolean;
		onClose?: () => void;
		maxWidth?: string;
		class?: string;
		children?: Snippet;
	} = $props();

	function handleBackdrop() {
		open = false;
		onClose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') handleBackdrop();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="n-modal-overlay"
		role="dialog"
		aria-modal="true"
		onkeydown={handleKeydown}
	>
		<!-- Backdrop -->
		<button
			class="n-modal-backdrop"
			onclick={handleBackdrop}
			tabindex="-1"
			aria-label="Close modal"
		></button>

		<!-- Panel -->
		<div
			class="n-modal-panel {className}"
			style="max-width: {maxWidth};"
		>
			{#if children}{@render children()}{/if}
		</div>
	</div>
{/if}

<style>
	.n-modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		justify-content: center;
		/* Mobile: bottom-sheet, Desktop: centered */
		align-items: flex-end;
		animation: fadeIn 150ms ease-out;
	}

	@media (min-width: 640px) {
		.n-modal-overlay {
			align-items: center;
		}
	}

	.n-modal-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.60);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: none;
		cursor: default;
	}

	.n-modal-panel {
		position: relative;
		width: 100%;
		background-color: var(--surface-1);
		border: 1px solid var(--border-default);
		padding: 24px;
		/* Mobile: bottom-sheet */
		border-radius: 12px 12px 0 0;
		animation: slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	@media (min-width: 640px) {
		.n-modal-panel {
			border-radius: 12px;
			margin: 16px;
			animation: scaleIn 150ms ease-out;
		}
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes slideUp {
		from { opacity: 0; transform: translateY(16px); }
		to { opacity: 1; transform: translateY(0); }
	}
	@keyframes scaleIn {
		from { opacity: 0; transform: scale(0.97); }
		to { opacity: 1; transform: scale(1); }
	}
</style>
