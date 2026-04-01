<script lang="ts">
	type Tab = { id: string; label: string };

	let {
		tabs,
		active = $bindable(''),
		class: className = '',
	}: {
		tabs: Tab[];
		active?: string;
		class?: string;
	} = $props();
</script>

<div class="n-tabbar {className}">
	{#each tabs as tab (tab.id)}
		<button
			class="n-tabbar-btn"
			class:n-tabbar-btn--active={active === tab.id}
			onclick={() => (active = tab.id)}
		>
			{tab.label}
		</button>
	{/each}
</div>

<style>
	.n-tabbar {
		display: inline-flex;
		align-items: center;
		background-color: var(--surface-1);
		border: 1px solid var(--border-default);
		border-radius: 8px;
		padding: 3px;
		gap: 2px;
	}

	.n-tabbar-btn {
		height: 28px;
		padding: 0 12px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-secondary);
		font-size: 12px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 100ms ease-out;
		white-space: nowrap;
	}
	.n-tabbar-btn:hover:not(.n-tabbar-btn--active) {
		color: var(--text-primary);
		background-color: var(--surface-2);
	}
	.n-tabbar-btn--active {
		background-color: var(--surface-3);
		color: var(--text-primary);
		font-weight: 600;
	}
</style>
