<script lang="ts">
	let {
		checked = $bindable(false),
		disabled = false,
		class: className = '',
	}: {
		checked?: boolean;
		disabled?: boolean;
		class?: string;
	} = $props();
</script>

<label class="n-toggle {className}" class:n-toggle--disabled={disabled}>
	<input
		type="checkbox"
		bind:checked
		{disabled}
		class="sr-only"
	/>
	<span class="n-toggle-track" class:n-toggle-track--on={checked}>
		<span class="n-toggle-thumb" class:n-toggle-thumb--on={checked}></span>
	</span>
</label>

<style>
	.n-toggle {
		position: relative;
		display: inline-flex;
		align-items: center;
		cursor: pointer;
	}
	.n-toggle--disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	.n-toggle-track {
		width: 36px;
		height: 20px;
		border-radius: 9999px;
		background-color: var(--surface-3);
		transition: background-color 150ms ease-out;
		position: relative;
	}
	.n-toggle-track--on {
		background-color: var(--accent-base);
	}

	.n-toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 9999px;
		background-color: white;
		transition: transform 150ms ease-out;
	}
	.n-toggle-thumb--on {
		transform: translateX(16px);
	}
</style>
